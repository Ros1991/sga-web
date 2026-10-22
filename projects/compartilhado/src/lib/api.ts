import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

/**
 * Base da API. Em servidor (Railway etc.) vem de /config.js, gerado pelo
 * servidor dos apps a partir da variável API_URL — o mesmo build serve
 * qualquer ambiente. Sem ela (desenvolvimento): o mesmo host que serviu a
 * página, na porta 3000, para o celular que abre a pesquisa pelo IP da
 * máquina falar com a API pelo mesmo IP.
 */
export const API_URL = new InjectionToken<string>('API_URL', {
  factory: () => {
    const configurada = (globalThis as { __SGA_CONFIG__?: { apiUrl?: string | null } }).__SGA_CONFIG__?.apiUrl;
    return configurada ? configurada.replace(/\/+$/, '') : `${location.protocol}//${location.hostname}:3000/api/v1`;
  },
});

/** Extrai a mensagem de erro amigável enviada pela API. */
export function mensagemDeErro(erro: unknown): string {
  if (erro instanceof HttpErrorResponse) {
    const corpo = erro.error;
    if (typeof corpo?.message === 'string') return corpo.message;
    if (Array.isArray(corpo?.message)) return corpo.message[0];
    if (erro.status === 0) return 'Não foi possível conectar ao servidor.';
  }
  return 'Algo deu errado. Tente novamente.';
}

/** Cliente HTTP fino sobre a API (promessas, tipado). */
@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_URL);

  get<T>(rota: string, headers?: Record<string, string>): Promise<T> {
    return firstValueFrom(this.http.get<T>(this.base + rota, { headers: new HttpHeaders(headers ?? {}) }));
  }

  post<T>(rota: string, corpo?: unknown, headers?: Record<string, string>): Promise<T> {
    return firstValueFrom(this.http.post<T>(this.base + rota, corpo ?? {}, { headers: new HttpHeaders(headers ?? {}) }));
  }

  put<T>(rota: string, corpo?: unknown): Promise<T> {
    return firstValueFrom(this.http.put<T>(this.base + rota, corpo ?? {}));
  }

  delete<T>(rota: string): Promise<T> {
    return firstValueFrom(this.http.delete<T>(this.base + rota));
  }
}
