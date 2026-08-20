import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, Pesquisa, TipoPergunta, Toasts, UnidadeDetalhe, mensagemDeErro } from 'compartilhado';
import * as QRCode from 'qrcode';

interface PerguntaForm {
  tipo: TipoPergunta;
  texto: string;
  escalaMax: number;
  obrigatoria: boolean;
}

interface Resultados {
  totalRespostas: number;
  porPergunta: any[];
}

@Component({
  selector: 'aba-pesquisa',
  imports: [FormsModule],
  template: `
    <div class="cartao">
      @if (!pesquisas().length) {
        <div class="vazio-grande">
          <p>Nenhuma pesquisa de satisfação nesta unidade.</p>
          <button class="botao" (click)="criar()">Criar pesquisa</button>
        </div>
      }

      @for (p of pesquisas(); track p.id) {
        <div class="pesquisa">
          <div class="cabeca">
            <div>
              <h3>{{ p.nome }}</h3>
              <span class="etiqueta" [class.etiqueta--verde]="p.ativa" [class.etiqueta--cinza]="!p.ativa">
                {{ p.ativa ? 'Ativa' : 'Encerrada' }}
              </span>
            </div>
            <div class="acoes">
              <button class="botao botao--fantasma" (click)="mostrarQr(p)">QR / Link</button>
              <button class="botao botao--fantasma" (click)="verResultados(p)">Resultados</button>
              <button class="botao botao--fantasma" (click)="alternarAtiva(p)">{{ p.ativa ? 'Encerrar' : 'Reativar' }}</button>
            </div>
          </div>

          <h4>Perguntas (na ordem em que o cidadão responde)</h4>
          @for (q of perguntas; track $index) {
            <div class="pergunta">
              <span class="ordem">{{ $index + 1 }}</span>
              <select [(ngModel)]="q.tipo" [name]="'tipo' + $index">
                <option value="NOTA">Nota</option>
                <option value="SIM_NAO">Sim/Não</option>
                <option value="TEXTO">Texto livre</option>
              </select>
              <input [(ngModel)]="q.texto" [name]="'texto' + $index" placeholder="Texto da pergunta" />
              @if (q.tipo === 'NOTA') {
                <select [(ngModel)]="q.escalaMax" [name]="'escala' + $index" class="estreito">
                  <option [ngValue]="5">1–5</option>
                  <option [ngValue]="10">1–10</option>
                </select>
              }
              <label class="obrig"><input type="checkbox" [(ngModel)]="q.obrigatoria" [name]="'ob' + $index" /> obrig.</label>
              <button type="button" class="botao botao--fantasma" (click)="removerPergunta($index)" [disabled]="perguntas.length === 1">✕</button>
            </div>
          }
          <div class="rodape-perguntas">
            <button class="botao botao--contorno" (click)="adicionarPergunta()">+ Pergunta</button>
            <button class="botao" (click)="salvarPerguntas(p)" [disabled]="salvando()">Salvar perguntas</button>
          </div>
        </div>
      }
    </div>

    @if (qr(); as info) {
      <div class="modal-fundo" (click)="qr.set(null)">
        <div class="modal qr-caixa" (click)="$event.stopPropagation()">
          <header><h3>Avaliação — QR para o guichê</h3></header>
          <img [src]="info.imagem" alt="QR Code da pesquisa" />
          <p class="url">{{ info.url }}</p>
          <div class="acoes-modal">
            <button class="botao botao--contorno" (click)="copiar(info.url)">Copiar link</button>
            <button class="botao" (click)="qr.set(null)">Fechar</button>
          </div>
        </div>
      </div>
    }

    @if (resultados(); as r) {
      <div class="modal-fundo" (click)="resultados.set(null)">
        <div class="modal" (click)="$event.stopPropagation()">
          <header><h3>Resultados · {{ r.totalRespostas }} resposta(s)</h3></header>
          @for (item of r.porPergunta; track item.pergunta.id) {
            <div class="resultado">
              <strong>{{ item.pergunta.ordem }}. {{ item.pergunta.texto }}</strong>
              @if (item.pergunta.tipo === 'NOTA') {
                <p>Média: <b>{{ item.media ?? '—' }}</b> ({{ item.total }} respostas)</p>
              } @else if (item.pergunta.tipo === 'SIM_NAO') {
                <p><b class="sim">Sim: {{ item.sim }}</b> · <b class="nao">Não: {{ item.nao }}</b></p>
              } @else {
                @for (t of item.textos.slice(0, 6); track $index) { <p class="texto-livre">“{{ t }}”</p> }
                @if (!item.textos.length) { <p class="texto-livre">Sem comentários.</p> }
              }
            </div>
          }
          <div class="acoes-modal"><button class="botao" (click)="resultados.set(null)">Fechar</button></div>
        </div>
      </div>
    }
  `,
  styles: [`
    .vazio-grande { text-align: center; padding: 30px; color: var(--texto-3); display: grid; gap: 14px; justify-items: center; }
    .pesquisa { .cabeca { display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;
        h3 { font-size: 17px; display: inline; margin-right: 10px; } }
      h4 { font-size: 13px; color: var(--texto-2); margin: 14px 0 10px; } }
    .acoes button { padding: 6px 10px; font-size: 13px; }
    .pergunta { display: grid; grid-template-columns: 26px 120px 1fr auto auto auto; gap: 8px; align-items: center; margin-bottom: 8px;
      .ordem { width: 26px; height: 26px; border-radius: 50%; background: var(--marinho); color: #fff;
        display: grid; place-items: center; font-size: 12px; font-weight: 700; }
      select, input[type=text], input:not([type]) { padding: 8px 10px; border: 1.5px solid var(--borda); border-radius: 8px; font: 13.5px var(--fonte); }
      .estreito { width: 80px; }
      .obrig { font-size: 12.5px; color: var(--texto-2); display: flex; gap: 4px; align-items: center; white-space: nowrap; } }
    .rodape-perguntas { display: flex; justify-content: space-between; margin-top: 14px; }
    .qr-caixa { text-align: center; width: min(380px, 100%);
      img { width: 240px; height: 240px; margin: 8px auto; }
      .url { font-size: 12px; color: var(--texto-3); word-break: break-all; } }
    .resultado { border-top: 1px solid var(--borda); padding: 12px 0; font-size: 14px;
      .sim { color: var(--verde); } .nao { color: var(--vermelho); }
      .texto-livre { color: var(--texto-2); font-style: italic; margin: 4px 0; } }
  `],
})
export class AbaPesquisa implements OnInit {
  @Input({ required: true }) unidade!: UnidadeDetalhe;

