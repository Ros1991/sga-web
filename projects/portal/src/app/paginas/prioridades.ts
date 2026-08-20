import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, NivelPrioridade, Toasts, mensagemDeErro } from 'compartilhado';

@Component({
  selector: 'pagina-prioridades',
  imports: [FormsModule],
  template: `
    <header class="topo">
      <div>
        <h2>Níveis de prioridade</h2>
        <p class="sub">Quanto maior o nível, antes a senha é chamada</p>
      </div>
      <button class="botao" (click)="abrirNovo()">+ Novo nível</button>
    </header>

    <div class="cartao">
      <table class="tabela">
        <thead><tr><th>Nome</th><th>Nível</th><th>Sufixo na senha</th><th>Situação</th><th></th></tr></thead>
        <tbody>
          @for (p of prioridades(); track p.id) {
            <tr>
              <td><strong>{{ p.nome }}</strong></td>
              <td>{{ p.nivel }}</td>
              <td>{{ p.prefixo || '—' }}</td>
              <td>
                <span class="etiqueta" [class.etiqueta--verde]="p.ativo" [class.etiqueta--cinza]="!p.ativo">
                  {{ p.ativo ? 'Ativo' : 'Inativo' }}
                </span>
              </td>
              <td class="direita"><button class="botao botao--fantasma" (click)="abrirEdicao(p)">Editar</button></td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    @if (modal()) {
      <div class="modal-fundo" (click)="modal.set(false)">
        <form class="modal" (click)="$event.stopPropagation()" (ngSubmit)="salvar()">
          <header><h3>{{ editando ? 'Editar nível' : 'Novo nível' }}</h3></header>
          <div class="campo"><label>Nome *</label><input [(ngModel)]="form.nome" name="nome" required /></div>
          <div class="linha">
            <div class="campo">
              <label>Nível (0–99) *</label>
              <input type="number" [(ngModel)]="form.nivel" name="nivel" min="0" max="99" required />
            </div>
            <div class="campo">
              <label>Sufixo (até 2 letras)</label>
              <input [(ngModel)]="form.prefixo" name="prefixo" maxlength="2" style="text-transform: uppercase" />
            </div>
          </div>
          @if (editando) {
            <div class="campo"><label>Situação</label>
              <select [(ngModel)]="form.ativo" name="ativo">
                <option [ngValue]="true">Ativo</option><option [ngValue]="false">Inativo</option>
              </select>
            </div>
          }
          <div class="acoes-modal">
            <button type="button" class="botao botao--fantasma" (click)="modal.set(false)">Cancelar</button>
            <button class="botao">Salvar</button>
          </div>
        </form>
      </div>
    }
  `,
  styles: [`
    .topo { display: flex; justify-content: space-between; align-items: end; margin-bottom: 22px;
      h2 { font-size: 24px; } .sub { color: var(--texto-3); margin: 4px 0 0; font-size: 14px; } }
    .direita { text-align: right; }
    .linha { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  `],
})
export class PrioridadesPagina implements OnInit {
  private readonly api = inject(Api);
  private readonly toasts = inject(Toasts);

  readonly prioridades = signal<NivelPrioridade[]>([]);
  readonly modal = signal(false);
  editando: NivelPrioridade | null = null;
  form = { nome: '', nivel: 0, prefixo: '', ativo: true };

  async ngOnInit() {
    await this.carregar();
  }

  async carregar() {
    this.prioridades.set(await this.api.get<NivelPrioridade[]>('/prioridades'));
  }

  abrirNovo() {
    this.editando = null;
    this.form = { nome: '', nivel: 1, prefixo: '', ativo: true };
    this.modal.set(true);
  }

  abrirEdicao(p: NivelPrioridade) {
    this.editando = p;
    this.form = { nome: p.nome, nivel: p.nivel, prefixo: p.prefixo, ativo: p.ativo };
    this.modal.set(true);
  }

  async salvar() {
    try {
      if (this.editando) {
        await this.api.put(`/prioridades/${this.editando.id}`, this.form);
      } else {
        await this.api.post('/prioridades', this.form);
      }
      this.toasts.sucesso('Nível salvo.');
      this.modal.set(false);
      await this.carregar();
    } catch (e) {
      this.toasts.erro(mensagemDeErro(e));
    }
  }
}
