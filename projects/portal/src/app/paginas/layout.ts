import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Autenticacao, ToastsComponent } from 'compartilhado';

interface ItemMenu {
  rotulo: string;
  rota: string;
  icone: string; // emoji simples — sem dependência de fonte de ícones
}

/** Navegação FIXA por perfil — decisão da OS: nada de menus dinâmicos. */
const MENUS: Record<string, ItemMenu[]> = {
  ADMIN: [
    { rotulo: 'Início', rota: '/inicio', icone: '📊' },
    { rotulo: 'Unidades', rota: '/unidades', icone: '🏢' },
    { rotulo: 'Serviços', rota: '/servicos', icone: '🗂️' },
    { rotulo: 'Prioridades', rota: '/prioridades', icone: '♿' },
    { rotulo: 'Usuários', rota: '/usuarios', icone: '👥' },
    { rotulo: 'Agenda Visual', rota: '/agenda-visual', icone: '🎬' },
    { rotulo: 'Atendimento', rota: '/atendimento', icone: '🎧' },
    { rotulo: 'Emitir senha', rota: '/emitir', icone: '🎫' },
  ],
  GERENTE: [
    { rotulo: 'Início', rota: '/inicio', icone: '📊' },
    { rotulo: 'Minha unidade', rota: '/unidades', icone: '🏢' },
    { rotulo: 'Usuários', rota: '/usuarios', icone: '👥' },
    { rotulo: 'Agenda Visual', rota: '/agenda-visual', icone: '🎬' },
    { rotulo: 'Atendimento', rota: '/atendimento', icone: '🎧' },
    { rotulo: 'Emitir senha', rota: '/emitir', icone: '🎫' },
  ],
  ATENDENTE: [
    { rotulo: 'Atendimento', rota: '/atendimento', icone: '🎧' },
    { rotulo: 'Emitir senha', rota: '/emitir', icone: '🎫' },
  ],
  TRIAGEM: [{ rotulo: 'Emitir senha', rota: '/emitir', icone: '🎫' }],
};

@Component({
  selector: 'pagina-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastsComponent],
  template: `
    <div class="casca">
      <aside>
        <div class="logo"><span>SGA</span> DETRAN-DF</div>
        <nav>
          @for (item of menu(); track item.rota) {
            <a [routerLink]="item.rota" routerLinkActive="ativo">
              <span class="icone">{{ item.icone }}</span>{{ item.rotulo }}
            </a>
          }
        </nav>
        <footer>
          <div class="quem">
            <strong>{{ usuario()?.nome }}</strong>
            <small>{{ rotuloPerfil() }}</small>
          </div>
          <button class="botao botao--fantasma sair" (click)="sair()">Sair</button>
        </footer>
      </aside>
      <main>
        <router-outlet />
      </main>
    </div>
    <sga-toasts />
  `,
  styles: [`
    .casca { display: grid; grid-template-columns: 236px 1fr; min-height: 100vh; }
    aside { background: var(--marinho); color: #dbe4f2; display: flex; flex-direction: column;
      position: sticky; top: 0; height: 100vh; }
    .logo { padding: 22px 20px; font-weight: 700; letter-spacing: .04em; font-size: 14px; color: #9fb3d1;
      span { background: var(--azul); color: #fff; border-radius: 8px; padding: 4px 9px; margin-right: 8px; font-size: 14px; } }
    nav { flex: 1; padding: 8px 10px; display: grid; gap: 2px; align-content: start;
      a { display: flex; align-items: center; gap: 10px; padding: 11px 12px; border-radius: 8px;
        color: #c4d2e6; text-decoration: none; font-size: 14px;
        &:hover { background: var(--marinho-2); }
        &.ativo { background: var(--azul); color: #fff; font-weight: 600; } }
      .icone { width: 20px; text-align: center; } }
    footer { padding: 14px 16px; border-top: 1px solid var(--marinho-2); display: grid; gap: 8px;
      .quem { display: grid; strong { font-size: 13.5px; color: #fff; } small { color: #9fb3d1; font-size: 12px; } }
      .sair { color: #c4d2e6; justify-content: flex-start; padding: 6px 8px; } }
    main { padding: 28px 32px; max-width: 1200px; width: 100%; }
  `],
})
export class LayoutPagina {
  private readonly auth = inject(Autenticacao);
  private readonly router = inject(Router);

  readonly usuario = this.auth.usuario;
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
