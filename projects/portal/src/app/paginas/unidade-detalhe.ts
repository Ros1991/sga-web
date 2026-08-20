import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Api, Autenticacao, Servico, Toasts, UnidadeDetalhe, mensagemDeErro } from 'compartilhado';
import { AbaDispositivos } from './unidade/aba-dispositivos';
import { AbaEquipe } from './unidade/aba-equipe';
import { AbaGuiches } from './unidade/aba-guiches';
import { AbaPesquisa } from './unidade/aba-pesquisa';

type Aba = 'dados' | 'guiches' | 'dispositivos' | 'equipe' | 'pesquisa';

@Component({
  selector: 'pagina-unidade-detalhe',
  imports: [FormsModule, RouterLink, AbaGuiches, AbaDispositivos, AbaEquipe, AbaPesquisa],
  template: `
    @if (unidade(); as u) {
      <header class="topo">
        <div>
          @if (ehAdmin) {
            <a routerLink="/unidades" class="voltar">← Unidades</a>
          }
          <h2>{{ u.nome }}</h2>
          <p class="sub">{{ u.endereco || 'Sem endereço' }} · {{ u.cidade || '—' }}/{{ u.uf }}</p>
        </div>
        <span class="etiqueta" [class.etiqueta--verde]="u.ativo" [class.etiqueta--cinza]="!u.ativo">
          {{ u.ativo ? 'Ativa' : 'Inativa' }}
        </span>
      </header>

      <nav class="abas">
        @for (aba of abas; track aba.id) {
          <button [class.ativa]="abaAtiva() === aba.id" (click)="abaAtiva.set(aba.id)">
            {{ aba.rotulo }}
            @if (aba.id === 'guiches') { <small>{{ u.guiches.length }}</small> }
            @if (aba.id === 'dispositivos') { <small>{{ u.dispositivos.length }}</small> }
          </button>
        }
      </nav>

      @switch (abaAtiva()) {
        @case ('dados') {
          <div class="cartao">
            <form (ngSubmit)="salvarDados()" class="form-dados">
              <div class="campo"><label>Nome *</label><input [(ngModel)]="formDados.nome" name="nome" required /></div>
              <div class="campo"><label>Endereço</label><input [(ngModel)]="formDados.endereco" name="endereco" /></div>
              <div class="linha">
                <div class="campo"><label>Cidade</label><input [(ngModel)]="formDados.cidade" name="cidade" /></div>
                <div class="campo uf"><label>UF</label><input [(ngModel)]="formDados.uf" name="uf" maxlength="2" /></div>
                <div class="campo"><label>Situação</label>
                  <select [(ngModel)]="formDados.ativo" name="ativo">
                    <option [ngValue]="true">Ativa</option>
                    <option [ngValue]="false">Inativa</option>
                  </select>
                </div>
              </div>
              <button class="botao" [disabled]="salvando()">Salvar dados</button>
            </form>

            <hr class="separa" />

            <h3>Subserviços ofertados nesta unidade</h3>
            <p class="dica">É o que aparece no totem para o cidadão escolher.</p>
            @for (servico of catalogo(); track servico.id) {
              <div class="grupo-servico">
                <strong>{{ servico.nome }}</strong>
                <div class="opcoes">
                  @for (sub of servico.subservicos; track sub.id) {
                    <label class="opcao">
                      <input type="checkbox" [checked]="ofertados().has(sub.id)" (change)="alternarOferta(sub.id)" />
                      {{ sub.nome }} <span class="prefixo">{{ sub.prefixo }}</span>
                    </label>
                  }
                </div>
              </div>
            } @empty {
              <p class="dica">Nenhum serviço no catálogo ainda. Cadastre em <em>Serviços</em>.</p>
            }
            <button class="botao botao--contorno" (click)="salvarOferta()" [disabled]="salvando()">Salvar oferta</button>
          </div>
        }
        @case ('guiches') { <aba-guiches [unidade]="u" (mudou)="recarregar()" /> }
        @case ('dispositivos') { <aba-dispositivos [unidade]="u" (mudou)="recarregar()" /> }
        @case ('equipe') { <aba-equipe [unidade]="u" /> }
        @case ('pesquisa') { <aba-pesquisa [unidade]="u" /> }
      }
    } @else {
      <p class="dica">Carregando…</p>
    }
  `,
  styles: [`
    .topo { display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;
      h2 { font-size: 24px; } .sub { color: var(--texto-3); margin: 4px 0 0; font-size: 14px; }
      .voltar { color: var(--azul); text-decoration: none; font-size: 13px; display: inline-block; margin-bottom: 6px; } }
    .abas { display: flex; gap: 4px; border-bottom: 2px solid var(--borda); margin-bottom: 18px;
      button { border: 0; background: none; padding: 11px 16px; font: 600 14px var(--fonte); color: var(--texto-2);
        cursor: pointer; border-bottom: 3px solid transparent; margin-bottom: -2px; display: flex; gap: 7px; align-items: center;
        small { background: var(--borda); border-radius: 99px; padding: 1px 8px; font-size: 11.5px; }
        &.ativa { color: var(--azul); border-bottom-color: var(--azul);
          small { background: var(--azul-suave); color: var(--azul-escuro); } }
        &:hover { color: var(--azul-escuro); } } }
    .form-dados { max-width: 640px; }
    .linha { display: grid; grid-template-columns: 1fr 80px 160px; gap: 12px; }
    .separa { border: 0; border-top: 1px solid var(--borda); margin: 26px 0 18px; }
    h3 { font-size: 16px; }
    .dica { color: var(--texto-3); font-size: 13.5px; margin: 6px 0 14px; }
    .grupo-servico { margin-bottom: 14px;
      strong { display: block; margin-bottom: 8px; font-size: 14px; } }
    .opcoes { display: flex; flex-wrap: wrap; gap: 8px; }
    .opcao { display: inline-flex; align-items: center; gap: 8px; border: 1.5px solid var(--borda);
      border-radius: 8px; padding: 8px 12px; font-size: 13.5px; cursor: pointer; background: #fff;
      &:has(input:checked) { border-color: var(--azul); background: var(--azul-suave); }
      .prefixo { font: 700 11px var(--fonte); background: var(--marinho); color: #fff; border-radius: 5px; padding: 2px 6px; } }
  `],
})
export class UnidadeDetalhePagina implements OnInit {
  private readonly api = inject(Api);
  private readonly rota = inject(ActivatedRoute);
  private readonly toasts = inject(Toasts);
  private readonly auth = inject(Autenticacao);

