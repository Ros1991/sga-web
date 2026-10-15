import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import * as QRCode from 'qrcode';
import {
  Api,
  SessaoDispositivo,
  Toasts,
  ToastsComponent,
  mensagemDeErro,
} from 'compartilhado';
import type { ConfigDispositivo, NivelPrioridade, Senha } from 'compartilhado';

type ServicoTotem = NonNullable<ConfigDispositivo['servicos']>[number];
type SubservicoTotem = ServicoTotem['subservicos'][number];

type Tela = 'carregando' | 'erro' | 'servico' | 'subservico' | 'prioridade' | 'senha';

@Component({
  selector: 'app-root',
  imports: [NgTemplateOutlet, ToastsComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit, OnDestroy {
  private readonly api = inject(Api);
  private readonly toasts = inject(Toasts);
  protected readonly sessao = inject(SessaoDispositivo);

  protected readonly tela = signal<Tela>('carregando');
  protected readonly config = signal<ConfigDispositivo | null>(null);
  protected readonly tipoErrado = signal(false);
  protected readonly servicoEscolhido = signal<ServicoTotem | null>(null);
  protected readonly subservicoEscolhido = signal<SubservicoTotem | null>(null);
  protected readonly emitindo = signal(false);
  protected readonly senha = signal<Senha | null>(null);
  protected readonly prioridadeEscolhida = signal<NivelPrioridade | null>(null);
  protected readonly impressaoAtiva = signal(false);
  /**
   * Demonstração sem impressora (`&demo=1`, persiste como o token): o cupom
   * aparece na tela e a senha não volta sozinha ao início, para dar tempo de
   * ler o QR com o celular.
   */
  protected readonly modoDemo = signal(false);
  /** QR da avaliação desta senha (SVG em data URL) — sai no cupom e na tela. */
  protected readonly qrAvaliacao = signal<string | null>(null);
  private readonly qrCupom = viewChild<ElementRef<HTMLImageElement>>('qrCupom');

  protected imprimir(): void {
    window.print();
  }

  /**
   * Espera o cupom renderizar e o QR decodificar antes do print — sem isso
   * a impressora pode cortar o cupom sem o código.
   */
  private async imprimirQuandoPronto(): Promise<void> {
    await new Promise((pronto) => setTimeout(pronto, 150));
    await this.qrCupom()?.nativeElement.decode().catch(() => undefined);
    this.imprimir();
  }

  /** SVG imprime nítido em qualquer resolução de impressora térmica. */
  private async gerarQr(url: string): Promise<string | null> {
    try {
      const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    } catch {
      return null; // sem QR, a senha sai do mesmo jeito
    }
  }

  protected formatarEmissao(iso?: string): string {
    const d = iso ? new Date(iso) : new Date();
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  protected readonly contagem = signal(8);

  protected readonly servicos = computed(() => this.config()?.servicos ?? []);

  /**
   * Semântica do DETRAN: menor nível = maior prioridade.
   * No totem a lista vai do MAIOR nível (público em geral) no topo ao
   * menor (mais prioritário) embaixo.
   */
  protected readonly prioridadesOrdenadas = computed<NivelPrioridade[]>(() =>
    [...(this.config()?.prioridades ?? [])].sort((a, b) => b.nivel - a.nivel),
  );

  private temporizador: ReturnType<typeof setInterval> | null = null;

  async ngOnInit(): Promise<void> {
    // Impressão térmica: SEMPRE imprime ao emitir a senha. No quiosque, rode
    // o Chrome com --kiosk --kiosk-printing para o window.print() sair direto
    // na impressora padrão, sem diálogo. Para testar sem impressora, ative o
    // totem com &imprimir=0 (persiste como o token); para demonstrar sem
    // impressora, &demo=1 mostra o cupom na tela (também desliga a impressão).
    const params = new URLSearchParams(location.search);
    if (params.has('imprimir')) {
      localStorage.setItem('sga_totem_imprimir', params.get('imprimir') === '0' ? '0' : '1');
    }
    if (params.has('demo')) {
      localStorage.setItem('sga_totem_demo', params.get('demo') === '1' ? '1' : '0');
    }
    // &imprimir=1 é o totem de verdade: desliga uma demonstração que tenha ficado salva
    if (params.get('imprimir') === '1' && params.get('demo') !== '1') {
      localStorage.setItem('sga_totem_demo', '0');
    }
    this.modoDemo.set(localStorage.getItem('sga_totem_demo') === '1');
    this.impressaoAtiva.set(!this.modoDemo() && localStorage.getItem('sga_totem_imprimir') !== '0');

    const config = await this.sessao.iniciar();
    if (!config) {
      this.tela.set('erro');
      return;
    }
    if (config.tipo !== 'TOTEM') {
      this.tipoErrado.set(true);
      this.tela.set('erro');
      return;
    }
    this.config.set(config);
    this.tela.set('servico');
  }

  ngOnDestroy(): void {
    this.pararContagem();
  }

  protected escolherServico(servico: ServicoTotem): void {
    this.servicoEscolhido.set(servico);
    this.tela.set('subservico');
  }

  protected escolherSubservico(subservico: SubservicoTotem): void {
    this.subservicoEscolhido.set(subservico);
    this.tela.set('prioridade');
  }

  protected voltarParaServicos(): void {
    this.servicoEscolhido.set(null);
    this.subservicoEscolhido.set(null);
    this.tela.set('servico');
  }

  protected voltarParaSubservicos(): void {
    this.subservicoEscolhido.set(null);
    this.tela.set('subservico');
  }

  protected async emitirSenha(prioridade: NivelPrioridade): Promise<void> {
    const subservico = this.subservicoEscolhido();
    if (!subservico || this.emitindo()) return;

    this.emitindo.set(true);
    try {
      const senha = await this.api.post<Senha>(
        '/dispositivo/senhas',
        { subservicoId: subservico.id, prioridadeId: prioridade.id },
        this.sessao.headers(),
      );
      this.qrAvaliacao.set(senha.avaliacaoUrl ? await this.gerarQr(senha.avaliacaoUrl) : null);
      this.prioridadeEscolhida.set(prioridade);
      this.senha.set(senha);
      this.tela.set('senha');
      if (!this.modoDemo()) this.iniciarContagem();
      if (this.impressaoAtiva()) {
        void this.imprimirQuandoPronto();
      }
    } catch (erro) {
      this.toasts.erro(mensagemDeErro(erro));
      // permanece na tela de prioridade para nova tentativa
    } finally {
      this.emitindo.set(false);
    }
  }

  protected recomecar(): void {
    this.pararContagem();
    this.senha.set(null);
    this.qrAvaliacao.set(null);
    this.servicoEscolhido.set(null);
    this.subservicoEscolhido.set(null);
    this.tela.set('servico');
  }

  private iniciarContagem(): void {
    this.pararContagem();
    this.contagem.set(8);
    this.temporizador = setInterval(() => {
      const restante = this.contagem() - 1;
      this.contagem.set(restante);
      if (restante <= 0) {
        this.recomecar();
      }
    }, 1000);
  }

  private pararContagem(): void {
    if (this.temporizador !== null) {
      clearInterval(this.temporizador);
      this.temporizador = null;
    }
  }
}
