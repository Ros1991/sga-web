import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Api, Autenticacao, NivelPrioridade, Senha, Toasts, Unidade, UnidadeDetalhe, mensagemDeErro,
} from 'compartilhado';
import * as QRCode from 'qrcode';

@Component({
  selector: 'pagina-emitir',
  imports: [FormsModule],
  template: `
    <header class="topo">
      <div>
        <h2>Emitir senha</h2>
        <p class="sub">Emissão assistida — mesma fila do totem</p>
      </div>
      @if (unidades().length > 1) {
        <select [(ngModel)]="unidadeId" (ngModelChange)="carregarUnidade()">
          <option value="">Escolha a unidade…</option>
          @for (u of unidades(); track u.id) { <option [value]="u.id">{{ u.nome }}</option> }
        </select>
      }
    </header>

    @if (emitida(); as s) {
      <div class="cartao resultado">
        <p>Senha emitida:</p>
        <span class="codigo">{{ s.codigo }}</span>
        <p class="detalhe">
          @if (servicoDaSenha(s); as servico) { {{ servico }} › }{{ s.subservico?.nome }} · {{ s.prioridade?.nome }}
        </p>
        @if (qrAvaliacao(); as qr) {
          <div class="avaliacao">
            <img [src]="qr" alt="QR code para avaliar o atendimento" />
            <p>O cidadão escaneia agora e a avaliação abre no celular dele quando o atendimento terminar.</p>
          </div>
        }
        <button class="botao" (click)="emitida.set(null); qrAvaliacao.set(null)">Emitir outra</button>
      </div>
    } @else if (unidadeId) {
      <div class="cartao">
        <div class="passo">
          <h3>1. Serviço</h3>
          <!-- Agrupado por serviço: subserviços de serviços diferentes podem ter o mesmo nome. -->
          @for (g of grupos(); track g.id) {
            <div class="grupo">
              <span class="grupo__nome">{{ g.nome }}</span>
              <div class="opcoes">
                @for (sub of g.subservicos; track sub.id) {
                  <button class="opcao" [class.marcada]="subservicoId === sub.id" (click)="subservicoId = sub.id">
                    {{ sub.nome }}
                  </button>
                }
              </div>
            </div>
          } @empty {
            <p class="dica">Esta unidade não oferta subserviços ainda.</p>
          }
        </div>
        <div class="passo">
          <h3>2. Prioridade</h3>
          <div class="opcoes">
            @for (p of prioridades(); track p.id) {
              <button class="opcao" [class.marcada]="prioridadeId === p.id" (click)="prioridadeId = p.id">
                {{ p.nome }}
              </button>
            }
          </div>
        </div>
        <button class="botao grande" (click)="emitir()" [disabled]="!subservicoId || !prioridadeId || emitindo()">
          {{ emitindo() ? 'Emitindo…' : '🎫 Emitir senha' }}
        </button>
      </div>
    } @else {
      <div class="cartao dica centro">Escolha a unidade para emitir senhas.</div>
    }
  `,
  styles: [`
    .topo { display: flex; justify-content: space-between; align-items: end; margin-bottom: 22px;
      h2 { font-size: 24px; } .sub { color: var(--texto-3); margin: 4px 0 0; font-size: 14px; }
      select { padding: 10px 12px; border: 1.5px solid var(--borda); border-radius: 8px; font: 14px var(--fonte); background-color: #fff; } }
    .passo { margin-bottom: 20px; h3 { font-size: 14px; color: var(--texto-2); margin-bottom: 10px; } }
    .grupo { margin-bottom: 14px; &:last-child { margin-bottom: 0; } }
    .grupo__nome { display: block; font: 600 12px var(--fonte); letter-spacing: .05em; text-transform: uppercase;
      color: var(--texto-3); margin-bottom: 6px; }
    .opcoes { display: flex; flex-wrap: wrap; gap: 8px; }
    .opcao { border: 1.5px solid var(--borda); background: #fff; border-radius: 10px; padding: 12px 18px;
      font: 600 14px var(--fonte); cursor: pointer; color: var(--texto);
      &.marcada { border-color: var(--azul); background: var(--azul-suave); color: var(--azul-escuro); } }
    .grande { padding: 14px 26px; font-size: 15px; }
    .resultado { text-align: center; padding: 40px; display: grid; gap: 10px; justify-items: center;
      .codigo { font-size: 84px; font-weight: 800; color: var(--marinho); }
      .detalhe { color: var(--texto-2); } }
    .avaliacao { display: flex; align-items: center; gap: 16px; max-width: 460px; margin: 6px 0 8px; padding: 12px 18px 12px 12px;
      border: 1px solid var(--borda); border-radius: 12px; text-align: left;
      img { width: 120px; height: 120px; flex: none; background: #fff; }
      p { margin: 0; font-size: 13.5px; color: var(--texto-2); } }
    .dica { color: var(--texto-3); }
    .centro { text-align: center; padding: 34px; }
  `],
})
export class EmitirPagina implements OnInit {
  private readonly api = inject(Api);
  private readonly auth = inject(Autenticacao);
  private readonly toasts = inject(Toasts);

