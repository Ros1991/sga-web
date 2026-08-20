import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, Autenticacao, DashboardResumo, Toasts, Unidade, mensagemDeErro } from 'compartilhado';

@Component({
  selector: 'pagina-dashboard',
  imports: [FormsModule],
  template: `
    <header class="topo">
      <div>
        <h2>Visão geral</h2>
        <p class="sub">Acompanhamento do atendimento em tempo real</p>
      </div>
      <div class="filtros">
        @if (ehAdmin || unidades().length > 1) {
          <select [(ngModel)]="unidadeId" (ngModelChange)="carregar()">
            <option value="">{{ ehAdmin ? "Todas as unidades" : "Todas as minhas unidades" }}</option>
            @for (u of unidades(); track u.id) {
              <option [value]="u.id">{{ u.nome }}</option>
            }
          </select>
        }
        <input type="date" [(ngModel)]="de" (ngModelChange)="carregar()" />
        <input type="date" [(ngModel)]="ate" (ngModelChange)="carregar()" />
      </div>
    </header>

    @if (resumo(); as r) {
      <div class="cartoes">
        <div class="cartao kpi"><small>Senhas emitidas</small><strong>{{ r.totais.emitidas }}</strong></div>
        <div class="cartao kpi"><small>Atendimentos finalizados</small><strong class="verde">{{ r.totais.finalizadas }}</strong></div>
        <div class="cartao kpi"><small>Aguardando agora</small><strong class="azul">{{ r.totais.aguardando }}</strong></div>
        <div class="cartao kpi"><small>Ausências</small><strong class="ambar">{{ r.totais.ausentes }}</strong></div>
        <div class="cartao kpi"><small>Tempo médio de espera</small><strong>{{ tempo(r.tempoMedioEsperaSeg) }}</strong></div>
        <div class="cartao kpi"><small>Tempo médio de atendimento</small><strong>{{ tempo(r.tempoMedioAtendimentoSeg) }}</strong></div>
      </div>

      <div class="duas">
        <div class="cartao">
          <h3>Por subserviço</h3>
          @if (r.porSubservico.length) {
            <table class="tabela">
              <thead><tr><th>Subserviço</th><th>Emitidas</th><th>Finalizadas</th></tr></thead>
              <tbody>
                @for (linha of r.porSubservico; track linha.nome) {
                  <tr><td>{{ linha.nome }}</td><td>{{ linha.emitidas }}</td><td>{{ linha.finalizadas }}</td></tr>
                }
              </tbody>
            </table>
          } @else {
            <p class="vazio">Nenhuma senha no período.</p>
          }
        </div>
        <div class="cartao">
          <h3>Por atendente</h3>
          @if (r.porAtendente.length) {
            <table class="tabela">
              <thead><tr><th>Atendente</th><th>Finalizados</th></tr></thead>
              <tbody>
                @for (linha of r.porAtendente; track linha.nome) {
                  <tr><td>{{ linha.nome }}</td><td>{{ linha.finalizadas }}</td></tr>
                }
              </tbody>
            </table>
          } @else {
            <p class="vazio">Nenhum atendimento finalizado no período.</p>
          }
        </div>
      </div>
    } @else {
      <p class="vazio">Carregando…</p>
    }
  `,
  styles: [`
    .topo { display: flex; justify-content: space-between; align-items: end; gap: 16px; flex-wrap: wrap; margin-bottom: 22px;
      h2 { font-size: 24px; } .sub { color: var(--texto-3); margin: 4px 0 0; font-size: 14px; } }
    .filtros { display: flex; gap: 8px;
      select, input { padding: 9px 12px; border: 1.5px solid var(--borda); border-radius: 8px; font: 14px var(--fonte); background-color: #fff; } }
    .cartoes { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 14px; margin-bottom: 22px; }
    .kpi { display: grid; gap: 6px; padding: 18px;
      small { color: var(--texto-3); font-size: 12.5px; }
      strong { font-size: 30px; font-weight: 700; }
      .verde { color: var(--verde); } .azul { color: var(--azul); } .ambar { color: var(--ambar); } }
    .duas { display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
      h3 { font-size: 15px; margin-bottom: 12px; }
      @media (max-width: 900px) { grid-template-columns: 1fr; } }
    .vazio { color: var(--texto-3); }
  `],
})
export class DashboardPagina implements OnInit, OnDestroy {
  private readonly api = inject(Api);
  private readonly auth = inject(Autenticacao);
  private readonly toasts = inject(Toasts);
  private timer: ReturnType<typeof setInterval> | null = null;

  readonly resumo = signal<DashboardResumo | null>(null);
  readonly unidades = signal<Unidade[]>([]);
  readonly ehAdmin = this.auth.usuario()?.perfil === 'ADMIN';

  unidadeId = '';
  de = '';
  ate = '';

  async ngOnInit() {
    this.unidades.set(await this.api.get<Unidade[]>('/unidades'));
    await this.carregar();
    this.timer = setInterval(() => this.carregar(), 60_000);
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async carregar() {
    try {
      const filtros = new URLSearchParams();
      if (this.unidadeId) filtros.set('unidadeId', this.unidadeId);
      if (this.de) filtros.set('de', this.de);
      if (this.ate) filtros.set('ate', this.ate);
      const sufixo = filtros.toString() ? `?${filtros}` : '';
      this.resumo.set(await this.api.get<DashboardResumo>(`/dashboard${sufixo}`));
    } catch (e) {
      this.toasts.erro(mensagemDeErro(e));
    }
  }

  tempo(segundos: number | null): string {
    if (segundos === null) return '—';
    const m = Math.floor(segundos / 60);
    const s = segundos % 60;
    return m ? `${m}min ${String(s).padStart(2, '0')}s` : `${s}s`;
  }
}
