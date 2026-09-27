import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Api,
  CatalogoRelatorios,
  ChaveFiltroRelatorio,
  DefinicaoRelatorio,
  ResultadoRelatorio,
  Servico,
  Toasts,
  Unidade,
  mensagemDeErro,
} from 'compartilhado';

/**
 * Relatórios — porte da tela `/reports` do SGA antigo.
 * O catálogo (tipos, filtros liberados e colunas) vem da API; aqui só se monta a tela.
 */
@Component({
  selector: 'pagina-relatorios',
  imports: [FormsModule],
  template: `
    <header class="topo">
      <div>
        <h2>Relatórios</h2>
        <p class="sub">{{ definicao()?.descricao ?? 'Extrações de atendimento por período, unidade e serviço' }}</p>
      </div>
      <div class="campo tipo">
        <label>Tipo de relatório</label>
        <select [ngModel]="tipo()" (ngModelChange)="trocarTipo($event)">
          @for (r of catalogo()?.relatorios ?? []; track r.chave) {
            <option [value]="r.chave">{{ r.nome }}{{ r.disponivel ? '' : ' (indisponível)' }}</option>
          }
        </select>
      </div>
    </header>

    @if (definicao(); as d) {
      <div class="cartao filtros">
        <div class="grade">
          @if (mostra('de')) {
            <div class="campo"><label>Data inicial</label><input type="date" [(ngModel)]="de" /></div>
          }
          @if (mostra('ate')) {
            <div class="campo"><label>Data final</label><input type="date" [(ngModel)]="ate" /></div>
          }
          @if (mostra('horaDe')) {
            <div class="campo"><label>Hora inicial</label><input type="time" [(ngModel)]="horaDe" /></div>
          }
          @if (mostra('horaAte')) {
            <div class="campo"><label>Hora final</label><input type="time" [(ngModel)]="horaAte" /></div>
          }
          @if (mostra('status')) {
            <div class="campo">
              <label>Status</label>
              <select [(ngModel)]="status">
                <option value="">Todos</option>
                @for (o of catalogo()?.opcoesStatus ?? []; track o.chave) {
                  <option [value]="o.chave">{{ o.rotulo }}</option>
                }
              </select>
            </div>
          }
        </div>

        @if (mostra('unidadeIds')) {
          <div class="campo">
            <label>Unidades</label>
            <div class="fichas">
              @for (u of unidades(); track u.id) {
                <button type="button" class="ficha" [class.marcada]="unidadesSel().has(u.id)" (click)="alternar(unidadesSel, u.id)">
                  {{ u.nome }}
                </button>
              } @empty { <span class="dica">Nenhuma unidade disponível.</span> }
            </div>
          </div>
        }

        @if (mostra('subservicoIds')) {
          <div class="campo">
            <label>Serviços</label>
            <div class="fichas rolavel">
              @for (s of subservicos(); track s.id) {
                <button type="button" class="ficha" [class.marcada]="subservicosSel().has(s.id)" (click)="alternar(subservicosSel, s.id)">
                  {{ s.nome }}<small>{{ s.servico }}</small>
                </button>
              } @empty { <span class="dica">Nenhum serviço cadastrado.</span> }
            </div>
          </div>
        }

        <div class="acoes">
          @if (mostra('de')) {
            <span class="dica">Sem datas informadas, o período é o dia de hoje.</span>
          }
          <span class="espaco"></span>
          <button class="botao botao--fantasma" (click)="limpar()">Limpar filtros</button>
          <button class="botao" [disabled]="!d.disponivel || carregando()" (click)="carregar(1)">
            {{ carregando() ? 'Consultando…' : 'Filtrar' }}
          </button>
        </div>
      </div>

      @if (!d.disponivel) {
        <div class="cartao aviso">
          <h3>Relatório ainda não disponível</h3>
          <p>{{ d.indisponivelPorque }}</p>
          <p class="dica">
            As colunas previstas são: {{ colunasPrevistas(d) }}. Para ligá-lo, o atendimento precisa registrar uma
            avaliação por senha.
          </p>
        </div>
      } @else if (resultado(); as r) {
        @if (r.resumo.length) {
          <div class="resumo">
            @for (item of r.resumo; track item.rotulo) {
              <div class="cartao kpi"><small>{{ item.rotulo }}</small><strong>{{ item.valor }}</strong></div>
            }
          </div>
        }

        <div class="cartao">
          <div class="rolagem">
            <table class="tabela">
              <thead>
                <tr>
                  @for (c of r.colunas; track c.chave) {
                    <th [class.direita]="c.numerica">{{ c.rotulo }}</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (linha of r.linhas; track $index) {
                  <tr [class.total]="ehTotal(linha)">
                    @for (c of r.colunas; track c.chave) {
                      <td [class.direita]="c.numerica">{{ linha[c.chave] || '—' }}</td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>

          @if (!r.linhas.length) {
            <!-- Fora da tabela: dentro dela a mensagem sumiria na rolagem horizontal. -->
            <p class="vazio">Nenhum registro para os filtros informados.</p>
          }

          @if (r.total) {
            <div class="paginacao">
              <span class="dica">{{ r.total }} registro(s) — página {{ r.pagina }} de {{ r.paginas }}</span>
              <span class="espaco"></span>
              <select [(ngModel)]="porPagina" (ngModelChange)="carregar(1)">
                @for (n of [10, 20, 50, 100]; track n) { <option [ngValue]="n">{{ n }} por página</option> }
              </select>
              <button class="botao botao--fantasma" [disabled]="r.pagina <= 1" (click)="carregar(r.pagina - 1)">Anterior</button>
              <button class="botao botao--fantasma" [disabled]="r.pagina >= r.paginas" (click)="carregar(r.pagina + 1)">Próxima</button>
            </div>
          }
        </div>
      } @else {
        <p class="vazio">Carregando…</p>
      }
    }
  `,
  styles: [`
    .topo { display: flex; justify-content: space-between; align-items: end; gap: 16px; flex-wrap: wrap; margin-bottom: 18px;
      h2 { font-size: 24px; } .sub { color: var(--texto-3); margin: 4px 0 0; font-size: 14px; max-width: 60ch; } }
    .tipo { min-width: 280px; margin: 0; }

    .filtros { margin-bottom: 18px; display: grid; gap: 14px; }
    .grade { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 14px;
      .campo { margin: 0; } }

    .fichas { display: flex; flex-wrap: wrap; gap: 8px;
      &.rolavel { max-height: 132px; overflow-y: auto; padding-right: 4px; } }
    .ficha { display: inline-flex; align-items: baseline; gap: 6px; cursor: pointer;
      border: 1px solid var(--borda); background: var(--superficie); color: var(--texto-2);
      border-radius: 999px; padding: 6px 13px; font: 13px var(--fonte);
      small { color: var(--texto-3); font-size: 11px; }
      &:hover { border-color: var(--azul); color: var(--azul); }
      &.marcada { background: var(--azul-suave); border-color: var(--azul-borda); color: var(--azul); font-weight: 500;
        small { color: var(--azul); } } }

    .acoes { display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
      border-top: 1px solid var(--borda-2); padding-top: 14px; }
    .espaco { flex: 1; }
    .dica { color: var(--texto-3); font-size: 12.5px; }

    .aviso { border-left: 3px solid var(--ambar-vivo);
      h3 { font-size: 15px; margin-bottom: 8px; }
      p { color: var(--texto-2); font-size: 14px; margin: 0 0 8px; max-width: 80ch; } }

    .resumo { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px; margin-bottom: 14px; }
    .kpi { display: grid; gap: 6px; padding: 16px;
      small { color: var(--texto-3); font-size: 12.5px; }
      strong { font-size: 24px; font-weight: 700; } }

    .rolagem { overflow-x: auto; }
    .tabela { min-width: 100%; white-space: nowrap;
      td, th { font-size: 13px; }
      .direita { text-align: right; }
      tr.total td { font-weight: 600; color: var(--azul-escuro); background: var(--fundo); } }

    .paginacao { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding-top: 14px;
      select { padding: 7px 10px; border: 1px solid var(--borda); border-radius: var(--raio); font: 13px var(--fonte);
        background-color: var(--superficie); } }
    .vazio { color: var(--texto-3); text-align: center; padding: 22px; }
  `],
})
export class RelatoriosPagina implements OnInit {
  private readonly api = inject(Api);
  private readonly toasts = inject(Toasts);

