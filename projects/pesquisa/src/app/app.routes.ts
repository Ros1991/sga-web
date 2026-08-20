import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./inicio/inicio').then((m) => m.InicioComponent),
  },
  {
    path: 'p/:codigo',
    loadComponent: () => import('./pesquisa/pesquisa').then((m) => m.PesquisaComponent),
  },
  { path: '**', redirectTo: '' },
];