  readonly unidades = signal<Unidade[]>([]);
  /** Subserviços ofertados na unidade, agrupados pelo serviço a que pertencem. */
  readonly grupos = signal<{ id: string; nome: string; subservicos: { id: string; nome: string }[] }[]>([]);
  readonly prioridades = signal<NivelPrioridade[]>([]);
  readonly emitida = signal<Senha | null>(null);
  /** QR da avaliação daquela senha — o mesmo que o totem imprime. */
  readonly qrAvaliacao = signal<string | null>(null);
  readonly emitindo = signal(false);
  readonly ehAdmin = this.auth.usuario()?.perfil === 'ADMIN';

  unidadeId = '';
  subservicoId = '';
  prioridadeId = '';

  async ngOnInit() {
    this.prioridades.set((await this.api.get<NivelPrioridade[]>('/prioridades')).filter((p) => p.ativo).sort((a, b) => b.nivel - a.nivel));
    // /unidades já vem filtrada por lotação para quem não é admin
    this.unidades.set(await this.api.get<Unidade[]>('/unidades'));
    if (this.unidades().length === 1) {
      this.unidadeId = this.unidades()[0].id;
      await this.carregarUnidade();
    }
    // Semântica do DETRAN: menor nível = mais prioritário; o padrão é o de MAIOR nível (público em geral)
    const padrao = this.prioridades()[0];
    if (padrao) this.prioridadeId = padrao.id;
  }

  async carregarUnidade() {
    this.subservicoId = '';
    this.grupos.set([]);
    if (!this.unidadeId) return;
    const detalhe = await this.api.get<UnidadeDetalhe>(`/unidades/${this.unidadeId}`);
    const porServico = new Map<string, { id: string; nome: string; subservicos: { id: string; nome: string }[] }>();
    for (const s of detalhe.subservicos) {
      // Fica de fora o que está desativado, no subserviço ou no serviço inteiro.
      if (!s.ativo || s.servico?.ativo === false) continue;
      const grupo = porServico.get(s.servicoId) ?? { id: s.servicoId, nome: s.servico?.nome ?? 'Outros', subservicos: [] };
      grupo.subservicos.push({ id: s.id, nome: s.nome });
      porServico.set(s.servicoId, grupo);
    }
    const ordem = (a: { nome: string }, b: { nome: string }) => a.nome.localeCompare(b.nome, 'pt-BR');
    this.grupos.set([...porServico.values()].sort(ordem).map((g) => ({ ...g, subservicos: g.subservicos.sort(ordem) })));
  }

  /** Nome do serviço da senha emitida, para o resultado não ficar ambíguo. */
  servicoDaSenha(s: Senha): string | null {
    const id = s.subservico?.id;
    return this.grupos().find((g) => g.subservicos.some((x) => x.id === id))?.nome ?? null;
  }

  async emitir() {
    this.emitindo.set(true);
    try {
      const senha = await this.api.post<Senha>('/fila/emitir', {
        unidadeId: this.unidadeId,
        subservicoId: this.subservicoId,
        prioridadeId: this.prioridadeId,
      });
      this.qrAvaliacao.set(
        senha.avaliacaoUrl ? await QRCode.toDataURL(senha.avaliacaoUrl, { width: 360, margin: 1 }).catch(() => null) : null,
      );
      this.emitida.set(senha);
      this.subservicoId = '';
    } catch (e) {
      this.toasts.erro(mensagemDeErro(e));
    } finally {
      this.emitindo.set(false);
    }
  }
}
