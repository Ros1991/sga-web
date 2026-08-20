import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, Autenticacao, Toasts, Unidade, Usuario, mensagemDeErro } from 'compartilhado';

const ROTULOS: Record<string, string> = {
  ADMIN: 'Administrador', GERENTE: 'Gerente', ATENDENTE: 'Atendente', TRIAGEM: 'Triagem',
};

@Component({
  selector: 'pagina-usuarios',
  imports: [FormsModule],
  template: `
    <header class="topo">
      <div>
        <h2>Usuários</h2>
        <p class="sub">Perfis fixos: Administrador, Gerente, Atendente e Triagem</p>
      </div>
      <button class="botao" (click)="abrirNovo()">+ Novo usuário</button>
    </header>

    <div class="cartao">
      <table class="tabela">
        <thead><tr><th>Nome</th><th>Login</th><th>Perfil</th><th>Unidade</th><th>Situação</th><th></th></tr></thead>
        <tbody>
          @for (u of usuarios(); track u.id) {
            <tr>
              <td><strong>{{ u.nome }}</strong><br /><small class="mail">{{ u.email }}</small></td>
              <td>{{ u.login }}</td>
              <td><span class="etiqueta">{{ rotulo(u.perfil) }}</span></td>
              <td>{{ u.unidade?.nome ?? '—' }}</td>
              <td>
                <span class="etiqueta" [class.etiqueta--verde]="u.ativo" [class.etiqueta--cinza]="!u.ativo">
                  {{ u.ativo ? 'Ativo' : 'Inativo' }}
                </span>
              </td>
              <td class="direita"><button class="botao botao--fantasma" (click)="abrirEdicao(u)">Editar</button></td>
            </tr>
          } @empty {
            <tr><td colspan="6" class="vazio">Nenhum usuário.</td></tr>
          }
        </tbody>
      </table>
    </div>

    @if (modal()) {
      <div class="modal-fundo" (click)="modal.set(false)">
        <form class="modal" (click)="$event.stopPropagation()" (ngSubmit)="salvar()">
          <header><h3>{{ editando ? 'Editar usuário' : 'Novo usuário' }}</h3></header>
          <div class="campo"><label>Nome *</label><input [(ngModel)]="form.nome" name="nome" required /></div>
          <div class="linha">
            <div class="campo"><label>Login *</label><input [(ngModel)]="form.login" name="login" required /></div>
            <div class="campo"><label>Perfil *</label>
              <select [(ngModel)]="form.perfil" name="perfil">
                @if (ehAdmin) { <option value="ADMIN">Administrador</option> <option value="GERENTE">Gerente</option> }
                <option value="ATENDENTE">Atendente</option>
                <option value="TRIAGEM">Triagem</option>
              </select>
            </div>
          </div>
          <div class="campo"><label>E-mail *</label><input type="email" [(ngModel)]="form.email" name="email" required /></div>
          @if (form.perfil !== 'ADMIN') {
            <div class="campo"><label>Unidade *</label>
              <select [(ngModel)]="form.unidadeId" name="unidadeId">
                <option value="">Escolha…</option>
                @for (u of unidades(); track u.id) { <option [value]="u.id">{{ u.nome }}</option> }
              </select>
            </div>
          }
          <div class="campo">
            <label>{{ editando ? 'Nova senha (deixe vazio para manter)' : 'Senha inicial *' }}</label>
            <input type="text" [(ngModel)]="form.senha" name="senha" [required]="!editando" minlength="8" />
            <span class="dica-campo">Mínimo de 8 caracteres.</span>
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
            <button class="botao" [disabled]="salvando()">Salvar</button>
          </div>
        </form>
      </div>
    }
  `,
  styles: [`
    .topo { display: flex; justify-content: space-between; align-items: end; margin-bottom: 22px;
      h2 { font-size: 24px; } .sub { color: var(--texto-3); margin: 4px 0 0; font-size: 14px; } }
    .mail { color: var(--texto-3); }
    .direita { text-align: right; }
    .vazio { color: var(--texto-3); text-align: center; padding: 24px !important; }
    .linha { display: grid; grid-template-columns: 1fr 190px; gap: 12px; }
    .dica-campo { font-size: 12px; color: var(--texto-3); }
  `],
})
export class UsuariosPagina implements OnInit {
  private readonly api = inject(Api);
  private readonly auth = inject(Autenticacao);
  private readonly toasts = inject(Toasts);

  readonly usuarios = signal<Usuario[]>([]);
  readonly unidades = signal<Unidade[]>([]);
  readonly modal = signal(false);
  readonly salvando = signal(false);
  readonly ehAdmin = this.auth.usuario()?.perfil === 'ADMIN';

  editando: Usuario | null = null;
  form = { nome: '', login: '', email: '', senha: '', perfil: 'ATENDENTE', unidadeId: '', ativo: true };

  async ngOnInit() {
    this.unidades.set(await this.api.get<Unidade[]>('/unidades'));
    await this.carregar();
  }

  async carregar() {
    this.usuarios.set(await this.api.get<Usuario[]>('/usuarios'));
  }

  rotulo(perfil: string) {
    return ROTULOS[perfil] ?? perfil;
  }

  abrirNovo() {
    this.editando = null;
    this.form = { nome: '', login: '', email: '', senha: '', perfil: 'ATENDENTE', unidadeId: '', ativo: true };
    this.modal.set(true);
  }

  abrirEdicao(u: Usuario) {
    this.editando = u;
    this.form = {
      nome: u.nome, login: u.login, email: u.email, senha: '',
      perfil: u.perfil, unidadeId: u.unidadeId ?? '', ativo: u.ativo,
    };
    this.modal.set(true);
  }

  async salvar() {
    if (this.form.perfil !== 'ADMIN' && !this.form.unidadeId) {
      return this.toasts.erro('Escolha a unidade do usuário.');
    }
    this.salvando.set(true);
    try {
      const corpo: Record<string, unknown> = { ...this.form };
      if (this.form.perfil === 'ADMIN') delete corpo['unidadeId'];
      if (!this.form.senha) delete corpo['senha'];
      if (this.editando) {
        await this.api.put(`/usuarios/${this.editando.id}`, corpo);
        this.toasts.sucesso('Usuário atualizado.');
      } else {
        await this.api.post('/usuarios', corpo);
        this.toasts.sucesso('Usuário criado.');
      }
      this.modal.set(false);
      await this.carregar();
    } catch (e) {
      this.toasts.erro(mensagemDeErro(e));
    } finally {
      this.salvando.set(false);
    }
  }
}
