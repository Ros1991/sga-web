import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Api, Autenticacao, FilaSnapshot, Guiche, MeuPerfil, Realtime, SenhaResumo, Toasts,
  Unidade, UnidadeDetalhe, mensagemDeErro,
} from 'compartilhado';

const CHAVE_GUICHE = 'sga.atendimento.guiche';

@Component({
  selector: 'pagina-atendimento',
  imports: [FormsModule],
  template: `
    <header class="topo">
      <div>
        <h2>Atendimento</h2>
        <p class="sub">{{ nomeUnidade() }}</p>
      </div>
      <div class="escolhas">
        @if (unidades().length > 1) {
          <select [(ngModel)]="unidadeId" (ngModelChange)="trocarUnidade()">
            <option value="">Escolha a unidade…</option>
            @for (u of unidades(); track u.id) { <option [value]="u.id">{{ u.nome }}</option> }
          </select>
        }
        <select [(ngModel)]="guicheId" (ngModelChange)="trocarGuiche()" [disabled]="!unidadeId">
          <option value="">Escolha o guichê…</option>
          @for (g of guichesDisponiveis(); track g.id) { <option [value]="g.id">Guichê {{ g.numero }}</option> }
        </select>
      </div>
    </header>

    @if (!unidadeId) {
      <div class="cartao aviso">Escolha a unidade em que você está atendendo.</div>
    } @else if (semGuicheLiberado()) {
      <div class="cartao aviso">
        O gerente ainda não liberou nenhum guichê para você nesta unidade.<br />
        <small>Peça a liberação na aba Equipe da unidade.</small>
      </div>
    } @else if (!guicheId) {
      <div class="cartao aviso">Escolha o guichê em que você está atendendo para começar.</div>
    } @else {
      <div class="grade">
        <section class="cartao atual">
          <h3>Seu guichê</h3>
          @if (senhaAtual(); as s) {
            <div class="senha-atual">
              <span class="codigo">{{ s.codigo }}</span>
              <span class="sub-servico">{{ s.subservico }} · {{ s.prioridade }}</span>
              <span class="etiqueta" [class.etiqueta--ambar]="s.status === 'CHAMADA'"
                    [class.etiqueta--verde]="s.status === 'EM_ATENDIMENTO'">
                {{ s.status === 'CHAMADA' ? 'Chamada — aguardando o cidadão' : 'Em atendimento' }}
              </span>
              <div class="cronometros">
                <span class="crono">
                  <small>{{ s.status === 'CHAMADA' ? 'Chamada há' : 'Em atendimento há' }}</small>
                  <strong>{{ tempoNoGuiche(s) }}</strong>
                </span>
                <span class="crono">
                  <small>Esperou na fila</small>
                  <strong>{{ esperaAteChamada(s) }}</strong>
                </span>
              </div>
            </div>
            <div class="botoes">
              @if (s.status === 'CHAMADA') {
                <button class="botao botao--sucesso" (click)="acao(s, 'iniciar')">Iniciar atendimento</button>
                <button class="botao botao--contorno" (click)="acao(s, 'rechamar')">Rechamar</button>
                <button class="botao botao--fantasma" (click)="acao(s, 'ausente')">Não compareceu</button>
              } @else {
                <button class="botao botao--sucesso" (click)="acao(s, 'finalizar')">Finalizar</button>
              }
              <select class="transferir" [(ngModel)]="guicheDestino" (ngModelChange)="transferir(s)">
                <option value="">Transferir para…</option>
                @for (g of outrosGuiches(); track g.id) { <option [value]="g.id">Guichê {{ g.numero }}</option> }
              </select>
            </div>
          } @else {
            <p class="livre">Guichê livre.</p>
            <button class="botao grande" (click)="chamarProxima()" [disabled]="chamando()">
              {{ chamando() ? 'Chamando…' : '📣 Chamar próxima senha' }}
            </button>
          }
        </section>

        <section class="cartao fila">
          <h3>Fila da unidade <small>({{ fila()?.aguardando?.length ?? 0 }} aguardando)</small></h3>
          <table class="tabela">
            <thead><tr><th>Senha</th><th>Subserviço</th><th>Prioridade</th><th>Espera</th></tr></thead>
            <tbody>
              @for (s of fila()?.aguardando ?? []; track s.id) {
                <tr>
                  <td><strong>{{ s.codigo }}</strong></td>
                  <td>{{ s.subservico }}</td>
                  <td>
                    <span class="etiqueta" [class.etiqueta--ambar]="s.prioridadeNivel > 0">{{ s.prioridade }}</span>
                  </td>
                  <td><span class="tempo" [class]="'tempo--' + faixaEspera(s)">{{ espera(s) }}</span></td>
                </tr>
              } @empty {
                <tr><td colspan="4" class="vazio">Ninguém aguardando. 🎉</td></tr>
              }
            </tbody>
          </table>
        </section>
      </div>
    }
  `,
  styles: [`
    .topo { display: flex; justify-content: space-between; align-items: end; gap: 16px; flex-wrap: wrap; margin-bottom: 22px;
      h2 { font-size: 24px; } .sub { color: var(--texto-3); margin: 4px 0 0; font-size: 14px; } }
    .escolhas { display: flex; gap: 8px;
      select { padding: 10px 12px; border: 1.5px solid var(--borda); border-radius: 8px; font: 14px var(--fonte); background-color: #fff; } }
    .aviso { text-align: center; color: var(--texto-2); padding: 34px;
      small { color: var(--texto-3); } }
    .grade { display: grid; grid-template-columns: 380px 1fr; gap: 16px;
      @media (max-width: 980px) { grid-template-columns: 1fr; } }
    .atual { h3 { font-size: 15px; margin-bottom: 14px; }
      .senha-atual { display: grid; gap: 6px; justify-items: center; text-align: center; margin-bottom: 18px;
        .codigo { font-size: 56px; font-weight: 800; color: var(--marinho); letter-spacing: .02em; }
        .sub-servico { color: var(--texto-2); } }
      .livre { color: var(--texto-3); text-align: center; margin: 20px 0; }
      .grande { width: 100%; padding: 16px; font-size: 16px; }
      .botoes { display: grid; gap: 8px;
        .transferir { padding: 9px 12px; border: 1.5px solid var(--borda); border-radius: 8px; font: 13.5px var(--fonte); } } }
    .fila h3 { font-size: 15px; margin-bottom: 12px; small { color: var(--texto-3); font-weight: 400; } }
    .vazio { color: var(--texto-3); text-align: center; padding: 22px !important; }

    /* Cronômetros do guichê */
    .cronometros { display: flex; gap: 10px; margin-top: 10px; }
    .crono { display: grid; gap: 2px; padding: 8px 16px; border: 1px solid var(--borda-2);
      border-radius: 8px; background: var(--fundo); min-width: 108px;
      small { font-size: 11px; letter-spacing: .04em; text-transform: uppercase; color: var(--texto-3); }
      strong { font-size: 22px; font-variant-numeric: tabular-nums; color: var(--azul-escuro); } }

    /* Espera na fila, por faixa de urgência */
    .tempo { font-variant-numeric: tabular-nums; font-weight: 600; font-size: 14.5px;
      padding: 3px 10px; border-radius: 99px; display: inline-block; }
    .tempo--ok { color: var(--verde); background: var(--verde-suave); }
    .tempo--atencao { color: var(--ambar); background: var(--ambar-suave); }
    .tempo--critico { color: var(--vermelho); background: var(--vermelho-suave); }
  `],
})
export class AtendimentoPagina implements OnInit, OnDestroy {
  private readonly api = inject(Api);
  private readonly auth = inject(Autenticacao);
  private readonly toasts = inject(Toasts);
  private readonly realtime = inject(Realtime);
  private timer: ReturnType<typeof setInterval> | null = null;
  private relogio: ReturnType<typeof setInterval> | null = null;

