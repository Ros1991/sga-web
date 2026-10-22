import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, Pesquisa, TipoPergunta, Toasts, UnidadeDetalhe, mensagemDeErro } from 'compartilhado';
import * as QRCode from 'qrcode';

interface PerguntaForm {
  /** Pergunta já salva — volta no PUT para ser editada no lugar e manter as respostas. */
  id?: string;
  tipo: TipoPergunta;
  texto: string;
  escalaMax: number;
  obrigatoria: boolean;
  /** Botões da pergunta OPCOES, na ordem em que o cidadão os vê. */
  opcoes: { rotulo: string; valor: number }[];
}

/** Sugestão inicial de botões (o gestor troca textos, valores e ordem). */
const OPCOES_SUGERIDAS = [
  { rotulo: 'Péssimo', valor: 1 },
  { rotulo: 'Ruim', valor: 2 },
  { rotulo: 'Bom', valor: 3 },
  { rotulo: 'Muito bom', valor: 4 },
];

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
          @for (q of perguntas; track $index; let i = $index) {
            <div class="pergunta">
              <span class="ordem">{{ $index + 1 }}</span>
              <select [(ngModel)]="q.tipo" [name]="'tipo' + $index" (ngModelChange)="aoTrocarTipo(q)">
                <option value="NOTA">Nota (números)</option>
                <option value="OPCOES">Opções com texto</option>
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
            @if (q.tipo === 'OPCOES') {
              <div class="opcoes-editor">
                <div class="opcoes-cabeca">
                  <span>Botões, na ordem em que o cidadão vê</span>
                  <span class="col-valor" title="Entra nas médias e no percentual de satisfação; o maior valor vale 100%">Valor</span>
                </div>
                @for (o of q.opcoes; track $index; let j = $index, primeira = $first, ultima = $last) {
                  <div class="opcao-linha">
                    <span class="opcao-ordem">{{ j + 1 }}</span>
                    <input [(ngModel)]="o.rotulo" [name]="'op' + i + '_' + j" placeholder="Texto do botão (ex.: Muito bom)" maxlength="60" />
                    <input type="number" class="valor" [(ngModel)]="o.valor" [name]="'val' + i + '_' + j" min="0" max="100" step="1" />
                    <button type="button" class="botao botao--fantasma seta" (click)="moverOpcao(q, j, -1)" [disabled]="primeira" title="Subir">↑</button>
                    <button type="button" class="botao botao--fantasma seta" (click)="moverOpcao(q, j, 1)" [disabled]="ultima" title="Descer">↓</button>
                    <button type="button" class="botao botao--fantasma seta" (click)="q.opcoes.splice(j, 1)" [disabled]="q.opcoes.length <= 2" title="Remover">✕</button>
                  </div>
                }
                <div class="opcoes-rodape">
                  <button type="button" class="botao botao--contorno" (click)="q.opcoes.push({ rotulo: '', valor: proximoValor(q) })" [disabled]="q.opcoes.length >= 10">+ Opção</button>
                  <small>O valor entra nas médias e no percentual de satisfação: o maior valor vale 100%.</small>
                </div>
              </div>
            }
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
              @if (item.pergunta.removidaEm) {
                <strong>{{ item.pergunta.texto }}</strong>
                <span class="etiqueta etiqueta--cinza" title="Saiu da pesquisa; as respostas já dadas continuam aqui">removida</span>
              } @else {
                <strong>{{ item.pergunta.ordem }}. {{ item.pergunta.texto }}</strong>
              }
              @if (item.pergunta.tipo === 'NOTA') {
                <p>Média: <b>{{ item.media ?? '—' }}</b> ({{ item.total }} respostas)</p>
              } @else if (item.pergunta.tipo === 'OPCOES') {
                <p>Média: <b>{{ item.media ?? '—' }}</b>@if (item.percentual !== null) { · satisfação <b>{{ item.percentual }}%</b> } ({{ item.total }} respostas)</p>
                @for (d of item.distribuicao; track d.valor) {
                  <div class="barra-opcao">
                    <span class="barra-opcao__rotulo">{{ d.rotulo }} <small>({{ d.valor }})</small></span>
                    <span class="barra-opcao__trilha"><span [style.width.%]="item.total ? (d.total * 100) / item.total : 0"></span></span>
                    <span class="barra-opcao__total">{{ d.total }}</span>
                  </div>
                }
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
    .pergunta { display: grid; grid-template-columns: 26px 168px 1fr auto auto auto; gap: 8px; align-items: center; margin-bottom: 8px;
      .ordem { width: 26px; height: 26px; border-radius: 50%; background: var(--marinho); color: #fff;
        display: grid; place-items: center; font-size: 12px; font-weight: 700; }
      select, input[type=text], input:not([type]) { padding: 8px 10px; border: 1.5px solid var(--borda); border-radius: 8px; font: 13.5px var(--fonte); }
      .estreito { width: 80px; }
      .obrig { font-size: 12.5px; color: var(--texto-2); display: flex; gap: 4px; align-items: center; white-space: nowrap; } }
    .rodape-perguntas { display: flex; justify-content: space-between; margin-top: 14px; }
    .opcoes-editor { margin: -2px 0 12px 34px; padding: 10px 12px; border: 1px dashed var(--borda); border-radius: 10px; background: var(--fundo);
      .opcoes-cabeca { display: grid; grid-template-columns: 1fr 74px 104px; gap: 8px; font-size: 12px; color: var(--texto-3); margin: 0 0 6px 30px; }
      .col-valor { cursor: help; }
      .opcao-linha { display: grid; grid-template-columns: 22px 1fr 74px 32px 32px 32px; gap: 6px; align-items: center; margin-bottom: 6px;
        input { padding: 7px 9px; border: 1.5px solid var(--borda); border-radius: 8px; font: 13.5px var(--fonte); min-width: 0; }
        .valor { text-align: right; }
        .seta { padding: 4px 0; font-size: 14px; } }
      .opcao-ordem { font-size: 12px; font-weight: 700; color: var(--texto-3); text-align: center; }
      .opcoes-rodape { display: flex; gap: 12px; align-items: center; margin-top: 4px;
        small { color: var(--texto-3); font-size: 12px; } } }
    .barra-opcao { display: grid; grid-template-columns: minmax(90px, 160px) 1fr 32px; gap: 8px; align-items: center; margin: 4px 0; font-size: 13px;
      small { color: var(--texto-3); }
      &__trilha { height: 8px; border-radius: 99px; background: var(--borda); overflow: hidden;
        span { display: block; height: 100%; background: var(--azul); } }
      &__total { text-align: right; font-weight: 700; } }
    .qr-caixa { text-align: center; width: min(380px, 100%);
      img { width: 240px; height: 240px; margin: 8px auto; }
      .url { font-size: 12px; color: var(--texto-3); word-break: break-all; } }
    .resultado { border-top: 1px solid var(--borda); padding: 12px 0; font-size: 14px;
      .etiqueta { margin-left: 8px; font-size: 11px; padding: 1px 8px; }
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
      this.preencherPerguntas(detalhe);
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

  private preencherPerguntas(detalhe: Pesquisa) {
    this.perguntas = (detalhe.perguntas ?? []).map((q) => ({
      // em OPCOES a escala é o maior valor das opções (calculada na API): não volta como escala de nota
      id: q.id, tipo: q.tipo, texto: q.texto, escalaMax: q.tipo === 'NOTA' ? (q.escalaMax ?? 5) : 5, obrigatoria: q.obrigatoria,
      opcoes: (q.opcoes ?? []).map((o) => ({ rotulo: o.rotulo, valor: o.valor })),
    }));
    if (!this.perguntas.length) this.adicionarPergunta();
  }

  adicionarPergunta() {
    this.perguntas.push({ tipo: 'NOTA', texto: '', escalaMax: 5, obrigatoria: false, opcoes: [] });
  }

  /** Ao virar "Opções com texto", já vem com a sugestão para o gestor ajustar. */
  aoTrocarTipo(q: PerguntaForm) {
    if (q.tipo === 'OPCOES' && !q.opcoes.length) q.opcoes = OPCOES_SUGERIDAS.map((o) => ({ ...o }));
    if (q.tipo === 'NOTA' && q.escalaMax !== 5 && q.escalaMax !== 10) q.escalaMax = 5;
  }

  moverOpcao(q: PerguntaForm, de: number, passo: number) {
    const para = de + passo;
    if (para < 0 || para >= q.opcoes.length) return;
    [q.opcoes[de], q.opcoes[para]] = [q.opcoes[para], q.opcoes[de]];
  }

  /** Valor sugerido para a opção nova: um acima do maior (até 100). */
  proximoValor(q: PerguntaForm): number {
    return Math.min(100, Math.max(0, ...q.opcoes.map((o) => Number(o.valor) || 0)) + 1);
  }

  removerPergunta(i: number) {
    this.perguntas.splice(i, 1);
  }

  async salvarPerguntas(p: Pesquisa) {
    if (this.perguntas.some((q) => !q.texto.trim())) {
      return this.toasts.erro('Há pergunta sem texto.');
    }
    const semTexto = this.perguntas.find((q) => q.tipo === 'OPCOES' && q.opcoes.some((o) => !o.rotulo.trim()));
    if (semTexto) return this.toasts.erro(`Há botão sem texto na pergunta "${semTexto.texto.trim()}".`);
    // campo de valor apagado vira null — e null viraria 0 (0% na satisfação) sem aviso
    const valorInvalido = (v: unknown) => v === null || v === '' || !Number.isInteger(Number(v)) || Number(v) < 0 || Number(v) > 100;
    for (const q of this.perguntas.filter((x) => x.tipo === 'OPCOES')) {
      const ruim = q.opcoes.find((o) => valorInvalido(o.valor));
      if (ruim) return this.toasts.erro(`Informe um valor inteiro de 0 a 100 no botão "${ruim.rotulo.trim()}" da pergunta "${q.texto.trim()}".`);
    }
    this.salvando.set(true);
    try {
      const perguntas = this.perguntas.map((q) => ({
        id: q.id, tipo: q.tipo, texto: q.texto, escalaMax: q.tipo === 'NOTA' ? q.escalaMax : undefined, obrigatoria: q.obrigatoria,
        opcoes: q.tipo === 'OPCOES' ? q.opcoes.map((o) => ({ rotulo: o.rotulo.trim(), valor: Number(o.valor) })) : undefined,
      }));
      const detalhe = await this.api.put<Pesquisa>(`/pesquisas/${p.id}/perguntas`, { perguntas });
      // As perguntas novas ganham id agora; sem isso o próximo salvar as recriaria.
      this.preencherPerguntas(detalhe);
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