  readonly catalogo = signal<CatalogoRelatorios | null>(null);
  readonly unidades = signal<Unidade[]>([]);
  readonly subservicos = signal<{ id: string; nome: string; servico: string }[]>([]);
  readonly resultado = signal<ResultadoRelatorio | null>(null);
  readonly carregando = signal(false);

  readonly unidadesSel = signal(new Set<string>());
  readonly subservicosSel = signal(new Set<string>());

  readonly tipo = signal('atendimentos');
  de = '';
  ate = '';
  horaDe = '';
  horaAte = '';
  status = '';
  porPagina = 20;

  readonly definicao = computed(() => this.catalogo()?.relatorios.find((r) => r.chave === this.tipo()) ?? null);

  async ngOnInit() {
    try {
      const [catalogo, unidades, servicos] = await Promise.all([
        this.api.get<CatalogoRelatorios>('/relatorios'),
        this.api.get<Unidade[]>('/unidades'),
        this.api.get<Servico[]>('/servicos'),
      ]);
      this.catalogo.set(catalogo);
      this.unidades.set(unidades);
      this.subservicos.set(
        servicos.flatMap((s) => (s.subservicos ?? []).map((sub) => ({ id: sub.id, nome: sub.nome, servico: s.nome }))),
      );
      await this.carregar(1);
    } catch (e) {
      this.toasts.erro(mensagemDeErro(e));
    }
  }

