import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { Api, Realtime, mensagemDeErro } from 'compartilhado';
import type { AvaliacaoSenha, PesquisaPergunta, PesquisaPublica } from 'compartilhado';
import { AvisoSonoro } from './aviso-sonoro';

type Estado =
  | 'carregando'
  | 'nao-encontrada'
  | 'acompanhando'
  | 'formulario'
  | 'enviando'
  | 'sucesso'
  | 'ja-respondida'
  | 'encerrada'
  | 'erro';

const CHAVE_DISPOSITIVO = 'sga.pesquisa.dispositivo';

/**
 * UUID v4 que identifica o aparelho. crypto.randomUUID() só existe em contexto
 * seguro (HTTPS ou localhost): no celular, que abre a pesquisa por
 * http://IP-da-máquina, ele é undefined e derrubava o envio da resposta.
 * getRandomValues funciona em qualquer contexto.
 */
function novoIdentificador(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; // versão 4
  b[8] = (b[8] & 0x3f) | 0x80; // variante RFC 4122
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * Características do aparelho enviadas com a resposta, para os relatórios
 * distinguirem celulares atrás do mesmo IP (indício de avaliações repetidas).
 * Nada aqui identifica a pessoa. O modelo só vem em navegadores que o
 * informam (Chrome em HTTPS); a tela entra sem depender da orientação.
 */
async function caracteristicasDoAparelho(): Promise<{ modelo?: string; impressao: string }> {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    userAgentData?: { getHighEntropyValues?(dicas: string[]): Promise<{ model?: string }> };
  };
  let modelo: string | undefined;
  try {
    modelo = (await nav.userAgentData?.getHighEntropyValues?.(['model']))?.model || undefined;
  } catch {
    // navegador não informa
  }
  const impressao = [
    `${Math.min(screen.width, screen.height)}x${Math.max(screen.width, screen.height)}@${devicePixelRatio}`,
    nav.hardwareConcurrency ?? '',
    nav.deviceMemory ?? '',
    nav.maxTouchPoints ?? '',
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? '',
    nav.language ?? '',
  ].join('|');
  return { modelo, impressao: impressao.slice(0, 200) };
}

/** De quanto em quanto tempo a página confere se o atendimento já terminou. */
const INTERVALO_ACOMPANHAMENTO_MS = 10_000;

/**
 * Atende dois endereços:
 * - /p/:codigo — pesquisa anônima da unidade (QR do guichê);
 * - /a/:token  — avaliação do atendimento de UMA senha (QR impresso no cupom).
 *   Se o cidadão ler o QR antes de ser atendido, acompanha a senha ao vivo e
 *   o formulário abre sozinho quando o atendimento termina.
 */
@Component({
  selector: 'app-pesquisa',
  templateUrl: './pesquisa.html',
  styleUrl: './pesquisa.scss',
})
export class PesquisaComponent {
  private readonly api = inject(Api);
  private readonly rota = inject(ActivatedRoute);
  private readonly realtime = inject(Realtime);

  private readonly codigo = this.rota.snapshot.paramMap.get('codigo') ?? '';
  private readonly token = this.rota.snapshot.paramMap.get('token');
  private readonly respostas = new Map<string, string>();
  private temporizador: ReturnType<typeof setTimeout> | null = null;

  /** Som, voz e vibração quando a senha é chamada (ativado com um toque). */
  protected readonly aviso = new AvisoSonoro();
  /** Destaque visual por alguns segundos quando a senha acaba de ser chamada. */
  protected readonly chamadaNova = signal(false);
  private tempoReal = false;
  private primeiraLeitura = true;
  /**
   * Maior "chamadas" já visto. Só cresce no servidor (chamada, rechamada,
   * transferência): avisar só quando sobe impede que uma resposta atrasada
   * repita um aviso antigo com o guichê errado.
   */
  private ultimaChamadas = 0;
  /** Leituras numeradas: resposta de uma leitura mais antiga que a já aplicada é descartada. */
  private leituraPedida = 0;
  private leituraAplicada = 0;

  /** Avaliação de uma senha (QR do cupom) em vez da pesquisa anônima. */
  protected readonly modoSenha = this.token !== null;

  protected readonly estado = signal<Estado>('carregando');
  protected readonly pesquisa = signal<PesquisaPublica | null>(null);
  protected readonly avaliacao = signal<AvaliacaoSenha | null>(null);
  protected readonly indice = signal(0);
  protected readonly textoAtual = signal('');
  protected readonly mensagemErro = signal('');

