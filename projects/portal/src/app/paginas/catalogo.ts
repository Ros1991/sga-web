import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, Servico, Toasts, mensagemDeErro } from 'compartilhado';

@Component({
  selector: 'pagina-catalogo',
  imports: [FormsModule],
  template: `
    <header class="topo">
      <div>
        <h2>Catálogo de serviços</h2>
        <p class="sub">Serviço é a área (ex.: Habilitação); subserviço é o que o cidadão escolhe no totem</p>
      </div>
      <form class="nova" (ngSubmit)="criarServico()">
        <input [(ngModel)]="novoServico" name="novoServico" placeholder="Nome do novo serviço" />
        <button class="botao">+ Serviço</button>
      </form>
    </header>

    @for (s of servicos(); track s.id) {
      <div class="cartao bloco">
        <div class="cabeca">
          <h3>{{ s.nome }}</h3>
          <span class="etiqueta" [class.etiqueta--verde]="s.ativo" [class.etiqueta--cinza]="!s.ativo">
            {{ s.ativo ? 'Ativo' : 'Inativo' }}
          </span>
        </div>

        <table class="tabela">
          <thead><tr><th>Subserviço</th><th>Prefixo da senha</th><th>Situação</th></tr></thead>
          <tbody>
            @for (sub of s.subservicos; track sub.id) {
              <tr>
                <td>{{ sub.nome }}</td>
                <td><span class="prefixo">{{ sub.prefixo }}</span></td>
                <td>
                  <span class="etiqueta" [class.etiqueta--verde]="sub.ativo" [class.etiqueta--cinza]="!sub.ativo">
                    {{ sub.ativo ? 'Ativo' : 'Inativo' }}
                  </span>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="3" class="vazio">Nenhum subserviço.</td></tr>
            }
          </tbody>
        </table>

        <form class="novo-sub" (ngSubmit)="criarSub(s)">
          <input [(ngModel)]="formSub[s.id]!.nome" [name]="'nome' + s.id" placeholder="Nome do subserviço" />
          <input class="curto" [(ngModel)]="formSub[s.id]!.prefixo" [name]="'prefixo' + s.id"
                 placeholder="XX" maxlength="2" style="text-transform: uppercase" />
          <button class="botao botao--contorno">+ Subserviço</button>
          <span class="dica">Prefixo: exatamente 2 letras — vira o começo da senha (RC → RC-001)</span>
        </form>
      </div>
    } @empty {
      <div class="cartao vazio-grande">Nenhum serviço ainda. Crie o primeiro acima.</div>
    }
  `,
  styles: [`
    .topo { display: flex; justify-content: space-between; align-items: end; gap: 16px; flex-wrap: wrap; margin-bottom: 22px;
      h2 { font-size: 24px; } .sub { color: var(--texto-3); margin: 4px 0 0; font-size: 14px; } }
    .nova { display: flex; gap: 8px;
      input { padding: 10px 12px; border: 1.5px solid var(--borda); border-radius: 8px; font: 14px var(--fonte); width: 240px; } }
    .bloco { margin-bottom: 16px;
      .cabeca { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; h3 { font-size: 17px; } } }
    .prefixo { font: 700 12px var(--fonte); background: var(--marinho); color: #fff; border-radius: 6px; padding: 3px 8px; }
    .novo-sub { display: flex; gap: 8px; align-items: center; margin-top: 12px; flex-wrap: wrap;
      input { padding: 9px 12px; border: 1.5px solid var(--borda); border-radius: 8px; font: 13.5px var(--fonte); width: 220px; }
      .curto { width: 64px; text-align: center; }
      .dica { font-size: 12.5px; color: var(--texto-3); } }
    .vazio { color: var(--texto-3); text-align: center; }
    .vazio-grande { text-align: center; color: var(--texto-3); padding: 34px; }
  `],
})
export class CatalogoPagina implements OnInit {
  private readonly api = inject(Api);
  private readonly toasts = inject(Toasts);

  readonly servicos = signal<Servico[]>([]);
  novoServico = '';
  formSub: Record<string, { nome: string; prefixo: string }> = {};

  async ngOnInit() {
    await this.carregar();
  }

  async carregar() {
    const lista = await this.api.get<Servico[]>('/servicos');
    this.servicos.set(lista);
    for (const s of lista) {
      this.formSub[s.id] ??= { nome: '', prefixo: '' };
    }
  }

  async criarServico() {
    if (!this.novoServico.trim()) return this.toasts.erro('Informe o nome do serviço.');
    try {
      await this.api.post('/servicos', { nome: this.novoServico });
      this.toasts.sucesso('Serviço criado.');
      this.novoServico = '';
      await this.carregar();
    } catch (e) {
      this.toasts.erro(mensagemDeErro(e));
    }
  }

  async criarSub(s: Servico) {
    const form = this.formSub[s.id]!;
    if (!form.nome.trim()) return this.toasts.erro('Informe o nome do subserviço.');
    if (!/^[A-Za-z]{2}$/.test(form.prefixo)) return this.toasts.erro('O prefixo deve ter exatamente 2 letras (ex.: RC).');
    try {
      await this.api.post(`/servicos/${s.id}/subservicos`, form);
      this.toasts.sucesso('Subserviço criado.');
      this.formSub[s.id] = { nome: '', prefixo: '' };
      await this.carregar();
    } catch (e) {
      this.toasts.erro(mensagemDeErro(e));
    }
  }
}