  mostra(filtro: ChaveFiltroRelatorio): boolean {
    return this.definicao()?.filtros.includes(filtro) ?? false;
  }

  /** Trocar de relatório zera a tabela: cada um tem colunas e filtros próprios. */
  async trocarTipo(chave: string) {
    this.tipo.set(chave);
    this.resultado.set(null);
    if (this.definicao()?.disponivel) await this.carregar(1);
  }

  alternar(alvo: typeof this.unidadesSel, id: string) {
    const copia = new Set(alvo());
    copia.has(id) ? copia.delete(id) : copia.add(id);
    alvo.set(copia);
  }

  limpar() {
    this.de = this.ate = this.horaDe = this.horaAte = this.status = '';
    this.unidadesSel.set(new Set());
    this.subservicosSel.set(new Set());
    this.carregar(1);
  }

  async carregar(pagina: number) {
    const definicao = this.definicao();
    if (!definicao?.disponivel) return;

    this.carregando.set(true);
    try {
      const q = new URLSearchParams();
      const usa = (f: ChaveFiltroRelatorio) => definicao.filtros.includes(f);
      if (usa('de') && this.de) q.set('de', this.de);
      if (usa('ate') && this.ate) q.set('ate', this.ate);
      if (usa('horaDe') && this.horaDe) q.set('horaDe', this.horaDe);
      if (usa('horaAte') && this.horaAte) q.set('horaAte', this.horaAte);
      if (usa('status') && this.status) q.set('status', this.status);
      if (usa('unidadeIds') && this.unidadesSel().size) q.set('unidadeIds', [...this.unidadesSel()].join(','));
      if (usa('subservicoIds') && this.subservicosSel().size) q.set('subservicoIds', [...this.subservicosSel()].join(','));
      q.set('pagina', String(pagina));
      q.set('porPagina', String(this.porPagina));

      this.resultado.set(await this.api.get<ResultadoRelatorio>(`/relatorios/${this.tipo()}?${q}`));
    } catch (e) {
      this.toasts.erro(mensagemDeErro(e));
    } finally {
      this.carregando.set(false);
    }
  }

  /** Linha de fechamento dos relatórios agregados (mesma convenção do sistema antigo). */
  ehTotal(linha: Record<string, string | number>): boolean {
    return Object.values(linha).includes('TOTAL');
  }

  colunasPrevistas(d: DefinicaoRelatorio): string {
    return d.colunas.map((c) => c.rotulo).join(', ');
  }
}
