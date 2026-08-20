import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, Toasts, UnidadeDetalhe, Usuario, mensagemDeErro } from 'compartilhado';

@Component({
  selector: 'aba-equipe',
  imports: [FormsModule],
  template: `
    <div class="cartao">
      <div class="cabeca">
        <p class="dica">
          Atendentes chamam senhas <strong>apenas nos guichês liberados aqui</strong>;
          a triagem emite senhas assistidas. Um membro pode atuar em outras unidades também.
        </p>
        <button class="botao" (click)="abrirNovo()">+ Novo membro</button>
      </div>

      <table class="tabela">
        <thead><tr><th>Nome</th><th>Usuário</th><th>Função</th><th>Guichês liberados aqui</th><th>Situação</th><th></th></tr></thead>
        <tbody>
          @for (u of equipe(); track u.id) {
            <tr>
              <td><strong>{{ u.nome }}</strong><br /><small class="mail">{{ u.email }}</small></td>
              <td>{{ u.login }}</td>
              <td><span class="etiqueta">{{ rotulo(u.perfil) }}</span></td>
              <td>
                @if (u.perfil === 'ATENDENTE') {
                  @if (guichesDaqui(u).length) {
                    @for (g of guichesDaqui(u); track g.id) { <span class="etiqueta">{{ g.numero }}</span> }
                  } @else { <span class="etiqueta etiqueta--ambar">nenhum liberado</span> }
                } @else { <span class="mail">—</span> }
              </td>
              <td>
                <span class="etiqueta" [class.etiqueta--verde]="u.ativo" [class.etiqueta--cinza]="!u.ativo">
                  {{ u.ativo ? 'Ativo' : 'Inativo' }}
                </span>
              </td>
              <td class="direita">
                @if (u.perfil === 'ATENDENTE') {
                  <button class="botao botao--fantasma" (click)="abrirGuiches(u)">Guichês</button>
                }
                <button class="botao botao--fantasma" (click)="alternarAtivo(u)">{{ u.ativo ? 'Desativar' : 'Ativar' }}</button>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="6" class="vazio">Nenhum membro na equipe ainda.</td></tr>
          }
        </tbody>
      </table>
    </div>

    @if (modal()) {
      <div class="modal-fundo" (click)="modal.set(false)">
        <form class="modal" (click)="$event.stopPropagation()" (ngSubmit)="criar()">
          <header><h3>Novo membro — {{ unidade.nome }}</h3></header>
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
          @if (form.perfil === 'ATENDENTE') {
            <div class="campo">
              <label>Guichês liberados nesta unidade</label>
              <div class="opcoes">
                @for (g of unidade.guiches; track g.id) {
                  <label class="opcao">
                    <input type="checkbox" [checked]="guichesSel.has(g.id)" (change)="alternarGuiche(g.id)" />
                    Guichê {{ g.numero }}
                  </label>
                } @empty { <span class="dica-campo">Crie guichês na aba Guichês primeiro.</span> }
              </div>
            </div>
          }
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

    @if (editandoGuiches(); as membro) {
      <div class="modal-fundo" (click)="editandoGuiches.set(null)">
        <form class="modal" (click)="$event.stopPropagation()" (ngSubmit)="salvarGuiches(membro)">
          <header><h3>Guichês de {{ membro.nome }} — {{ unidade.nome }}</h3></header>
          <div class="campo">
            <div class="opcoes">
              @for (g of unidade.guiches; track g.id) {
                <label class="opcao">
                  <input type="checkbox" [checked]="guichesSel.has(g.id)" (change)="alternarGuiche(g.id)" />
                  Guichê {{ g.numero }}
                </label>
              }
            </div>
            <span class="dica-campo">Sem nenhum guichê marcado o atendente não consegue chamar senhas.</span>
          </div>
          <div class="acoes-modal">
            <button type="button" class="botao botao--fantasma" (click)="editandoGuiches.set(null)">Cancelar</button>
            <button class="botao" [disabled]="salvando()">Salvar</button>
          </div>
        </form>
      </div>
    }
  `,
  styles: [`
    .cabeca { display: flex; justify-content: space-between; align-items: start; gap: 16px; margin-bottom: 14px; }
    .dica { color: var(--texto-3); font-size: 13.5px; margin: 0; max-width: 560px; }
    .dica-campo { font-size: 12px; color: var(--texto-3); }
    .mail { color: var(--texto-3); }
    .direita { text-align: right; white-space: nowrap; button { padding: 6px 10px; font-size: 13px; } }
    .vazio { color: var(--texto-3); text-align: center; padding: 24px !important; }
    .linha { display: grid; grid-template-columns: 1fr 170px; gap: 12px; }
    .etiqueta { margin: 2px 4px 2px 0; }
    .opcoes { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
    .opcao { display: inline-flex; align-items: center; gap: 8px; border: 1.5px solid var(--borda);
      border-radius: 8px; padding: 8px 12px; font-size: 13.5px; cursor: pointer;
      &:has(input:checked) { border-color: var(--azul); background: var(--azul-suave); } }
  `],
})
export class AbaEquipe implements OnInit {
  @Input({ required: true }) unidade!: UnidadeDetalhe;

