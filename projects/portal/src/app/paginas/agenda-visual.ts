import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Api, Autenticacao, EventoMidia, Toasts, Unidade, mensagemDeErro } from 'compartilhado';

@Component({
  selector: 'pagina-agenda-visual',
  imports: [FormsModule, DatePipe],
  template: `
    <header class="topo">
      <div>
        <h2>Agenda Visual</h2>
        <p class="sub">Conteúdo exibido nos painéis entre as chamadas (vídeo, YouTube ou imagem)</p>
      </div>
      <button class="botao" (click)="abrirNovo()">+ Novo conteúdo</button>
    </header>

    <div class="cartao">
      <table class="tabela">
        <thead><tr><th>Título</th><th>Tipo</th><th>Exibição</th><th>Unidade</th><th>Situação</th><th></th></tr></thead>
        <tbody>
          @for (e of eventos(); track e.id) {
            <tr>
              <td><strong>{{ e.titulo }}</strong></td>
              <td><span class="etiqueta">{{ e.tipo }}</span></td>
              <td class="periodo">{{ e.inicio | date: 'dd/MM HH:mm' }} → {{ e.fim | date: 'dd/MM HH:mm' }}</td>
              <td>{{ nomeUnidade(e.unidadeId) }}</td>
              <td>
                <span class="etiqueta" [class.etiqueta--verde]="e.ativo" [class.etiqueta--cinza]="!e.ativo">
                  {{ e.ativo ? 'Ativo' : 'Inativo' }}
                </span>
              </td>
              <td class="direita">
                <button class="botao botao--fantasma" (click)="alternarAtivo(e)">{{ e.ativo ? 'Desativar' : 'Ativar' }}</button>
                <button class="botao botao--fantasma" (click)="remover(e)">Excluir</button>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="6" class="vazio">Nenhum conteúdo agendado.</td></tr>
          }
        </tbody>
      </table>
    </div>

    @if (modal()) {
      <div class="modal-fundo" (click)="modal.set(false)">
        <form class="modal" (click)="$event.stopPropagation()" (ngSubmit)="criar()">
          <header><h3>Novo conteúdo</h3></header>
          <div class="campo"><label>Título *</label><input [(ngModel)]="form.titulo" name="titulo" required /></div>
          <div class="campo"><label>Tipo *</label>
            <select [(ngModel)]="form.tipo" name="tipo">
              <option value="YOUTUBE">Vídeo do YouTube</option>
              <option value="IMAGEM">Imagem (URL)</option>
              <option value="VIDEO">Vídeo MP4 (URL)</option>
            </select>
          </div>
          @if (form.tipo === 'YOUTUBE') {
            <div class="campo">
              <label>ID do vídeo *</label>
              <input [(ngModel)]="form.videoId" name="videoId" placeholder="Ex.: U5LtZLMMkk0" required />
              <span class="dica-campo">Só o trecho depois de “v=” na URL do YouTube — não a URL inteira.</span>
            </div>
          } @else {
            <div class="campo"><label>URL da mídia *</label><input [(ngModel)]="form.url" name="url" required /></div>
          }
          <div class="linha">
            <div class="campo"><label>Início *</label><input type="datetime-local" [(ngModel)]="form.inicio" name="inicio" required /></div>
            <div class="campo"><label>Fim *</label><input type="datetime-local" [(ngModel)]="form.fim" name="fim" required /></div>
          </div>
          @if (ehAdmin) {
            <div class="campo"><label>Unidade</label>
              <select [(ngModel)]="form.unidadeId" name="unidadeId">
                <option value="">Todas as unidades</option>
                @for (u of unidades(); track u.id) { <option [value]="u.id">{{ u.nome }}</option> }
              </select>
            </div>
          }
          <div class="acoes-modal">
            <button type="button" class="botao botao--fantasma" (click)="modal.set(false)">Cancelar</button>
            <button class="botao" [disabled]="salvando()">Agendar</button>
          </div>
        </form>
      </div>
    }
  `,
  styles: [`
    .topo { display: flex; justify-content: space-between; align-items: end; margin-bottom: 22px;
      h2 { font-size: 24px; } .sub { color: var(--texto-3); margin: 4px 0 0; font-size: 14px; } }
    .periodo { font-size: 13px; color: var(--texto-2); white-space: nowrap; }
    .direita { text-align: right; white-space: nowrap; button { padding: 6px 10px; font-size: 13px; } }
    .vazio { color: var(--texto-3); text-align: center; padding: 24px !important; }
    .linha { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .dica-campo { font-size: 12px; color: var(--texto-3); }
  `],
})
export class AgendaVisualPagina implements OnInit {
  private readonly api = inject(Api);
  private readonly auth = inject(Autenticacao);
  private readonly toasts = inject(Toasts);

  readonly eventos = signal<EventoMidia[]>([]);
  readonly unidades = signal<Unidade[]>([]);
  readonly modal = signal(false);
  readonly salvando = signal(false);
  readonly ehAdmin = this.auth.usuario()?.perfil === 'ADMIN';

  form = { titulo: '', tipo: 'YOUTUBE', videoId: '', url: '', inicio: '', fim: '', unidadeId: '' };

  async ngOnInit() {
    this.unidades.set(await this.api.get<Unidade[]>('/unidades'));
    if (!this.ehAdmin) this.form.unidadeId = this.auth.usuario()?.unidadeId ?? '';
    await this.carregar();
  }

  async carregar() {
    const filtro = this.ehAdmin ? '' : `?unidadeId=${this.auth.usuario()?.unidadeId}`;
    this.eventos.set(await this.api.get<EventoMidia[]>(`/eventos-midia${filtro}`));
  }

  nomeUnidade(id: string | null) {
    if (!id) return 'Todas';
    return this.unidades().find((u) => u.id === id)?.nome ?? '—';
  }

  abrirNovo() {
    const agora = new Date();
    const fim = new Date(agora.getTime() + 8 * 3600_000);
    const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    this.form = {
      titulo: '', tipo: 'YOUTUBE', videoId: '', url: '',
      inicio: local(agora), fim: local(fim),
      unidadeId: this.ehAdmin ? '' : (this.auth.usuario()?.unidadeId ?? ''),
    };
    this.modal.set(true);
  }

  async criar() {
    this.salvando.set(true);
    try {
      await this.api.post('/eventos-midia', {
        titulo: this.form.titulo,
        tipo: this.form.tipo,
        videoId: this.form.tipo === 'YOUTUBE' ? this.form.videoId : undefined,
        url: this.form.tipo !== 'YOUTUBE' ? this.form.url : undefined,
        inicio: new Date(this.form.inicio).toISOString(),
        fim: new Date(this.form.fim).toISOString(),
        unidadeId: this.form.unidadeId || undefined,
      });
      this.toasts.sucesso('Conteúdo agendado. Os painéis atualizam sozinhos.');
      this.modal.set(false);
      await this.carregar();
    } catch (e) {
      this.toasts.erro(mensagemDeErro(e));
    } finally {
      this.salvando.set(false);
    }
  }

  async alternarAtivo(e: EventoMidia) {
    try {
      await this.api.put(`/eventos-midia/${e.id}`, { ativo: !e.ativo });
      await this.carregar();
    } catch (err) {
      this.toasts.erro(mensagemDeErro(err));
    }
  }

  async remover(e: EventoMidia) {
    if (!confirm(`Excluir "${e.titulo}"?`)) return;
    try {
      await this.api.delete(`/eventos-midia/${e.id}`);
      await this.carregar();
    } catch (err) {
      this.toasts.erro(mensagemDeErro(err));
    }
  }
}
