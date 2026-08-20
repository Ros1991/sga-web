import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Api, Autenticacao, FilaSnapshot, Guiche, Realtime, SenhaResumo, Toasts,
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
        @if (ehAdmin) {
          <select [(ngModel)]="unidadeId" (ngModelChange)="trocarUnidade()">
            <option value="">Escolha a unidade…</option>
            @for (u of unidades(); track u.id) { <option [value]="u.id">{{ u.nome }}</option> }
          </select>
        }
        <select [(ngModel)]="guicheId" (ngModelChange)="trocarGuiche()">
          <option value="">Escolha o guichê…</option>
          @for (g of guiches(); track g.id) { <option [value]="g.id">Guichê {{ g.numero }}</option> }
        </select>
      </div>
    </header>

    @if (!guicheId) {
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
                  <td>{{ espera(s) }}</td>
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
      select { padding: 10px 12px; border: 1.5px solid var(--borda); border-radius: 8px; font: 14px var(--fonte); background: #fff; } }
    .aviso { text-align: center; color: var(--texto-2); padding: 34px; }
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
  `],
})
export class AtendimentoPagina implements OnInit, OnDestroy {
  private readonly api = inject(Api);
  private readonly auth = inject(Autenticacao);
  private readonly toasts = inject(Toasts);
  private readonly realtime = inject(Realtime);
  private timer: ReturnType<typeof setInterval> | null = null;

  readonly unidades = signal<Unidade[]>([]);
  readonly guiches = signal<Guiche[]>([]);
  readonly fila = signal<FilaSnapshot | null>(null);
  readonly senhaAtual = signal<SenhaResumo | null>(null);
  readonly chamando = signal(false);
  readonly ehAdmin = this.auth.usuario()?.perfil === 'ADMIN';

  unidadeId = '';
  guicheId = '';
  guicheDestino = '';

  async ngOnInit() {
    if (this.ehAdmin) {
      this.unidades.set(await this.api.get<Unidade[]>('/unidades'));
    } else {
      this.unidadeId = this.auth.usuario()?.unidadeId ?? '';
    }
    const salvo = localStorage.getItem(CHAVE_GUICHE);
    if (salvo) {
      const { unidadeId, guicheId } = JSON.parse(salvo);
      if (this.ehAdmin) this.unidadeId = unidadeId;
      if (unidadeId === this.unidadeId) this.guicheId = guicheId;
    }
    if (this.unidadeId) await this.prepararUnidade();
    this.timer = setInterval(() => this.atualizar(), 30_000);
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.realtime.desconectar();
  }

  nomeUnidade() {
    if (!this.unidadeId) return 'Escolha a unidade para atender';
    return this.unidades().find((u) => u.id === this.unidadeId)?.nome
      ?? 'Fila e chamadas da sua unidade';
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
    const sufixo = this.ehAdmin ? `?unidadeId=${this.unidadeId}` : '';
    this.fila.set(await this.api.get<FilaSnapshot>(`/fila${sufixo}`));
    if (this.guicheId) {
      this.senhaAtual.set(await this.api.get<SenhaResumo | null>(`/fila/guiche/${this.guicheId}/atual`));
    }
  }

  private sincronizarSenhaAtual(snapshot: FilaSnapshot) {
    if (!this.guicheId) return;
    const minha = [...snapshot.emAtendimento, ...snapshot.ultimasChamadas]
      .find((s) => (s.status === 'CHAMADA' || s.status === 'EM_ATENDIMENTO') &&
        s.guiche === this.guiches().find((g) => g.id === this.guicheId)?.numero);
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

  espera(s: SenhaResumo): string {
    const seg = Math.floor((Date.now() - new Date(s.emitidaEm).getTime()) / 1000);
    const m = Math.floor(seg / 60);
    return m ? `${m} min` : `${seg}s`;
  }
}