  private readonly api = inject(Api);
  private readonly toasts = inject(Toasts);

  readonly equipe = signal<Usuario[]>([]);
  readonly modal = signal(false);
  readonly salvando = signal(false);
  readonly editandoGuiches = signal<Usuario | null>(null);

  guichesSel = new Set<string>();
  form = { nome: '', login: '', email: '', senha: '', perfil: 'ATENDENTE' };

  ngOnInit() {
    this.carregar();
  }

  async carregar() {
    this.equipe.set(await this.api.get<Usuario[]>(`/usuarios?unidadeId=${this.unidade.id}`));
  }

  rotulo(perfil: string) {
    const mapa: Record<string, string> = { GERENTE: 'Gerente', ATENDENTE: 'Atendente', TRIAGEM: 'Triagem', ADMIN: 'Admin' };
    return mapa[perfil] ?? perfil;
  }

  /** Guichês do membro que pertencem a ESTA unidade. */
  guichesDaqui(u: Usuario) {
    const daqui = new Set(this.unidade.guiches.map((g) => g.id));
    return u.guiches.filter((g) => daqui.has(g.id));
  }

  abrirNovo() {
    this.form = { nome: '', login: '', email: '', senha: '', perfil: 'ATENDENTE' };
    this.guichesSel = new Set();
    this.modal.set(true);
  }

  abrirGuiches(u: Usuario) {
    this.guichesSel = new Set(this.guichesDaqui(u).map((g) => g.id));
    this.editandoGuiches.set(u);
  }

  alternarGuiche(id: string) {
    this.guichesSel.has(id) ? this.guichesSel.delete(id) : this.guichesSel.add(id);
  }

  async criar() {
    this.salvando.set(true);
    try {
      await this.api.post('/usuarios', {
        ...this.form,
        unidadeIds: [this.unidade.id],
        guicheIds: this.form.perfil === 'ATENDENTE' ? [...this.guichesSel] : [],
      });
      this.toasts.sucesso('Membro criado.');
      this.modal.set(false);
      await this.carregar();
    } catch (e) {
      this.toasts.erro(mensagemDeErro(e));
    } finally {
      this.salvando.set(false);
    }
  }

  /** Substitui só os guichês DESTA unidade, preservando os de outras. */
  async salvarGuiches(membro: Usuario) {
    this.salvando.set(true);
    try {
      const daqui = new Set(this.unidade.guiches.map((g) => g.id));
      const deOutras = membro.guiches.filter((g) => !daqui.has(g.id)).map((g) => g.id);
      await this.api.put(`/usuarios/${membro.id}`, { guicheIds: [...deOutras, ...this.guichesSel] });
      this.toasts.sucesso('Guichês atualizados.');
      this.editandoGuiches.set(null);
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
