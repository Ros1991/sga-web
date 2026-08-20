import { Component, Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  tipo: 'sucesso' | 'erro' | 'info';
  texto: string;
}

let proximoId = 1;

@Injectable({ providedIn: 'root' })
export class Toasts {
  readonly lista = signal<Toast[]>([]);

  sucesso(texto: string) { this.abrir('sucesso', texto); }
  erro(texto: string) { this.abrir('erro', texto, 6000); }
  info(texto: string) { this.abrir('info', texto); }

  private abrir(tipo: Toast['tipo'], texto: string, duracao = 3500) {
    const toast: Toast = { id: proximoId++, tipo, texto };
    this.lista.update((l) => [...l, toast]);
    setTimeout(() => this.fechar(toast.id), duracao);
  }

  fechar(id: number) {
    this.lista.update((l) => l.filter((t) => t.id !== id));
  }
}

@Component({
  selector: 'sga-toasts',
  template: `
    <div class="sga-toasts">
      @for (t of toasts.lista(); track t.id) {
        <div class="sga-toast" [class]="'sga-toast--' + t.tipo" (click)="toasts.fechar(t.id)">
          {{ t.texto }}
        </div>
      }
    </div>
  `,
  styles: [`
    .sga-toasts { position: fixed; top: 16px; right: 16px; z-index: 1000; display: grid; gap: 8px; max-width: 360px; }
    .sga-toast { padding: 12px 16px; border-radius: 8px; color: #fff; font-size: 14px; cursor: pointer;
      box-shadow: 0 4px 16px rgba(0,0,0,.25); animation: sga-toast-in .2s ease-out; }
    .sga-toast--sucesso { background: #1b7f4d; }
    .sga-toast--erro { background: #b4342a; }
    .sga-toast--info { background: #2a70e2; }
    @keyframes sga-toast-in { from { transform: translateY(-8px); opacity: 0; } to { transform: none; opacity: 1; } }
  `],
})
export class ToastsComponent {
  constructor(public toasts: Toasts) {}
}
