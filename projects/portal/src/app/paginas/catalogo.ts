import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, Servico, Subservico, Toasts, mensagemDeErro } from 'compartilhado';

/** O que está aberto no modal de edição. */
type Edicao = { tipo: 'servico'; item: Servico } | { tipo: 'sub'; item: Subservico };

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
          <div class="acoes">
            <button type="button" class="botao botao--fantasma" (click)="editarServico(s)">Editar</button>
            <button type="button" class="botao botao--fantasma" [disabled]="salvando()" (click)="alternarServico(s)">
              {{ s.ativo ? 'Desativar' : 'Reativar' }}
            </button>
            <button type="button" class="botao botao--fantasma excluir" [disabled]="salvando()" (click)="excluirServico(s)">
              Excluir
            </button>
          </div>
        </div>
        @if (!s.ativo) {
          <p class="aviso-inativo">Desativado: nenhum subserviço dele aparece no totem nem na emissão de senhas.</p>
        }

        <div class="rolagem">
          <table class="tabela">
            <thead><tr><th>Subserviço</th><th>Prefixo da senha</th><th>Situação</th><th></th></tr></thead>
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
                  <td class="direita acoes-linha">
                    <button type="button" class="botao botao--fantasma" (click)="editarSub(sub)">Editar</button>
                    <button type="button" class="botao botao--fantasma" [disabled]="salvando()" (click)="alternarSub(sub)">
                      {{ sub.ativo ? 'Desativar' : 'Reativar' }}
                    </button>
                    <button type="button" class="botao botao--fantasma excluir" [disabled]="salvando()" (click)="excluirSub(sub)">
                      Excluir
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="4" class="vazio">Nenhum subserviço.</td></tr>
              }
            </tbody>
          </table>
        </div>

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

    @if (edicao(); as e) {
      <div class="modal-fundo" (click)="edicao.set(null)">
        <form class="modal" (click)="$event.stopPropagation()" (ngSubmit)="salvarEdicao(e)">
          <header><h3>{{ e.tipo === 'servico' ? 'Editar serviço' : 'Editar subserviço' }}</h3></header>
          <div class="campo">
            <label>Nome *</label>
            <input [(ngModel)]="formEdicao.nome" name="nome" maxlength="120" required />
          </div>
          @if (e.tipo === 'sub') {
            <div class="campo">
              <label>Prefixo da senha *</label>
              <input class="curto" [(ngModel)]="formEdicao.prefixo" name="prefixo" maxlength="2"
                     style="text-transform: uppercase" required />
              <span class="dica">Exatamente 2 letras. As senhas já emitidas continuam com o código antigo.</span>
            </div>
          }
          <div class="acoes-modal">
            <button type="button" class="botao botao--fantasma" (click)="edicao.set(null)">Cancelar</button>
            <button class="botao" [disabled]="salvando()">Salvar</button>
          </div>
        </form>
      </div>
    }
  `,
  styles: [`
    .topo { display: flex; justify-content: space-between; align-items: end; gap: 16px; flex-wrap: wrap; margin-bottom: 22px;
      h2 { font-size: 24px; } .sub { color: var(--texto-3); margin: 4px 0 0; font-size: 14px; } }
    .nova { display: flex; gap: 8px;
      input { padding: 10px 12px; border: 1.5px solid var(--borda); border-radius: 8px; font: 14px var(--fonte); width: 240px; } }
    .bloco { margin-bottom: 16px;
      .cabeca { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; h3 { font-size: 17px; } } }
    .acoes { display: flex; gap: 4px; margin-left: auto; flex-wrap: wrap; }
    .acoes-linha { white-space: nowrap; }
    .excluir { color: var(--vermelho); &:hover { background: var(--vermelho-suave); } }
    .aviso-inativo { margin: -4px 0 12px; font-size: 13px; color: var(--texto-3); }
    .rolagem { overflow-x: auto; }
    .prefixo { font: 700 12px var(--fonte); background: var(--marinho); color: #fff; border-radius: 6px; padding: 3px 8px; }
    .novo-sub { display: flex; gap: 8px; align-items: center; margin-top: 12px; flex-wrap: wrap;
      input { padding: 9px 12px; border: 1.5px solid var(--borda); border-radius: 8px; font: 13.5px var(--fonte); width: 220px; }
      .curto { width: 64px; text-align: center; } }
    .dica { font-size: 12.5px; color: var(--texto-3); }
    .campo .curto { width: 80px; text-align: center; }
    .vazio { color: var(--texto-3); text-align: center; }
    .vazio-grande { text-align: center; color: var(--texto-3); padding: 34px; }
  `],
})
export class CatalogoPagina implements OnInit {
  private readonly api = inject(Api);
  private readonly toasts = inject(Toasts);

  readonly servicos = signal<Servico[]>([]);
  readonly edicao = signal<Edicao | null>(null);
  readonly salvando = signal(false);
  novoServico = '';
  formSub: Record<string, { nome: string; prefixo: string }> = {};
  formEdicao = { nome: '', prefixo: '' };

  async ngOnInit() {
    await this.carregar();
  }

  async carregar() {
    // ?uso=1: a API informa o que ainda pode ser excluído (nunca emitiu senha).
    const lista = await this.api.get<Servico[]>('/servicos?uso=1');
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

  // ---------- Editar ----------

  editarServico(s: Servico) {
    this.formEdicao = { nome: s.nome, prefixo: '' };
    this.edicao.set({ tipo: 'servico', item: s });
  }

  editarSub(sub: Subservico) {
    this.formEdicao = { nome: sub.nome, prefixo: sub.prefixo };
    this.edicao.set({ tipo: 'sub', item: sub });
  }

  async salvarEdicao(e: Edicao) {
    const nome = this.formEdicao.nome.trim();
    if (!nome) return this.toasts.erro('Informe o nome.');
    if (e.tipo === 'servico') {
      const ok = await this.executar(() => this.api.put(`/servicos/${e.item.id}`, { nome }), 'Serviço atualizado.');
      if (ok) this.edicao.set(null);
      return;
    }
    const prefixo = this.formEdicao.prefixo.trim();
    if (!/^[A-Za-z]{2}$/.test(prefixo)) return this.toasts.erro('O prefixo deve ter exatamente 2 letras (ex.: RC).');
    const ok = await this.executar(
      () => this.api.put(`/servicos/subservicos/${e.item.id}`, { nome, prefixo }),
      'Subserviço atualizado.',
    );
    if (ok) this.edicao.set(null);
  }

  // ---------- Desativar / reativar ----------

  async alternarServico(s: Servico) {
    if (s.ativo && !confirm(
      `Desativar "${s.nome}"?\n\nNenhum subserviço dele vai aparecer no totem nem na emissão de senhas. ` +
      'As senhas que já estão na fila continuam sendo atendidas, e o histórico continua nos relatórios.',
    )) return;
    await this.executar(
      () => this.api.put(`/servicos/${s.id}`, { ativo: !s.ativo }),
      s.ativo ? 'Serviço desativado.' : 'Serviço reativado.',
    );
  }

  async alternarSub(sub: Subservico) {
    if (sub.ativo && !confirm(
      `Desativar "${sub.nome}"?\n\nEle deixa de aparecer no totem e na emissão de senhas. ` +
      'As senhas que já estão na fila continuam sendo atendidas, e o histórico continua nos relatórios.',
    )) return;
    await this.executar(
      () => this.api.put(`/servicos/subservicos/${sub.id}`, { ativo: !sub.ativo }),
      sub.ativo ? 'Subserviço desativado.' : 'Subserviço reativado.',
    );
  }

  // ---------- Excluir ----------

  async excluirServico(s: Servico) {
    if (s.podeExcluir === false) return this.explicarHistorico(s.nome, 'serviço');
    const n = s.subservicos.length;
    const junto = n === 0 ? '' : n === 1 ? ' e o subserviço dele' : ` e os ${n} subserviços dele`;
    if (!confirm(`Excluir "${s.nome}"${junto}?\n\nIsso não pode ser desfeito.`)) return;
    await this.executar(() => this.api.delete(`/servicos/${s.id}`), 'Serviço excluído.');
  }

  async excluirSub(sub: Subservico) {
    if (sub.podeExcluir === false) return this.explicarHistorico(sub.nome, 'subserviço');
    if (!confirm(`Excluir "${sub.nome}"?\n\nIsso não pode ser desfeito.`)) return;
    await this.executar(() => this.api.delete(`/servicos/subservicos/${sub.id}`), 'Subserviço excluído.');
  }

  /** Com senhas emitidas a exclusão apagaria histórico: orienta a desativar. */
  private explicarHistorico(nome: string, tipo: 'serviço' | 'subserviço') {
    this.toasts.info(
      `"${nome}" já tem senhas emitidas e não pode ser excluído, porque o histórico dos relatórios depende dele. ` +
      `Use "Desativar": o ${tipo} deixa de aparecer no totem.`,
      8000,
    );
  }

  /** Executa uma alteração, avisa o resultado e recarrega o catálogo. Devolve se deu certo. */
  private async executar(acao: () => Promise<unknown>, sucesso: string): Promise<boolean> {
    this.salvando.set(true);
    try {
      await acao();
      this.toasts.sucesso(sucesso);
      return true;
    } catch (e) {
      this.toasts.erro(mensagemDeErro(e));
      return false;
    } finally {
      this.salvando.set(false);
      await this.carregar().catch(() => undefined);
    }
  }
}
