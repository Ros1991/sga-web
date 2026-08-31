import { Injectable, OnDestroy, inject } from '@angular/core';
import { Socket, io } from 'socket.io-client';
import { API_URL } from './api';

/**
 * Conexão socket.io com a API (mesma origem da API_URL, sem o /api/v1).
 * Painel usa { deviceToken }; portal usa { accessToken } (+ unidadeId p/ ADMIN).
 */
@Injectable({ providedIn: 'root' })
export class Realtime implements OnDestroy {
  private readonly base = inject(API_URL).replace(/\/api\/v1\/?$/, '');
  private socket: Socket | null = null;

  conectar(auth: { deviceToken?: string; accessToken?: string }, unidadeId?: string): Socket {
    this.desconectar();
    this.socket = io(this.base, {
      auth,
      query: unidadeId ? { unidadeId } : undefined,
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 15000,
    });
    return this.socket;
  }

  /**
   * Registra o tratador do evento, substituindo qualquer anterior.
   * Sem o `off`, uma nova instância do componente (hot-reload em
   * desenvolvimento, ou remontagem de rota) acumularia tratadores no mesmo
   * socket e a mesma chamada seria anunciada várias vezes.
   */
  em<T>(evento: string, callback: (payload: T) => void): void {
    this.socket?.off(evento);
    this.socket?.on(evento, callback as (p: unknown) => void);
  }

  desconectar(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  ngOnDestroy(): void {
    this.desconectar();
  }
}
