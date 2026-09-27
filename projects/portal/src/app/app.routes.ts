import { Routes } from '@angular/router';
import { autenticadoGuard, perfilGuard } from './guards';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./paginas/login').then((m) => m.LoginPagina) },
  {
    path: '',
    canActivate: [autenticadoGuard],
    loadComponent: () => import('./paginas/layout').then((m) => m.LayoutPagina),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      {
        path: 'inicio',
        canActivate: [perfilGuard],
        data: { perfis: ['ADMIN', 'GERENTE'] },
        loadComponent: () => import('./paginas/dashboard').then((m) => m.DashboardPagina),
      },
      {
        path: 'unidades',
        canActivate: [perfilGuard],
        data: { perfis: ['ADMIN', 'GERENTE'] },
        loadComponent: () => import('./paginas/unidades').then((m) => m.UnidadesPagina),
      },
      {
        path: 'unidades/:id',
        canActivate: [perfilGuard],
        data: { perfis: ['ADMIN', 'GERENTE'] },
        loadComponent: () => import('./paginas/unidade-detalhe').then((m) => m.UnidadeDetalhePagina),
      },
      {
        path: 'servicos',
        canActivate: [perfilGuard],
        data: { perfis: ['ADMIN'] },
        loadComponent: () => import('./paginas/catalogo').then((m) => m.CatalogoPagina),
      },
      {
        path: 'prioridades',
        canActivate: [perfilGuard],
        data: { perfis: ['ADMIN'] },
        loadComponent: () => import('./paginas/prioridades').then((m) => m.PrioridadesPagina),
      },
      {
        path: 'usuarios',
        canActivate: [perfilGuard],
        data: { perfis: ['ADMIN', 'GERENTE'] },
        loadComponent: () => import('./paginas/usuarios').then((m) => m.UsuariosPagina),
      },
      {
        path: 'relatorios',
        canActivate: [perfilGuard],
        data: { perfis: ['ADMIN', 'GERENTE'] },
        loadComponent: () => import('./paginas/relatorios').then((m) => m.RelatoriosPagina),
      },
      {
        path: 'agenda-visual',
        canActivate: [perfilGuard],
        data: { perfis: ['ADMIN', 'GERENTE'] },
        loadComponent: () => import('./paginas/agenda-visual').then((m) => m.AgendaVisualPagina),
      },
      {
        path: 'atendimento',
        canActivate: [perfilGuard],
        data: { perfis: ['ADMIN', 'GERENTE', 'ATENDENTE'] },
        loadComponent: () => import('./paginas/atendimento').then((m) => m.AtendimentoPagina),
      },
      {
        path: 'emitir',
        canActivate: [perfilGuard],
        data: { perfis: ['ADMIN', 'GERENTE', 'TRIAGEM', 'ATENDENTE'] },
        loadComponent: () => import('./paginas/emitir').then((m) => m.EmitirPagina),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
