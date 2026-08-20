import { HttpErrorResponse, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { Api } from './api';
import { RespostaLogin, UsuarioLogado } from './modelos';

const CHAVE = 'sga.sessao';

interface Sessao {
  accessToken: string;
  refreshToken: string;
  usuario: UsuarioLogado;
}

/** Sessão do usuário (portal) com signals + refresh automático. */
@Injectable({ providedIn: 'root' })
export class Autenticacao {
  private readonly api = inject(Api);
  private readonly sessao = signal<Sessao | null>(this.carregar());

  readonly usuario = computed(() => this.sessao()?.usuario ?? null);
  readonly logado = computed(() => this.sessao() !== null);

  get accessToken(): string | null {
    return this.sessao()?.accessToken ?? null;
  }

  async entrar(login: string, senha: string): Promise<UsuarioLogado> {
    const resposta = await this.api.post<RespostaLogin>('/auth/login', { login, senha });
    this.gravar(resposta);
    return resposta.usuario;
  }

  sair(): void {
    localStorage.removeItem(CHAVE);
    this.sessao.set(null);
  }

  async renovar(): Promise<string | null> {
    const atual = this.sessao();
    if (!atual) return null;
    try {
      const resposta = await this.api.post<RespostaLogin>('/auth/refresh', {
        refreshToken: atual.refreshToken,
      });
      this.gravar(resposta);
      return resposta.accessToken;
    } catch {
      this.sair();
      return null;
    }
  }

  private gravar(r: RespostaLogin): void {
    const sessao: Sessao = { accessToken: r.accessToken, refreshToken: r.refreshToken, usuario: r.usuario };
    localStorage.setItem(CHAVE, JSON.stringify(sessao));
    this.sessao.set(sessao);
  }

  private carregar(): Sessao | null {
    try {
      const bruto = localStorage.getItem(CHAVE);
      return bruto ? (JSON.parse(bruto) as Sessao) : null;
    } catch {
      return null;
    }
  }
}

/** Interceptor: anexa o Bearer e tenta 1 refresh em caso de 401. */
export function authInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn) {
  const auth = inject(Autenticacao);
  const token = auth.accessToken;
  const ehAuth = req.url.includes('/auth/login') || req.url.includes('/auth/refresh');
  const comToken = token && !ehAuth ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(comToken).pipe(
    catchError((erro: unknown) => {
      if (erro instanceof HttpErrorResponse && erro.status === 401 && token && !ehAuth) {
        return from(auth.renovar()).pipe(
          switchMap((novo) => {
            if (!novo) return throwError(() => erro);
            return next(req.clone({ setHeaders: { Authorization: `Bearer ${novo}` } }));
          }),
        );
      }
      return throwError(() => erro);
    }),
  );
}
