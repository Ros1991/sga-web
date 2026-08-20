import { Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { Api, mensagemDeErro } from 'compartilhado';
import type { PesquisaPergunta, PesquisaPublica } from 'compartilhado';

type Estado =
  | 'carregando'
  | 'nao-encontrada'
  | 'formulario'
  | 'enviando'
  | 'sucesso'
  | 'ja-respondida'
  | 'erro';

const CHAVE_DISPOSITIVO = 'sga.pesquisa.dispositivo';

@Component({
  selector: 'app-pesquisa',
  templateUrl: './pesquisa.html',
  styleUrl: './pesquisa.scss',
})
export class PesquisaComponent {
  private readonly api = inject(Api);
  private readonly rota = inject(ActivatedRoute);

  private readonly codigo = this.rota.snapshot.paramMap.get('codigo') ?? '';
  private readonly respostas = new Map<string, string>();

  protected readonly estado = signal<Estado>('carregando');
  protected readonly pesquisa = signal<PesquisaPublica | null>(null);
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
    this.carregar();
  }

  private async carregar(): Promise<void> {
    try {
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
    let hash = localStorage.getItem(CHAVE_DISPOSITIVO);
    if (!hash) {
      hash = crypto.randomUUID();
      localStorage.setItem(CHAVE_DISPOSITIVO, hash);
    }
    return hash;
  }

  private async enviar(): Promise<void> {
    this.estado.set('enviando');
    const itens = [...this.respostas.entries()].map(([perguntaId, valor]) => ({
      perguntaId,
      valor,
    }));
    try {
      await this.api.post(`/public/pesquisas/${this.codigo}/respostas`, {
        dispositivoHash: this.dispositivoHash(),
        itens,
      });
      this.estado.set('sucesso');
    } catch (e) {
      const mensagem = mensagemDeErro(e);
      if (mensagem.toLowerCase().includes('já foi respondida')) {
        this.estado.set('ja-respondida');
      } else {
        this.mensagemErro.set(mensagem);
        this.estado.set('erro');
      }
    }
  }
}