  /** Avança de segundo em segundo para os cronômetros correrem na tela. */
  private readonly agora = signal(Date.now());

  readonly unidades = signal<Unidade[]>([]);
  readonly guiches = signal<Guiche[]>([]);
  readonly fila = signal<FilaSnapshot | null>(null);
  readonly senhaAtual = signal<SenhaResumo | null>(null);
  readonly chamando = signal(false);
  readonly ehAdmin = this.auth.usuario()?.perfil === 'ADMIN';
  private me: MeuPerfil | null = null;

  unidadeId = '';
  guicheId = '';
  guicheDestino = '';

  async ngOnInit() {
    // /unidades já vem filtrada por lotação para quem não é admin
    const [unidades, me] = await Promise.all([
      this.api.get<Unidade[]>('/unidades'),
      this.api.get<MeuPerfil>('/auth/me'),
    ]);
    this.unidades.set(unidades);
    this.me = me;

    const salvo = localStorage.getItem(CHAVE_GUICHE);
    const memoria = salvo ? (JSON.parse(salvo) as { unidadeId: string; guicheId: string }) : null;
    if (memoria && unidades.some((u) => u.id === memoria.unidadeId)) {
      this.unidadeId = memoria.unidadeId;
      this.guicheId = memoria.guicheId;
    } else if (unidades.length === 1) {
      this.unidadeId = unidades[0].id;
    }
    if (this.unidadeId) await this.prepararUnidade();
    if (this.guicheId && !this.guichesDisponiveis().some((g) => g.id === this.guicheId)) {
      this.guicheId = '';
    }
    this.timer = setInterval(() => this.atualizar(), 30_000);
    this.relogio = setInterval(() => this.agora.set(Date.now()), 1_000);
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.relogio) clearInterval(this.relogio);
    this.realtime.desconectar();
  }

  nomeUnidade() {
    if (!this.unidadeId) return 'Escolha a unidade para atender';
    return this.unidades().find((u) => u.id === this.unidadeId)?.nome ?? '';
  }

  /** Atendente vê apenas os guichês liberados pelo gerente. */
  guichesDisponiveis() {
    const todos = this.guiches();
    if (this.auth.usuario()?.perfil !== 'ATENDENTE') return todos;
    const liberados = new Set(this.me?.guicheIds ?? []);
    return todos.filter((g) => liberados.has(g.id));
  }

  semGuicheLiberado() {
    return this.auth.usuario()?.perfil === 'ATENDENTE'
      && this.guiches().length > 0
      && this.guichesDisponiveis().length === 0;
  }

  outrosGuiches() {
    return this.guiches().filter((g) => g.id !== this.guicheId);
  }

  async trocarUnidade() {
    this.guicheId = '';
    this.senhaAtual.set(null);
    if (this.unidadeId) await this.prepararUnidade();
  }

  private async prepararUnidade() {
    const detalhe = await this.api.get<UnidadeDetalhe>(`/unidades/${this.unidadeId}`);
    this.guiches.set(detalhe.guiches.filter((g) => g.ativo));
    const socket = this.realtime.conectar(
      { accessToken: this.auth.accessToken ?? undefined },
      this.ehAdmin ? this.unidadeId : undefined,
    );
    socket.on('fila', (snapshot: FilaSnapshot) => {
      if (snapshot.unidadeId !== this.unidadeId) return; // multiunidade: só a tela atual
      this.fila.set(snapshot);
      this.sincronizarSenhaAtual(snapshot);
    });
    await this.atualizar();
  }

  async trocarGuiche() {
    localStorage.setItem(CHAVE_GUICHE, JSON.stringify({ unidadeId: this.unidadeId, guicheId: this.guicheId }));
    await this.atualizar();
  }

  private async atualizar() {
    if (!this.unidadeId) return;
    this.fila.set(await this.api.get<FilaSnapshot>(`/fila?unidadeId=${this.unidadeId}`));
    if (this.guicheId) {
      this.senhaAtual.set(await this.api.get<SenhaResumo | null>(`/fila/guiche/${this.guicheId}/atual`));
    }
  }

  private sincronizarSenhaAtual(snapshot: FilaSnapshot) {
    if (!this.guicheId) return;
    const numero = this.guiches().find((g) => g.id === this.guicheId)?.numero;
    const minha = [...snapshot.emAtendimento, ...snapshot.ultimasChamadas]
      .find((s) => (s.status === 'CHAMADA' || s.status === 'EM_ATENDIMENTO') && s.guiche === numero);
    this.senhaAtual.set(minha ?? null);
  }

  async chamarProxima() {
    this.chamando.set(true);
    try {
      await this.api.post('/fila/chamar', { guicheId: this.guicheId });
      await this.atualizar();
    } catch (e) {
      this.toasts.erro(mensagemDeErro(e));
    } finally {
      this.chamando.set(false);
    }
  }

  async acao(s: SenhaResumo, verbo: 'iniciar' | 'rechamar' | 'finalizar' | 'ausente') {
    try {
      await this.api.post(`/fila/${s.id}/${verbo}`);
      if (verbo === 'finalizar') this.toasts.sucesso(`Atendimento da ${s.codigo} finalizado.`);
      await this.atualizar();
    } catch (e) {
      this.toasts.erro(mensagemDeErro(e));
    }
  }

  async transferir(s: SenhaResumo) {
    if (!this.guicheDestino) return;
    const destino = this.guicheDestino;
    this.guicheDestino = '';
    try {
      await this.api.post(`/fila/${s.id}/transferir`, { guicheId: destino });
      this.toasts.sucesso(`Senha ${s.codigo} transferida.`);
      await this.atualizar();
    } catch (e) {
      this.toasts.erro(mensagemDeErro(e));
    }
  }

  /** Segundos decorridos desde uma data — reage ao relógio (atualiza a cada 1s). */
  private decorridos(desde: string | null | undefined): number {
    if (!desde) return 0;
    return Math.max(0, Math.floor((this.agora() - new Date(desde).getTime()) / 1000));
  }

  private formatar(seg: number): string {
    const h = Math.floor(seg / 3600);
    const m = Math.floor((seg % 3600) / 60);
    const s = seg % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  /** Tempo que o cidadão está aguardando na fila (desde a emissão). */
  espera(s: SenhaResumo): string {
    return this.formatar(this.decorridos(s.emitidaEm));
  }

  /**
   * Faixa de urgência da espera, para colorir o cronômetro:
   * até 10 min normal, 10–20 atenção, acima de 20 crítico.
   */
  faixaEspera(s: SenhaResumo): 'ok' | 'atencao' | 'critico' {
    const min = this.decorridos(s.emitidaEm) / 60;
    if (min >= 20) return 'critico';
    if (min >= 10) return 'atencao';
    return 'ok';
  }

  /** Cronômetro da senha no guichê: desde a chamada ou desde o início do atendimento. */
  tempoNoGuiche(s: SenhaResumo): string {
    return this.formatar(this.decorridos(s.status === 'CHAMADA' ? s.chamadaEm : s.iniciadaEm ?? s.chamadaEm));
  }

  /** Quanto o cidadão esperou da emissão até ser chamado (não corre mais). */
  esperaAteChamada(s: SenhaResumo): string {
    if (!s.chamadaEm) return this.espera(s);
    const seg = Math.max(0, Math.floor((new Date(s.chamadaEm).getTime() - new Date(s.emitidaEm).getTime()) / 1000));
    return this.formatar(seg);
  }
}