  protected readonly perguntas = computed<PesquisaPergunta[]>(() => {
    const p = this.pesquisa();
    return p ? [...p.perguntas].sort((a, b) => a.ordem - b.ordem) : [];
  });

  protected readonly perguntaAtual = computed<PesquisaPergunta | null>(
    () => this.perguntas()[this.indice()] ?? null,
  );

  protected readonly progresso = computed(() => {
    const total = this.perguntas().length;
    return total ? Math.round(((this.indice() + 1) / total) * 100) : 0;
  });

  protected readonly notas = computed(() => {
    const max = this.perguntaAtual()?.escalaMax ?? 5;
    return Array.from({ length: max }, (_, i) => i + 1);
  });

  constructor() {
    // Celular bloqueado durante a espera: ao voltar, confere na hora.
    const aoVoltar = () => {
      if (document.visibilityState === 'visible' && this.estado() === 'acompanhando') {
        this.acompanhar(0);
        void this.aviso.manterTelaAcesa(); // a trava da tela cai quando a página fica oculta
      }
    };
    document.addEventListener('visibilitychange', aoVoltar);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('visibilitychange', aoVoltar);
      this.pararAcompanhamento();
      this.desligarTempoReal();
      this.aviso.liberarTela();
    });
    this.carregar();
  }

  private async carregar(): Promise<void> {
    try {
      if (this.token !== null) {
        await this.lerSituacao();
        return;
      }
      const dados = await this.api.get<PesquisaPublica>(`/public/pesquisas/${this.codigo}`);
      this.pesquisa.set(dados);
      this.estado.set('formulario');
    } catch (e) {
      if (e instanceof HttpErrorResponse && e.status === 404) {
        this.estado.set('nao-encontrada');
      } else {
        this.mensagemErro.set(mensagemDeErro(e));
        this.estado.set('erro');
      }
    }
  }

  private aplicarSituacao(dados: AvaliacaoSenha): void {
    this.avaliacao.set(dados);
    this.avisarSeChamada(dados);
    switch (dados.situacao) {
      case 'AGUARDANDO':
      case 'CHAMADA':
      case 'EM_ATENDIMENTO':
        this.estado.set('acompanhando');
        this.ligarTempoReal();
        this.acompanhar();
        return;
      case 'LIBERADA':
        this.pararAcompanhamento();
        this.desligarTempoReal();
        this.pesquisa.set(dados.pesquisa ?? null);
        this.estado.set('formulario');
        return;
      case 'RESPONDIDA':
        this.pararAcompanhamento();
        this.desligarTempoReal();
        this.estado.set('ja-respondida');
        return;
      default: // EXPIRADA, INDISPONIVEL
        this.pararAcompanhamento();
        this.desligarTempoReal();
        this.estado.set('encerrada');
    }
  }

  /**
   * Avisa quando a senha passa a CHAMADA — e de novo a cada rechamada ou
   * transferência (sobe "chamadas" ou muda o guichê). Na primeira leitura não
   * avisa: quem abre a página já vê na tela que foi chamado.
   */
  private avisarSeChamada(dados: AvaliacaoSenha): void {
    const chamadas = dados.senha.chamadas ?? 0;
    if (dados.situacao === 'CHAMADA' && chamadas > this.ultimaChamadas && !this.primeiraLeitura) {
      this.aviso.anunciar(dados.senha.codigo, dados.senha.guiche);
      this.chamadaNova.set(true);
      setTimeout(() => this.chamadaNova.set(false), 8000);
    }
    this.ultimaChamadas = Math.max(this.ultimaChamadas, chamadas);
    this.primeiraLeitura = false;
  }

  /** Lê a situação da senha; resposta que chega depois de uma mais nova é descartada. */
  private async lerSituacao(): Promise<void> {
    const numero = ++this.leituraPedida;
    const dados = await this.api.get<AvaliacaoSenha>(`/public/avaliacoes/${this.token}`);
    if (numero < this.leituraAplicada) return;
    this.leituraAplicada = numero;
    this.aplicarSituacao(dados);
  }

  /** Toque em "Ativar aviso sonoro". Se a senha já está chamada, avisa agora. */
  protected ativarAviso(): void {
    this.aviso.ativar();
    const dados = this.avaliacao();
    if (dados?.situacao === 'CHAMADA') {
      setTimeout(() => this.aviso.anunciar(dados.senha.codigo, dados.senha.guiche), 400);
    }
  }

  /**
   * A API avisa a sala desta senha a cada mudança (chamada, rechamada, início,
   * fim): a página relê a situação na hora, sem esperar a consulta de 10 s —
   * que continua como reserva se o tempo real cair.
   */
  private ligarTempoReal(): void {
    if (this.tempoReal || !this.token) return;
    this.tempoReal = true;
    this.realtime.conectar({ senhaToken: this.token });
    const reler = () => this.acompanhar(0);
    this.realtime.em('senha', reler);
    this.realtime.em('connect', reler); // reconectou depois de oscilar a rede: pode ter perdido um aviso
  }

  private desligarTempoReal(): void {
    this.aviso.liberarTela();
    if (!this.tempoReal) return;
    this.tempoReal = false;
    this.realtime.desconectar();
  }

  /** Confere a situação da senha periodicamente enquanto o cidadão espera. */
  private acompanhar(atraso = INTERVALO_ACOMPANHAMENTO_MS): void {
    this.pararAcompanhamento();
    this.temporizador = setTimeout(async () => {
      try {
        await this.lerSituacao();
      } catch {
        this.acompanhar(); // oscilação de rede: tenta de novo no próximo ciclo
      }
    }, atraso);
  }

  private pararAcompanhamento(): void {
    if (this.temporizador !== null) {
      clearTimeout(this.temporizador);
      this.temporizador = null;
    }
  }

  protected valorSelecionado(perguntaId: string): string | undefined {
    return this.respostas.get(perguntaId);
  }

  protected responder(valor: string): void {
    const pergunta = this.perguntaAtual();
    if (!pergunta) return;
    this.respostas.set(pergunta.id, valor);
    this.avancar();
  }

  protected enviarTexto(): void {
    const pergunta = this.perguntaAtual();
    if (!pergunta) return;
    const texto = this.textoAtual().trim();
    if (!texto && pergunta.obrigatoria) return;
    if (texto) {
      this.respostas.set(pergunta.id, texto);
    } else {
      this.respostas.delete(pergunta.id);
    }
    this.avancar();
  }

  protected pular(): void {
    const pergunta = this.perguntaAtual();
    if (!pergunta || pergunta.obrigatoria) return;
    this.respostas.delete(pergunta.id);
    this.avancar();
  }

  protected voltar(): void {
    if (this.indice() === 0) return;
    this.indice.update((i) => i - 1);
    this.prepararPergunta();
  }

  private avancar(): void {
    if (this.indice() >= this.perguntas().length - 1) {
      this.enviar();
      return;
    }
    this.indice.update((i) => i + 1);
    this.prepararPergunta();
  }

  private prepararPergunta(): void {
    const pergunta = this.perguntaAtual();
    if (pergunta?.tipo === 'TEXTO') {
      this.textoAtual.set(this.respostas.get(pergunta.id) ?? '');
    } else {
      this.textoAtual.set('');
    }
  }

  protected tentarDeNovo(): void {
    this.mensagemErro.set('');
    if (this.pesquisa()) {
      this.estado.set('formulario');
    } else {
      this.estado.set('carregando');
      this.carregar();
    }
  }

  private dispositivoHash(): string {
    let hash: string | null = null;
    try {
      hash = localStorage.getItem(CHAVE_DISPOSITIVO);
    } catch {
      // armazenamento bloqueado (aba anônima de alguns celulares): segue sem lembrar
    }
    if (!hash) {
      hash = novoIdentificador();
      try {
        localStorage.setItem(CHAVE_DISPOSITIVO, hash);
      } catch {
        // idem
      }
    }
    return hash;
  }

  private async enviar(): Promise<void> {
    this.estado.set('enviando');
    const itens = [...this.respostas.entries()].map(([perguntaId, valor]) => ({
      perguntaId,
      valor,
    }));
    const rota = this.modoSenha
      ? `/public/avaliacoes/${this.token}/respostas`
      : `/public/pesquisas/${this.codigo}/respostas`;
    try {
      await this.api.post(rota, { dispositivoHash: this.dispositivoHash(), itens, aparelho: await caracteristicasDoAparelho() });
      this.estado.set('sucesso');
    } catch (e) {
      const mensagem = mensagemDeErro(e).toLowerCase();
      if (mensagem.includes('já foi respondida') || mensagem.includes('já foi avaliado')) {
        this.estado.set('ja-respondida');
      } else {
        this.mensagemErro.set(mensagemDeErro(e));
        this.estado.set('erro');
      }
    }
  }
}
