import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Autenticacao, Perfil } from 'compartilhado';

/** Rota inicial de cada perfil. */
export function rotaInicial(perfil: Perfil): string {
  switch (perfil) {
    case 'ATENDENTE': return '/atendimento';
    case 'TRIAGEM': return '/emitir';
    default: return '/inicio';
  }
}

export const autenticadoGuard: CanActivateFn = () => {
  const auth = inject(Autenticacao);
  const router = inject(Router);
  return auth.logado() ? true : router.createUrlTree(['/login']);
};

/** Restringe a rota aos perfis em data.perfis; fora deles, manda pra rota inicial. */
export const perfilGuard: CanActivateFn = (rota) => {
  const auth = inject(Autenticacao);
  const router = inject(Router);
  const usuario = auth.usuario();
  if (!usuario) return router.createUrlTree(['/login']);
  const perfis = (rota.data?.['perfis'] ?? []) as Perfil[];
  if (!perfis.length || perfis.includes(usuario.perfil)) return true;
  return router.createUrlTree([rotaInicial(usuario.perfil)]);
};
