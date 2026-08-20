import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, Dispositivo, Toasts, UnidadeDetalhe, mensagemDeErro } from 'compartilhado';
import * as QRCode from 'qrcode';

@Component({
  selector: 'aba-dispositivos',
  imports: [FormsModule],
  template: `
    <div class="cartao">
      <div class="cabeca">
        <p class="dica">
          Totem emite senhas; Painel é a TV da sala de espera. Abra a URL de ativação no
          aparelho — ele entra sozinho, sem digitar nada.
        </p>
        <button class="botao" (click)="modal.set(true)">+ Novo dispositivo</button>
      </div>

      <table class="tabela">
        <thead><tr><th>Nome</th><th>Tipo</th><th>Situação</th><th class="direita">Ações</th></tr></thead>
        <tbody>
          @for (d of unidade.dispositivos; track d.id) {
            <tr>
              <td><strong>{{ d.nome }}</strong></td>
              <td>
                <span class="etiqueta" [class.etiqueta--ambar]="d.tipo === 'TOTEM'">
                  {{ d.tipo === 'TOTEM' ? '🎫 Totem' : '📺 Painel' }}
                </span>
              </td>
              <td>
                <span class="etiqueta" [class.etiqueta--verde]="d.ativo" [class.etiqueta--cinza]="!d.ativo">
                  {{ d.ativo ? 'Ativo' : 'Inativo' }}
                </span>
              </td>
              <td class="direita acoes">
                <button class="botao botao--fantasma" (click)="copiar(d)">Copiar URL</button>
                <button class="botao botao--fantasma" (click)="mostrarQr(d)">QR</button>
                <button class="botao botao--fantasma" (click)="renovar(d)">Renovar token</button>
                <button class="botao botao--fantasma" (click)="alternarAtivo(d)">
                  {{ d.ativo ? 'Desativar' : 'Ativar' }}
                </button>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="4" class="vazio">Nenhum dispositivo ainda.</td></tr>
          }
        </tbody>
      </table>
    </div>

    @if (modal()) {
      <div class="modal-fundo" (click)="modal.set(false)">
        <form class="modal" (click)="$event.stopPropagation()" (ngSubmit)="criar()">
          <header><h3>Novo dispositivo</h3></header>
          <div class="campo">
            <label>Nome *</label>
            <input [(ngModel)]="form.nome" name="nome" required placeholder="Ex.: Totem da entrada" />
          </div>
          <div class="campo">
            <label>Tipo *</label>
            <div class="tipos">
              <label class="tipo" [class.marcado]="form.tipo === 'TOTEM'">
                <input type="radio" name="tipo" value="TOTEM" [(ngModel)]="form.tipo" />
                <strong>🎫 Totem</strong><small>Emite senhas (autoatendimento)</small>
              </label>
              <label class="tipo" [class.marcado]="form.tipo === 'PAINEL'">
                <input type="radio" name="tipo" value="PAINEL" [(ngModel)]="form.tipo" />
                <strong>📺 Painel</strong><small>TV com fila, chamadas e mídia</small>
              </label>
            </div>
          </div>
          <div class="acoes-modal">
            <button type="button" class="botao botao--fantasma" (click)="modal.set(false)">Cancelar</button>
            <button class="botao" [disabled]="salvando()">Criar</button>
          </div>
        </form>
      </div>
    }

    @if (qr(); as info) {
      <div class="modal-fundo" (click)="qr.set(null)">
        <div class="modal qr-caixa" (click)="$event.stopPropagation()">
          <header><h3>{{ info.nome }}</h3></header>
          <img [src]="info.imagem" alt="QR Code de ativação" />
          <p class="url">{{ info.url }}</p>
          <div class="acoes-modal">
            <button class="botao botao--contorno" (click)="copiarTexto(info.url)">Copiar URL</button>
            <button class="botao" (click)="qr.set(null)">Fechar</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .cabeca { display: flex; justify-content: space-between; align-items: start; gap: 16px; margin-bottom: 14px; }
    .dica { color: var(--texto-3); font-size: 13.5px; margin: 0; max-width: 560px; }
    .direita { text-align: right; }
    .acoes { white-space: nowrap; button { padding: 6px 10px; font-size: 13px; } }
    .vazio { color: var(--texto-3); text-align: center; padding: 24px !important; }
    .tipos { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .tipo { border: 1.5px solid var(--borda); border-radius: 10px; padding: 14px; cursor: pointer; display: grid; gap: 4px;
      input { display: none; }
      small { color: var(--texto-3); font-size: 12.5px; }
      &.marcado { border-color: var(--azul); background: var(--azul-suave); } }
    .qr-caixa { text-align: center; width: min(380px, 100%);
      img { width: 240px; height: 240px; margin: 8px auto; }
      .url { font-size: 12px; color: var(--texto-3); word-break: break-all; } }
  `],
})
export class AbaDispositivos {
  @Input({ required: true }) unidade!: UnidadeDetalhe;
  @Output() mudou = new EventEmitter<void>();

  private readonly api = inject(Api);
  private readonly toasts = inject(Toasts);

  readonly modal = signal(false);
  readonly salvando = signal(false);
  readonly qr = signal<{ nome: string; url: string; imagem: string } | null>(null);

  form = { nome: '', tipo: 'TOTEM' as 'TOTEM' | 'PAINEL' };

  async criar() {
    if (!this.form.nome.trim()) return this.toasts.erro('Informe um nome para o dispositivo.');
    this.salvando.set(true);
    try {
      const d = await this.api.post<Dispositivo>(`/unidades/${this.unidade.id}/dispositivos`, this.form);
      this.toasts.sucesso(`${d.nome} criado. Use "Copiar URL" ou o QR para ativar no aparelho.`);
      this.modal.set(false);
      this.form = { nome: '', tipo: 'TOTEM' };
      this.mudou.emit();
    } catch (e) {
      this.toasts.erro(mensagemDeErro(e));
    } finally {
      this.salvando.set(false);
    }
  }

  async mostrarQr(d: Dispositivo) {
    const imagem = await QRCode.toDataURL(d.urlAtivacao, { width: 480, margin: 1 });
    this.qr.set({ nome: d.nome, url: d.urlAtivacao, imagem });
  }

  copiar(d: Dispositivo) {
    this.copiarTexto(d.urlAtivacao);
  }

  copiarTexto(texto: string) {
    navigator.clipboard.writeText(texto);
    this.toasts.sucesso('URL copiada.');
  }

  async renovar(d: Dispositivo) {
    if (!confirm(`Renovar o token de "${d.nome}"? A URL antiga deixa de funcionar.`)) return;
    try {
      await this.api.post(`/unidades/dispositivos/${d.id}/renovar-token`);
      this.toasts.sucesso('Token renovado. Reative o aparelho com a nova URL.');
      this.mudou.emit();
    } catch (e) {
      this.toasts.erro(mensagemDeErro(e));
    }
  }

  async alternarAtivo(d: Dispositivo) {
    try {
      await this.api.put(`/unidades/dispositivos/${d.id}`, { ativo: !d.ativo });
      this.mudou.emit();
    } catch (e) {
      this.toasts.erro(mensagemDeErro(e));
    }
  }
}
