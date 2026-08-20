import { Injectable, inject, signal } from '@angular/core';
import { Api } from './api';
import { ConfigDispositivo } from './modelos';

const CHAVE = 'sga.dispositivo.token';

/**
 * Sessão de DISPOSITIVO (totem/painel).
 * Ativação: abrir a URL com ?token=... — fica salvo e o aparelho entra sozinho.
 */
@Injectable({ providedIn: 'root' })
export class SessaoDispositivo {
  private readonly api = inject(Api);

  readonly config = signal<ConfigDispositivo | null>(null);
  readonly erro = signal<string | null>(null);

  get token(): string | null {
    return localStorage.getItem(CHAVE);
  }

  /** Lê ?token= da URL (se houver), persiste e carrega a configuração. */
  async iniciar(): Promise<ConfigDispositivo | null> {
    const daUrl = new URLSearchParams(location.search).get('token');
    if (daUrl) {
      localStorage.setItem(CHAVE, daUrl);
      history.replaceState(null, '', location.pathname); // esconde o token da barra
    }
    const token = this.token;
    if (!token) {
      this.erro.set('Dispositivo não ativado. Abra a URL de ativação gerada no portal.');
      return null;
    }
    try {
      const config = await this.api.get<ConfigDispositivo>('/dispositivo/config', this.headers());
      this.config.set(config);
      this.erro.set(null);
      return config;
    } catch {
      this.erro.set('Token inválido ou dispositivo desativado. Gere uma nova URL no portal.');
      return null;
    }
  }

  headers(): Record<string, string> {
    return { 'X-Device-Token': this.token ?? '' };
  }

  desativar(): void {
    localStorage.removeItem(CHAVE);
    this.config.set(null);
  }
}
