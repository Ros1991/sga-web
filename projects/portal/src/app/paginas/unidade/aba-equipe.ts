import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, Toasts, UnidadeDetalhe, Usuario, mensagemDeErro } from 'compartilhado';

@Component({
  selector: 'aba-equipe',
  imports: [FormsModule],
  template: `
    <div class="cartao">
      <div class="cabeca">
        <p class="dica">Atendentes chamam senhas; a triagem emite senhas assistidas.</p>
        <button class="botao" (click)="abrirNovo()">+ Novo membro</button>
      </div>

      <table class="tabela">
        <thead><tr><th>Nome</th><th>Usuário</th><th>Função</th><th>Situação</th><th></th></tr></thead>
        <tbody>
          @for (u of equipe(); track u.id) {
            <tr>
              <td><strong>{{ u.nome }}</strong><br /><small class="mail">{{ u.email }}</small></td>
              <td>{{ u.login }}</td>
              <td>
                <span class="etiqueta">{{ u.perfil === 'ATENDENTE' ? 'Atendente' : u.perfil === 'TRIAGEM' ? 'Triagem' : u.perfil === 'GERENTE' ? 'Gerente' : u.perfil }}</span>
              </td>
              <td>
                <span class="etiqueta" [class.etiqueta--verde]="u.ativo" [class.etiqueta--cinza]="!u.ativo">
                  {{ u.ativo ? 'Ativo' : 'Inativo' }}
                </span>
              </td>
              <td class="direita">
                <button class="botao botao--fantasma" (click)="alternarAtivo(u)">{{ u.ativo ? 'Desativar' : 'Ativar' }}</button>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="5" class="vazio">Nenhum membro na equipe ainda.</td></tr>
          }
        </tbody>
      </table>
    </div>

    @if (modal()) {
      <div class="modal-fundo" (click)="modal.set(false)">
        <form class="modal" (click)="$event.stopPropagation()" (ngSubmit)="criar()">
          <header><h3>Novo membro da equipe</h3></header>
          <div class="campo"><label>Nome *</label><input [(ngModel)]="form.nome" name="nome" required /></div>
          <div class="linha">
            <div class="campo"><label>Usuário (login) *</label><input [(ngModel)]="form.login" name="login" required /></div>
            <div class="campo"><label>Função *</label>
              <select [(ngModel)]="form.perfil" name="perfil">
                <option value="ATENDENTE">Atendente</option>
                <option value="TRIAGEM">Triagem</option>
              </select>
            </div>
          </div>
          <div class="campo"><label>E-mail *</label><input type="email" [(ngModel)]="form.email" name="email" required /></div>
          <div class="campo">
            <label>Senha inicial *</label>
            <input type="text" [(ngModel)]="form.senha" name="senha" required minlength="8" />
            <span class="dica-campo">Mínimo de 8 caracteres. Combine a troca no primeiro acesso.</span>
          </div>
          <div class="acoes-modal">
            <button type="button" class="botao botao--fantasma" (click)="modal.set(false)">Cancelar</button>
            <button class="botao" [disabled]="salvando()">Criar</button>
          </div>
        </form>
      </div>
    }
  `,
  styles: [`
    .cabeca { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
    .dica { color: var(--texto-3); font-size: 13.5px; margin: 0; }
    .dica-campo { font-size: 12px; color: var(--texto-3); }
    .mail { color: var(--texto-3); }
    .direita { text-align: right; }
    .vazio { color: var(--texto-3); text-align: center; padding: 24px !important; }
    .linha { display: grid; grid-template-columns: 1fr 170px; gap: 12px; }
  `],
})
export class AbaEquipe implements OnInit {
  @Input({ required: true }) unidade!: UnidadeDetalhe;

  private readonly api = inject(Api);
  private readonly toasts = inject(Toasts);

  readonly equipe = signal<Usuario[]>([]);
  readonly modal = signal(false);
  readonly salvando = signal(false);

  form = { nome: '', login: '', email: '', senha: '', perfil: 'ATENDENTE' };

  ngOnInit() {
    this.carregar();
  }

  async carregar() {
    this.equipe.set(await this.api.get<Usuario[]>(`/usuarios?unidadeId=${this.unidade.id}`));
  }

  abrirNovo() {
    this.form = { nome: '', login: '', email: '', senha: '', perfil: 'ATENDENTE' };
    this.modal.set(true);
  }

  async criar() {
    this.salvando.set(true);
    try {
      await this.api.post('/usuarios', { ...this.form, unidadeId: this.unidade.id });
      this.toasts.sucesso('Membro criado.');
      this.modal.set(false);
      await this.carregar();
    } catch (e) {
      this.toasts.erro(mensagemDeErro(e));
    } finally {
      this.salvando.set(false);
    }
  }

  async alternarAtivo(u: Usuario) {
    try {
      await this.api.put(`/usuarios/${u.id}`, { ativo: !u.ativo });
      await this.carregar();
    } catch (e) {
      this.toasts.erro(mensagemDeErro(e));
    }
  }
}
