import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api, Autenticacao, Toasts, Unidade, mensagemDeErro } from 'compartilhado';

@Component({
  selector: 'pagina-unidades',
  imports: [FormsModule, RouterLink],
  template: `
    <header class="topo">
      <div>
        <h2>Unidades</h2>
        <p class="sub">Cada unidade concentra guichês, dispositivos, equipe e pesquisa</p>
      </div>
      @if (ehAdmin) {
        <button class="botao" (click)="abrirModal.set(true)">+ Nova unidade</button>
      }
    </header>

    <div class="cartao">
      <table class="tabela">
        <thead><tr><th>Nome</th><th>Cidade/UF</th><th>Situação</th><th></th></tr></thead>
        <tbody>
          @for (u of unidades(); track u.id) {
            <tr>
              <td><strong>{{ u.nome }}</strong></td>
              <td>{{ u.cidade || '—' }}/{{ u.uf }}</td>
              <td>
                <span class="etiqueta" [class.etiqueta--verde]="u.ativo" [class.etiqueta--cinza]="!u.ativo">
                  {{ u.ativo ? 'Ativa' : 'Inativa' }}
                </span>
              </td>
              <td class="direita"><a class="botao botao--contorno" [routerLink]="['/unidades', u.id]">Abrir</a></td>
            </tr>
          } @empty {
            <tr><td colspan="4" class="vazio">Nenhuma unidade cadastrada ainda.</td></tr>
          }
        </tbody>
      </table>
    </div>

    @if (abrirModal()) {
      <div class="modal-fundo" (click)="abrirModal.set(false)">
        <form class="modal" (click)="$event.stopPropagation()" (ngSubmit)="criar()">
          <header><h3>Nova unidade</h3></header>
          <div class="campo">
            <label>Nome *</label>
            <input [(ngModel)]="form.nome" name="nome" required placeholder="Ex.: DETRAN Sede" />
          </div>
          <div class="campo">
            <label>Endereço</label>
            <input [(ngModel)]="form.endereco" name="endereco" />
          </div>
          <div class="linha">
            <div class="campo"><label>Cidade</label><input [(ngModel)]="form.cidade" name="cidade" /></div>
            <div class="campo uf"><label>UF</label><input [(ngModel)]="form.uf" name="uf" maxlength="2" /></div>
          </div>
          <div class="acoes-modal">
            <button type="button" class="botao botao--fantasma" (click)="abrirModal.set(false)">Cancelar</button>
            <button class="botao" [disabled]="salvando()">Criar unidade</button>
          </div>
        </form>
      </div>
    }
  `,
  styles: [`
    .topo { display: flex; justify-content: space-between; align-items: end; margin-bottom: 22px;
      h2 { font-size: 24px; } .sub { color: var(--texto-3); margin: 4px 0 0; font-size: 14px; } }
    .direita { text-align: right; }
    .vazio { color: var(--texto-3); text-align: center; padding: 28px !important; }
    .linha { display: grid; grid-template-columns: 1fr 90px; gap: 12px; }
  `],
})
export class UnidadesPagina implements OnInit {
  private readonly api = inject(Api);
  private readonly auth = inject(Autenticacao);
  private readonly toasts = inject(Toasts);
  private readonly router = inject(Router);

  readonly unidades = signal<Unidade[]>([]);
  readonly abrirModal = signal(false);
  readonly salvando = signal(false);
  readonly ehAdmin = this.auth.usuario()?.perfil === 'ADMIN';

  form = { nome: '', endereco: '', cidade: '', uf: 'DF' };

  async ngOnInit() {
    const lista = await this.api.get<Unidade[]>('/unidades');
    // Gerente cai direto na própria unidade
    if (!this.ehAdmin && lista.length === 1) {
      this.router.navigate(['/unidades', lista[0].id], { replaceUrl: true });
      return;
    }
    this.unidades.set(lista);
  }

  async criar() {
    if (!this.form.nome.trim()) {
      this.toasts.erro('Informe o nome da unidade.');
      return;
    }
    this.salvando.set(true);
    try {
      const nova = await this.api.post<Unidade>('/unidades', this.form);
      this.toasts.sucesso(`Unidade "${nova.nome}" criada.`);
      this.router.navigate(['/unidades', nova.id]);
    } catch (e) {
      this.toasts.erro(mensagemDeErro(e));
    } finally {
      this.salvando.set(false);
    }
  }
}
