import { Component, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import {
  Api,
  API_URL,
  Realtime,
  SessaoDispositivo,
  ConfigDispositivo,
  EventoMidia,
  FilaSnapshot,
  SenhaResumo,
} from 'compartilhado';

interface RespostaMidia {
  /** Conteúdos no ar agora (até 2; com 2 a área de mídia divide ao meio). */
  atuais?: EventoMidia[];
  /** API antiga: um conteúdo só. */
  atual: EventoMidia | null;
  proximos: EventoMidia[];
}

/** Conteúdo pronto para exibir: URL do YouTube já sanitizada. */
interface MidiaExibida {
  evento: EventoMidia;
  youtube: SafeResourceUrl | null;
}

@Component({
  selector: 'app-root',
  imports: [],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit, OnDestroy {
  private readonly api = inject(Api);
  private readonly sessao = inject(SessaoDispositivo);
  private readonly realtime = inject(Realtime);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly config = signal<ConfigDispositivo | null>(null);
  protected readonly erro = signal<string | null>(null);
  protected readonly fila = signal<FilaSnapshot | null>(null);
  /** Conteúdos no ar (0, 1 ou 2). */
  protected readonly midias = signal<EventoMidia[]>([]);
  protected readonly destaque = signal<SenhaResumo | null>(null);
  protected readonly hora = signal(this.horaAgora());
  /** Navegador ainda não liberou o áudio (falta interação na página). */
  protected readonly somBloqueado = signal(false);

  /**
   * Cada conteúdo com sua URL de YouTube já sanitizada. Computado só quando a
   * lista muda — recriar a SafeResourceUrl a cada detecção recarregaria o iframe.
   */
  protected readonly midiasExibidas = computed<MidiaExibida[]>(() =>
    this.midias().map((evento) => ({
      evento,
      youtube:
        evento.tipo === 'YOUTUBE' && evento.videoId
          ? this.sanitizer.bypassSecurityTrustResourceUrl(
              `https://www.youtube.com/embed/${evento.videoId}?autoplay=1&mute=1&loop=1&playlist=${evento.videoId}&rel=0`,
            )
          : null,
    })),
  );

  /** Faixa de recentes: a mais nova primeiro (destacada), até 5 na tela. */
  protected readonly ultimas = computed<SenhaResumo[]>(
    () => (this.fila()?.ultimasChamadas ?? []).slice(0, 5),
  );

  protected readonly dataHoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long',
  });

  private readonly apiUrl = inject(API_URL);
  /** Uploads da Agenda Visual chegam como /uploads/... — resolve para o host da API. */
  protected urlMidia(url: string | null): string {
    if (!url) return '';
    return url.startsWith('/') ? new URL(this.apiUrl).origin + url : url;
  }

  private intervalos: ReturnType<typeof setInterval>[] = [];
  private timeoutDestaque: ReturnType<typeof setTimeout> | null = null;

  async ngOnInit(): Promise<void> {
    const config = await this.sessao.iniciar();
    if (!config) {
      this.erro.set(this.sessao.erro());
      return;
    }
    if (config.tipo !== 'PAINEL') {
      this.erro.set('Este dispositivo não é um PAINEL. Verifique a URL de ativação.');
      return;
    }
    this.config.set(config);

    await Promise.all([this.carregarFila(), this.carregarMidia()]);

    this.realtime.conectar({ deviceToken: this.sessao.token ?? undefined });
    this.realtime.em<FilaSnapshot>('fila', (snapshot) => this.fila.set(snapshot));
    this.realtime.em<SenhaResumo>('chamada', (senha) => this.aoChamar(senha));
    this.realtime.em<unknown>('midia', () => void this.carregarMidia());

    this.verificarAudio();

    this.intervalos.push(
      setInterval(() => this.hora.set(this.horaAgora()), 1000),
      setInterval(() => void this.carregarFila(), 60_000),
      setInterval(() => void this.carregarMidia(), 300_000),
    );
  }

  @HostListener('document:pointerdown')
  @HostListener('document:keydown')
  aoInteragir(): void {
    if (this.somBloqueado()) this.liberarSom();
  }

  ngOnDestroy(): void {
    this.intervalos.forEach((i) => clearInterval(i));
    if (this.timeoutDestaque) clearTimeout(this.timeoutDestaque);
    if (this.timeoutMidia) clearTimeout(this.timeoutMidia);
    this.realtime.desconectar();
  }

  private horaAgora(): string {
    const agora = new Date();
    return `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
  }

  private async carregarFila(): Promise<void> {
    try {
      this.fila.set(await this.api.get<FilaSnapshot>('/dispositivo/fila', this.sessao.headers()));
    } catch {
      // mantém o último snapshot; o fallback tenta de novo
    }
  }

  private timeoutMidia: ReturnType<typeof setTimeout> | null = null;

  private async carregarMidia(): Promise<void> {
    try {
      const resposta = await this.api.get<RespostaMidia>('/dispositivo/midia', this.sessao.headers());
      const novas = resposta.atuais ?? (resposta.atual ? [resposta.atual] : []);

      // Só troca se mudou: uma lista nova com os mesmos conteúdos recriaria
      // os iframes e o vídeo voltaria ao começo a cada consulta.
      const chave = (l: EventoMidia[]) =>
        l.map((e) => `${e.id}|${e.posicao}|${e.tipo}|${e.videoId ?? ''}|${e.url ?? ''}`).join(';');
      if (chave(novas) !== chave(this.midias())) this.midias.set(novas);

      this.agendarProximaTroca(novas, resposta.proximos ?? []);
    } catch {
      // mantém a mídia atual; o fallback tenta de novo
    }
  }

  /**
   * Recarrega no instante em que um conteúdo termina ou o próximo começa —
   * assim a tela divide/junta na hora, sem esperar a consulta periódica.
   */
  private agendarProximaTroca(atuais: EventoMidia[], proximos: EventoMidia[]): void {
    if (this.timeoutMidia) clearTimeout(this.timeoutMidia);
    const agora = Date.now();
    const marcos = [
      ...atuais.map((e) => new Date(e.fim).getTime() + 1000),
      ...proximos.map((e) => new Date(e.inicio).getTime() + 500),
    ].filter((t) => t > agora);
    if (!marcos.length) return;
    // setTimeout estoura acima de ~24,8 dias; a consulta periódica cobre o resto
    const espera = Math.min(Math.min(...marcos) - agora, 6 * 60 * 60 * 1000);
    this.timeoutMidia = setTimeout(() => void this.carregarMidia(), espera);
  }

  /** Última chamada anunciada (id + nº de chamadas), para não repetir o eco do socket. */
  private ultimoAnuncio = '';

  private aoChamar(senha: SenhaResumo): void {
    const marca = `${senha.id}#${senha.chamadas}`;
    if (marca === this.ultimoAnuncio) return; // evento repetido: já foi anunciado
    this.ultimoAnuncio = marca;

    this.destaque.set(senha);
    if (this.timeoutDestaque) clearTimeout(this.timeoutDestaque);
    this.timeoutDestaque = setTimeout(() => this.destaque.set(null), 10_000);
    this.tocarBeep();
    this.anunciar(senha);
  }

  // ---------------- Áudio ----------------
  // Navegadores só liberam som depois de uma interação com a página (política
  // de autoplay). Um painel de TV nunca recebe clique, então mostramos um
  // aviso; qualquer toque/tecla libera o áudio e o aviso some.

  private audio: AudioContext | null = null;

  private contexto(): AudioContext | null {
    try {
      this.audio ??= new AudioContext();
      if (this.audio.state === 'suspended') void this.audio.resume();
      return this.audio;
    } catch {
      return null;
    }
  }

  /** Libera o som no primeiro toque/tecla e some com o aviso. */
  protected liberarSom = (): void => {
    const ctx = this.contexto();
    void ctx?.resume();
    try {
      // "aquece" a síntese: uma fala vazia dentro do gesto do usuário
      const vazio = new SpeechSynthesisUtterance(' ');
      vazio.volume = 0;
      speechSynthesis.speak(vazio);
    } catch {
      // sem síntese: o beep ainda funciona
    }
    this.somBloqueado.set(false);
  };

  private verificarAudio(): void {
    const ctx = this.contexto();
    const ativo = ctx?.state === 'running' && (navigator.userActivation?.hasBeenActive ?? true);
    this.somBloqueado.set(!ativo);
  }

  private tocarBeep(): void {
    const ctx = this.contexto();
    if (!ctx) return;
    try {
      const tocar = (freq: number, inicio: number, duracao: number) => {
        const osc = ctx.createOscillator();
        const ganho = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        ganho.gain.setValueAtTime(0.0001, ctx.currentTime + inicio);
        ganho.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + inicio + 0.02);
        ganho.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + inicio + duracao);
        osc.connect(ganho).connect(ctx.destination);
        osc.start(ctx.currentTime + inicio);
        osc.stop(ctx.currentTime + inicio + duracao + 0.05);
      };
      tocar(880, 0, 0.25);
      tocar(1320, 0.3, 0.35);
    } catch {
      // sem áudio disponível — segue sem beep
    }
  }

  /** Soletra o código: "RC-009AG" → "R C, 0 0 9, A G". */
  private soletrar(codigo: string): string {
    return codigo
      .split('-')
      .map((parte) => parte.replace(/([A-Za-z]+)|(\d+)/g, (t) => t.split('').join(' ') + ', '))
      .join(' ')
      .replace(/,\s*$/, '');
  }

  private anunciar(senha: SenhaResumo): void {
    try {
      if (!('speechSynthesis' in window)) return;
      const fala = new SpeechSynthesisUtterance(
        `Senha ${this.soletrar(senha.codigo)}, guichê ${senha.guiche ?? ''}`,
      );
      fala.lang = 'pt-BR';
      fala.rate = 0.9;
      const voz = speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith('pt'));
      if (voz) fala.voice = voz;
      fala.onerror = (e) => {
        if (e.error !== 'interrupted' && e.error !== 'canceled') this.somBloqueado.set(true);
      };
      speechSynthesis.cancel(); // descarta anúncio anterior ainda em curso
      speechSynthesis.speak(fala);
    } catch {
      // sem síntese de voz — segue sem anúncio
    }
  }
}
