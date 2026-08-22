import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
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
  imports: [ToastsComponent],
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
      this.senha.set(senha);
      this.tela.set('senha');
      this.iniciarContagem();
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
