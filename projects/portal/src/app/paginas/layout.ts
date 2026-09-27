import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Autenticacao, ToastsComponent } from 'compartilhado';

interface ItemMenu {
  rotulo: string;
  rota: string;
}

/** Navegação FIXA por perfil — decisão da OS: nada de menus dinâmicos. */
const MENUS: Record<string, ItemMenu[]> = {
  ADMIN: [
    { rotulo: 'Início', rota: '/inicio' },
    { rotulo: 'Unidades', rota: '/unidades' },
    { rotulo: 'Serviços', rota: '/servicos' },
    { rotulo: 'Prioridades', rota: '/prioridades' },
    { rotulo: 'Usuários', rota: '/usuarios' },
    { rotulo: 'Relatórios', rota: '/relatorios' },
    { rotulo: 'Agenda Visual', rota: '/agenda-visual' },
    { rotulo: 'Atendimento', rota: '/atendimento' },
    { rotulo: 'Emitir senha', rota: '/emitir' },
  ],
  GERENTE: [
    { rotulo: 'Início', rota: '/inicio' },
    { rotulo: 'Minha unidade', rota: '/unidades' },
    { rotulo: 'Usuários', rota: '/usuarios' },
    { rotulo: 'Relatórios', rota: '/relatorios' },
    { rotulo: 'Agenda Visual', rota: '/agenda-visual' },
    { rotulo: 'Atendimento', rota: '/atendimento' },
    { rotulo: 'Emitir senha', rota: '/emitir' },
  ],
  ATENDENTE: [
    { rotulo: 'Atendimento', rota: '/atendimento' },
    { rotulo: 'Emitir senha', rota: '/emitir' },
  ],
  TRIAGEM: [{ rotulo: 'Emitir senha', rota: '/emitir' }],
};

@Component({
  selector: 'pagina-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastsComponent],
  template: `
    <header class="topo-portal">
      <div class="faixa">
        <a routerLink="/" class="marca"><strong>DETRAN</strong>&nbsp;- DF <span class="sga">SGA</span></a>

        <nav class="menu" [class.aberto]="menuAberto()">
          @for (item of menu(); track item.rota) {
            <a [routerLink]="item.rota" routerLinkActive="ativo" (click)="menuAberto.set(false)">{{ item.rotulo }}</a>
          }
        </nav>

        <div class="direita">
          <div class="quem">
            <span class="nome">{{ usuario()?.nome }}</span>
            <span class="perfil">{{ rotuloPerfil() }}</span>
          </div>
          <button class="sair" (click)="sair()" title="Sair do sistema">Sair</button>
          <button class="hamburguer" (click)="menuAberto.set(!menuAberto())" aria-label="Menu">☰</button>
        </div>
      </div>
    </header>

    <main>
      <div class="conteudo">
        <router-outlet />
      </div>
    </main>
    <sga-toasts />
  `,
  styles: [`
    :host { display: block; min-height: 100vh;
      background: var(--fundo) url('/main_back.png') no-repeat top center / cover; }

    .topo-portal { background: #fff; border-bottom: 2px solid #edecec; position: sticky; top: 0; z-index: 30; }
    .faixa { max-width: var(--largura-conteudo); margin: 0 auto; height: 64px; padding: 0 20px;
      display: flex; align-items: center; gap: 28px; }

    .marca { font-family: var(--fonte-marca); font-size: 28px; color: var(--azul);
      text-decoration: none; display: flex; align-items: baseline; white-space: nowrap;
      strong { font-weight: 700; }
      .sga { font: 600 11px var(--fonte); letter-spacing: .1em; color: #fff; background: var(--azul);
        border-radius: 4px; padding: 2px 7px; margin-left: 10px; align-self: center; } }

    .menu { display: flex; align-items: center; gap: 2px; flex: 1; height: 100%;
      a { font-size: 15px; color: var(--azul-escuro); text-decoration: none; padding: 0 13px;
        height: 100%; display: inline-flex; align-items: center; border-bottom: 3px solid transparent;
        white-space: nowrap;
        &:hover { color: var(--azul); }
        &.ativo { color: var(--azul); border-bottom-color: var(--azul); font-weight: 500; } } }

    .direita { display: flex; align-items: center; gap: 14px; }
    .quem { display: grid; text-align: right; line-height: 1.25;
      .nome { font-size: 13.5px; font-weight: 500; color: var(--azul-escuro); }
      .perfil { font-size: 11.5px; color: var(--texto-3); } }
    .sair { border: 1px solid var(--azul); background: #fff; color: var(--azul); border-radius: 6px;
      padding: 7px 16px; font: 500 13px var(--fonte); cursor: pointer;
      &:hover { background: var(--azul-suave); } }
    .hamburguer { display: none; border: 0; background: none; font-size: 22px; color: var(--azul-escuro); cursor: pointer; }

    main { padding: 28px 20px 60px; }
    .conteudo { max-width: var(--largura-conteudo); margin: 0 auto; }

    @media (max-width: 1080px) {
      .menu { position: fixed; inset: 64px 0 auto 0; background: #fff; flex-direction: column;
        align-items: stretch; height: auto; padding: 8px 0; border-bottom: 2px solid #edecec;
        box-shadow: var(--sombra-2); display: none;
        a { height: 48px; padding: 0 24px; border-bottom: 0; border-left: 3px solid transparent;
          &.ativo { border-left-color: var(--azul); background: var(--fundo); } } }
      .menu.aberto { display: flex; }
      .hamburguer { display: block; }
      .quem { display: none; }
    }
  `],
})
export class LayoutPagina {
  private readonly auth = inject(Autenticacao);
  private readonly router = inject(Router);

  readonly usuario = this.auth.usuario;
  readonly menuAberto = signal(false);
  readonly menu = computed(() => MENUS[this.usuario()?.perfil ?? ''] ?? []);
  readonly rotuloPerfil = computed(() => {
    const mapa: Record<string, string> = {
      ADMIN: 'Administrador', GERENTE: 'Gerente de unidade',
      ATENDENTE: 'Atendente', TRIAGEM: 'Triagem',
    };
    return mapa[this.usuario()?.perfil ?? ''] ?? '';
  });

  sair() {
    this.auth.sair();
    this.router.navigateByUrl('/login');
  }
}
