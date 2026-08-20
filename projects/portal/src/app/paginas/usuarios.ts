import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, Autenticacao, Guiche, Toasts, Unidade, UnidadeDetalhe, Usuario, mensagemDeErro } from 'compartilhado';

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
        <p class="sub">Um usuário pode atuar em mais de uma unidade; o atendente opera apenas os guichês liberados</p>
      </div>
      <button class="botao" (click)="abrirNovo()">+ Novo usuário</button>
    </header>

    <div class="cartao">
      <table class="tabela">
        <thead><tr><th>Nome</th><th>Login</th><th>Perfil</th><th>Unidades</th><th>Guichês</th><th>Situação</th><th></th></tr></thead>
        <tbody>
          @for (u of usuarios(); track u.id) {
            <tr>
              <td><strong>{{ u.nome }}</strong><br /><small class="mail">{{ u.email }}</small></td>
              <td>{{ u.login }}</td>
              <td><span class="etiqueta">{{ rotulo(u.perfil) }}</span></td>
              <td>
                @if (u.perfil === 'ADMIN') { <span class="mail">todas</span> }
                @else {
                  @for (un of u.unidades; track un.id) { <span class="etiqueta etiqueta--cinza">{{ un.nome }}</span> }
                }
              </td>
              <td>
                @if (u.perfil === 'ATENDENTE') {
                  @if (u.guiches.length) {
                    @for (g of u.guiches; track g.id) { <span class="etiqueta">{{ g.numero }}</span> }
                  } @else { <span class="etiqueta etiqueta--ambar">nenhum liberado</span> }
                } @else { <span class="mail">—</span> }
              </td>
              <td>
                <span class="etiqueta" [class.etiqueta--verde]="u.ativo" [class.etiqueta--cinza]="!u.ativo">
                  {{ u.ativo ? 'Ativo' : 'Inativo' }}
                </span>
              </td>
              <td class="direita"><button class="botao botao--fantasma" (click)="abrirEdicao(u)">Editar</button></td>
            </tr>
          } @empty {
            <tr><td colspan="7" class="vazio">Nenhum usuário.</td></tr>
          }
        </tbody>
      </table>
    </div>

    @if (modal()) {
      <div class="modal-fundo" (click)="modal.set(false)">
        <form class="modal larga" (click)="$event.stopPropagation()" (ngSubmit)="salvar()">
          <header><h3>{{ editando ? 'Editar usuário' : 'Novo usuário' }}</h3></header>
          <div class="campo"><label>Nome *</label><input [(ngModel)]="form.nome" name="nome" required /></div>
          <div class="linha">
            <div class="campo"><label>Login *</label><input [(ngModel)]="form.login" name="login" required /></div>
            <div class="campo"><label>Perfil *</label>
              <select [(ngModel)]="form.perfil" name="perfil" (ngModelChange)="aoTrocarPerfil()">
                @if (ehAdmin) { <option value="ADMIN">Administrador</option> <option value="GERENTE">Gerente</option> }
                <option value="ATENDENTE">Atendente</option>
                <option value="TRIAGEM">Triagem</option>
              </select>
            </div>
          </div>
          <div class="campo"><label>E-mail *</label><input type="email" [(ngModel)]="form.email" name="email" required /></div>

          @if (form.perfil !== 'ADMIN') {
            <div class="campo">
              <label>Unidades de atuação *</label>
              <div class="opcoes">
                @for (u of unidades(); track u.id) {
                  <label class="opcao">
                    <input type="checkbox" [checked]="unidadesSel.has(u.id)" (change)="alternarUnidade(u.id)" />
                    {{ u.nome }}
                  </label>
                }
              </div>
            </div>
          }

          @if (form.perfil === 'ATENDENTE') {
            <div class="campo">
              <label>Guichês liberados</label>
              <span class="dica-campo">O atendente só consegue chamar senhas nos guichês marcados.</span>
              @for (grupo of guichesDasSelecionadas(); track grupo.unidade.id) {
                <div class="grupo-guiche">
                  <strong>{{ grupo.unidade.nome }}</strong>
                  <div class="opcoes">
                    @for (g of grupo.guiches; track g.id) {
                      <label class="opcao">
                        <input type="checkbox" [checked]="guichesSel.has(g.id)" (change)="alternarGuiche(g.id)" />
                        Guichê {{ g.numero }}
                      </label>
                    } @empty { <span class="dica-campo">Sem guichês nesta unidade.</span> }
                  </div>
                </div>
              } @empty {
                <span class="dica-campo">Marque as unidades acima para listar os guichês.</span>
              }
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
    .larga { width: min(640px, 100%); }
    .etiqueta { margin: 2px 4px 2px 0; }
    .opcoes { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
    .opcao { display: inline-flex; align-items: center; gap: 8px; border: 1.5px solid var(--borda);
      border-radius: 8px; padding: 8px 12px; font-size: 13.5px; cursor: pointer;
      &:has(input:checked) { border-color: var(--azul); background: var(--azul-suave); } }
    .grupo-guiche { margin-top: 10px; strong { font-size: 13px; } }
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
  unidadesSel = new Set<string>();
  guichesSel = new Set<string>();
  private guichesPorUnidade = new Map<string, Guiche[]>();
  readonly versaoGuiches = signal(0);

  form = { nome: '', login: '', email: '', senha: '', perfil: 'ATENDENTE', ativo: true };

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
    this.form = { nome: '', login: '', email: '', senha: '', perfil: 'ATENDENTE', ativo: true };
    this.unidadesSel = new Set();
    this.guichesSel = new Set();
    this.modal.set(true);
  }

  abrirEdicao(u: Usuario) {
    this.editando = u;
    this.form = { nome: u.nome, login: u.login, email: u.email, senha: '', perfil: u.perfil, ativo: u.ativo };
    this.unidadesSel = new Set(u.unidades.map((un) => un.id));
    this.guichesSel = new Set(u.guiches.map((g) => g.id));
    for (const id of this.unidadesSel) void this.carregarGuiches(id);
    this.modal.set(true);
  }

  aoTrocarPerfil() {
    if (this.form.perfil !== 'ATENDENTE') this.guichesSel.clear();
  }

  alternarUnidade(id: string) {
    if (this.unidadesSel.has(id)) {
      this.unidadesSel.delete(id);
      // guichês da unidade removida caem da seleção
      for (const g of this.guichesPorUnidade.get(id) ?? []) this.guichesSel.delete(g.id);
    } else {
      this.unidadesSel.add(id);
      void this.carregarGuiches(id);
    }
    this.versaoGuiches.update((v) => v + 1);
  }

  alternarGuiche(id: string) {
    this.guichesSel.has(id) ? this.guichesSel.delete(id) : this.guichesSel.add(id);
  }

  guichesDasSelecionadas() {
    this.versaoGuiches(); // dependência p/ recomputar
    return [...this.unidadesSel]
      .map((id) => ({
        unidade: this.unidades().find((u) => u.id === id)!,
        guiches: this.guichesPorUnidade.get(id) ?? [],
      }))
      .filter((g) => g.unidade);
  }

  private async carregarGuiches(unidadeId: string) {
    if (this.guichesPorUnidade.has(unidadeId)) return;
    try {
      const det = await this.api.get<UnidadeDetalhe>(`/unidades/${unidadeId}`);
      this.guichesPorUnidade.set(unidadeId, det.guiches.filter((g) => g.ativo));
      this.versaoGuiches.update((v) => v + 1);
    } catch {
      this.guichesPorUnidade.set(unidadeId, []);
    }
  }

  async salvar() {
    if (this.form.perfil !== 'ADMIN' && !this.unidadesSel.size) {
      return this.toasts.erro('Escolha ao menos uma unidade de atuação.');
    }
    this.salvando.set(true);
    try {
      const corpo: Record<string, unknown> = {
        ...this.form,
        unidadeIds: this.form.perfil === 'ADMIN' ? [] : [...this.unidadesSel],
        guicheIds: this.form.perfil === 'ATENDENTE' ? [...this.guichesSel] : [],
      };
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