  private readonly api = inject(Api);
  private readonly toasts = inject(Toasts);

  readonly pesquisas = signal<Pesquisa[]>([]);
  readonly salvando = signal(false);
  readonly qr = signal<{ url: string; imagem: string } | null>(null);
  readonly resultados = signal<Resultados | null>(null);

  perguntas: PerguntaForm[] = [];

  async ngOnInit() {
    await this.carregar();
  }

  async carregar() {
    const todas = await this.api.get<Pesquisa[]>('/pesquisas');
    const daUnidade = todas.filter((p) => p.unidadeId === this.unidade.id);
    if (daUnidade.length) {
      const detalhe = await this.api.get<Pesquisa>(`/pesquisas/${daUnidade[0].id}`);
      this.pesquisas.set([detalhe]);
      this.perguntas = (detalhe.perguntas ?? []).map((q) => ({
        tipo: q.tipo, texto: q.texto, escalaMax: q.escalaMax ?? 5, obrigatoria: q.obrigatoria,
      }));
      if (!this.perguntas.length) this.adicionarPergunta();
    } else {
      this.pesquisas.set([]);
    }
  }

  async criar() {
    try {
      await this.api.post<Pesquisa>('/pesquisas', {
        nome: `Avaliação do atendimento — ${this.unidade.nome}`,
        unidadeId: this.unidade.id,
      });
      this.toasts.sucesso('Pesquisa criada. Agora defina as perguntas.');
      await this.carregar();
    } catch (e) {
      this.toasts.erro(mensagemDeErro(e));
    }
  }

  adicionarPergunta() {
    this.perguntas.push({ tipo: 'NOTA', texto: '', escalaMax: 5, obrigatoria: false });
  }

  removerPergunta(i: number) {
    this.perguntas.splice(i, 1);
  }

  async salvarPerguntas(p: Pesquisa) {
    if (this.perguntas.some((q) => !q.texto.trim())) {
      return this.toasts.erro('Há pergunta sem texto.');
    }
    this.salvando.set(true);
    try {
      await this.api.put(`/pesquisas/${p.id}/perguntas`, { perguntas: this.perguntas });
      this.toasts.sucesso('Perguntas salvas.');
    } catch (e) {
      this.toasts.erro(mensagemDeErro(e));
    } finally {
      this.salvando.set(false);
    }
  }

  async alternarAtiva(p: Pesquisa) {
    try {
      await this.api.put(`/pesquisas/${p.id}`, { ativa: !p.ativa });
      await this.carregar();
    } catch (e) {
      this.toasts.erro(mensagemDeErro(e));
    }
  }

  async mostrarQr(p: Pesquisa) {
    const imagem = await QRCode.toDataURL(p.urlPublica, { width: 480, margin: 1 });
    this.qr.set({ url: p.urlPublica, imagem });
  }

  copiar(texto: string) {
    navigator.clipboard.writeText(texto);
    this.toasts.sucesso('Link copiado.');
  }

  async verResultados(p: Pesquisa) {
    this.resultados.set(await this.api.get<Resultados>(`/pesquisas/${p.id}/resultados`));
  }
}
