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
        <p class="sub">Quanto MENOR o nível, antes a senha é chamada</p>
      </div>
      <button class="botao" (click)="abrirNovo()">+ Novo nível</button>
    </header>

    <div class="cartao">
      <table class="tabela">
        <thead><tr><th>Nome</th><th>Nível</th><th>Cor no painel</th><th>Sufixo na senha</th><th>Situação</th><th></th></tr></thead>
        <tbody>
          @for (p of prioridades(); track p.id) {
            <tr>
              <td><strong>{{ p.nome }}</strong></td>
              <td>{{ p.nivel }}</td>
              <td>
                <span class="amostra" [style.background]="p.cor"></span>
                <span class="cor-codigo">{{ p.cor }}</span>
              </td>
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
              <label>Nível *</label>
              <input type="number" [(ngModel)]="form.nivel" name="nivel" min="-9" max="99" required />
              <small class="ajuda">Menor n&iacute;vel = chamado antes (ex.: Idoso 80+ = -1, P&uacute;blico em geral = 6)</small>
            </div>
            <div class="campo">
              <label>Sufixo (até 2 letras)</label>
              <input [(ngModel)]="form.prefixo" name="prefixo" maxlength="2" style="text-transform: uppercase" />
            </div>
          </div>
          <div class="campo">
            <label>Cor da fonte no painel</label>
            <div class="cor-linha">
              <input type="color" [(ngModel)]="form.cor" name="cor" />
              <span class="cor-codigo">{{ form.cor }}</span>
            </div>
            <small class="ajuda">Cor do c&oacute;digo da senha na TV ao chamar (ex.: priorit&aacute;rio vermelho, comum verde)</small>
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
    .amostra { display: inline-block; width: 16px; height: 16px; border-radius: 4px; vertical-align: -3px; margin-right: 8px; border: 1px solid var(--borda); }
    .cor-codigo { font-family: monospace; font-size: 13px; color: var(--texto-2); }
    .cor-linha { display: flex; align-items: center; gap: 10px; }
    .cor-linha input[type=color] { width: 52px; height: 38px; padding: 2px; border: 1px solid var(--borda); border-radius: var(--raio); background: #fff; cursor: pointer; }
  `],
})
export class PrioridadesPagina implements OnInit {
  private readonly api = inject(Api);
  private readonly toasts = inject(Toasts);

  readonly prioridades = signal<NivelPrioridade[]>([]);
  readonly modal = signal(false);
  editando: NivelPrioridade | null = null;
  form = { nome: '', nivel: 0, cor: '#1d3451', prefixo: '', ativo: true };

  async ngOnInit() {
    await this.carregar();
  }

  async carregar() {
    this.prioridades.set(await this.api.get<NivelPrioridade[]>('/prioridades'));
  }

  abrirNovo() {
    this.editando = null;
    this.form = { nome: '', nivel: 1, cor: '#1d3451', prefixo: '', ativo: true };
    this.modal.set(true);
  }

  abrirEdicao(p: NivelPrioridade) {
    this.editando = p;
    this.form = { nome: p.nome, nivel: p.nivel, cor: p.cor || '#1d3451', prefixo: p.prefixo, ativo: p.ativo };
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
