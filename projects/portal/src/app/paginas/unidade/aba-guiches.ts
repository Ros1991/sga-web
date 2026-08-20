import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, Guiche, Toasts, UnidadeDetalhe, mensagemDeErro } from 'compartilhado';

@Component({
  selector: 'aba-guiches',
  imports: [FormsModule],
  template: `
    <div class="cartao">
      <div class="cabeca">
        <p class="dica">Cada guichê atende um conjunto de subserviços da unidade.</p>
        <button class="botao" (click)="abrirNovo()">+ Novo guichê</button>
      </div>

      <table class="tabela">
        <thead><tr><th>Guichê</th><th>Subserviços atendidos</th><th>Situação</th><th></th></tr></thead>
        <tbody>
          @for (g of unidade.guiches; track g.id) {
            <tr>
              <td><strong>Guichê {{ g.numero }}</strong></td>
              <td>
                @for (s of g.subservicos; track s.id) {
                  <span class="etiqueta">{{ s.nome }}</span>
                }
              </td>
              <td>
                <span class="etiqueta" [class.etiqueta--verde]="g.ativo" [class.etiqueta--cinza]="!g.ativo">
                  {{ g.ativo ? 'Ativo' : 'Inativo' }}
                </span>
              </td>
              <td class="direita">
                <button class="botao botao--fantasma" (click)="abrirEdicao(g)">Editar</button>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="4" class="vazio">Nenhum guichê ainda. Crie o primeiro.</td></tr>
          }
        </tbody>
      </table>
    </div>

    @if (modal()) {
      <div class="modal-fundo" (click)="modal.set(false)">
        <form class="modal" (click)="$event.stopPropagation()" (ngSubmit)="salvar()">
          <header><h3>{{ editando ? 'Editar guichê ' + editando.numero : 'Novo guichê' }}</h3></header>
          <div class="campo">
            <label>Número *</label>
            <input [(ngModel)]="form.numero" name="numero" required placeholder="Ex.: 01" />
          </div>
          <div class="campo">
            <label>Subserviços atendidos *</label>
            @if (!unidade.subservicos.length) {
              <p class="dica">A unidade ainda não oferta subserviços — configure na aba Dados.</p>
            }
            <div class="opcoes">
              @for (s of unidade.subservicos; track s.id) {
                <label class="opcao">
                  <input type="checkbox" [checked]="selecionados.has(s.id)" (change)="alternar(s.id)" />
                  {{ s.nome }}
                </label>
              }
            </div>
          </div>
          @if (editando) {
            <div class="campo">
              <label>Situação</label>
              <select [(ngModel)]="form.ativo" name="ativo">
                <option [ngValue]="true">Ativo</option>
                <option [ngValue]="false">Inativo</option>
              </select>
            </div>
          }
          <div class="acoes-modal">
            <button type="button" class="botao botao--fantasma" (click)="modal.set(false)">Cancelar</button>
            <button class="botao" [disabled]="salvando()">Salvar</button>
          </div>
        </form>
      </div>
    }
  `,
  styles: [`
    .cabeca { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
    .dica { color: var(--texto-3); font-size: 13.5px; margin: 0; }
    .direita { text-align: right; }
    .vazio { color: var(--texto-3); text-align: center; padding: 24px !important; }
    .etiqueta { margin: 2px 4px 2px 0; }
    .opcoes { display: flex; flex-wrap: wrap; gap: 8px; }
    .opcao { display: inline-flex; align-items: center; gap: 8px; border: 1.5px solid var(--borda);
      border-radius: 8px; padding: 8px 12px; font-size: 13.5px; cursor: pointer;
      &:has(input:checked) { border-color: var(--azul); background: var(--azul-suave); } }
  `],
})
export class AbaGuiches {
  @Input({ required: true }) unidade!: UnidadeDetalhe;
  @Output() mudou = new EventEmitter<void>();

  private readonly api = inject(Api);
  private readonly toasts = inject(Toasts);

  readonly modal = signal(false);
  readonly salvando = signal(false);
  editando: Guiche | null = null;
  selecionados = new Set<string>();
  form = { numero: '', ativo: true };

  abrirNovo() {
    this.editando = null;
    this.form = { numero: '', ativo: true };
    this.selecionados = new Set();
    this.modal.set(true);
  }

  abrirEdicao(g: Guiche) {
    this.editando = g;
    this.form = { numero: g.numero, ativo: g.ativo };
    this.selecionados = new Set(g.subservicos.map((s) => s.id));
    this.modal.set(true);
  }

  alternar(id: string) {
    this.selecionados.has(id) ? this.selecionados.delete(id) : this.selecionados.add(id);
  }

  async salvar() {
    if (!this.form.numero.trim()) return this.toasts.erro('Informe o número do guichê.');
    if (!this.selecionados.size) return this.toasts.erro('Escolha ao menos um subserviço atendido.');
    this.salvando.set(true);
    try {
      const corpo = { ...this.form, subservicoIds: [...this.selecionados] };
      if (this.editando) {
        await this.api.put(`/unidades/guiches/${this.editando.id}`, corpo);
        this.toasts.sucesso('Guichê atualizado.');
      } else {
        await this.api.post(`/unidades/${this.unidade.id}/guiches`, corpo);
        this.toasts.sucesso('Guichê criado.');
      }
      this.modal.set(false);
      this.mudou.emit();
    } catch (e) {
      this.toasts.erro(mensagemDeErro(e));
    } finally {
      this.salvando.set(false);
    }
  }
}
