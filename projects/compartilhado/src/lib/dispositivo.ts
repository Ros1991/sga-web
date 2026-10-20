import { HttpErrorResponse } from '@angular/common/http';
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
  /** API fora do ar ao ligar (troca de Wi-Fi, reinício): tentando de novo sozinho. */
  readonly conectando = signal(false);

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
    for (let tentativa = 1; ; tentativa++) {
      try {
        const config = await this.api.get<ConfigDispositivo>('/dispositivo/config', this.headers());
        this.config.set(config);
        this.erro.set(null);
        this.conectando.set(false);
        return config;
      } catch (e) {
        // 4xx: a API respondeu e recusou o token — não adianta insistir
        if (e instanceof HttpErrorResponse && e.status >= 400 && e.status < 500) {
          this.conectando.set(false);
          this.erro.set('Token inválido ou dispositivo desativado. Gere uma nova URL no portal.');
          return null;
        }
        // Sem resposta (ou 5xx): servidor fora do ar. Antes o painel ficava
        // "não ativado" até alguém recarregar; agora volta sozinho.
        this.conectando.set(true);
        await new Promise((pronto) => setTimeout(pronto, Math.min(2000 * tentativa, 10_000)));
      }
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