  readonly unidade = signal<UnidadeDetalhe | null>(null);
  readonly catalogo = signal<Servico[]>([]);
  readonly abaAtiva = signal<Aba>('dados');
  readonly salvando = signal(false);
  readonly ofertados = signal<Set<string>>(new Set());
  readonly ehAdmin = this.auth.usuario()?.perfil === 'ADMIN';

  readonly abas: { id: Aba; rotulo: string }[] = [
    { id: 'dados', rotulo: 'Dados' },
    { id: 'guiches', rotulo: 'Guichês' },
    { id: 'dispositivos', rotulo: 'Dispositivos' },
    { id: 'equipe', rotulo: 'Equipe' },
    { id: 'pesquisa', rotulo: 'Pesquisa' },
  ];

  formDados = { nome: '', endereco: '', cidade: '', uf: 'DF', ativo: true };

  private get id(): string {
    return this.rota.snapshot.paramMap.get('id')!;
  }

  async ngOnInit() {
    this.catalogo.set(await this.api.get<Servico[]>('/servicos'));
    await this.recarregar();
  }

  async recarregar() {
    const u = await this.api.get<UnidadeDetalhe>(`/unidades/${this.id}`);
    this.unidade.set(u);
    this.formDados = { nome: u.nome, endereco: u.endereco, cidade: u.cidade, uf: u.uf, ativo: u.ativo };
    this.ofertados.set(new Set(u.subservicos.map((s) => s.id)));
  }

  alternarOferta(id: string) {
    this.ofertados.update((s) => {
      const novo = new Set(s);
      novo.has(id) ? novo.delete(id) : novo.add(id);
      return novo;
    });
  }

  async salvarDados() {
    this.salvando.set(true);
    try {
      await this.api.put(`/unidades/${this.id}`, this.formDados);
      this.toasts.sucesso('Dados da unidade salvos.');
      await this.recarregar();
    } catch (e) {
      this.toasts.erro(mensagemDeErro(e));
    } finally {
      this.salvando.set(false);
    }
  }

  async salvarOferta() {
    this.salvando.set(true);
    try {
      await this.api.put(`/unidades/${this.id}/subservicos`, { subservicoIds: [...this.ofertados()] });
      this.toasts.sucesso('Oferta de subserviços salva.');
      await this.recarregar();
    } catch (e) {
      this.toasts.erro(mensagemDeErro(e));
    } finally {
      this.salvando.set(false);
    }
  }
}
