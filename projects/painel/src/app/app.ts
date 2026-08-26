import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
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
  atual: EventoMidia | null;
  proximos: EventoMidia[];
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
  protected readonly midia = signal<EventoMidia | null>(null);
  protected readonly destaque = signal<SenhaResumo | null>(null);
  protected readonly hora = signal(this.horaAgora());

  protected readonly midiaUrl = computed<SafeResourceUrl | null>(() => {
    const m = this.midia();
    if (!m) return null;
    if (m.tipo === 'YOUTUBE' && m.videoId) {
      return this.sanitizer.bypassSecurityTrustResourceUrl(
        `https://www.youtube.com/embed/${m.videoId}?autoplay=1&mute=1&loop=1&playlist=${m.videoId}&rel=0`,
      );
    }
    return null;
  });

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

    this.intervalos.push(
      setInterval(() => this.hora.set(this.horaAgora()), 1000),
      setInterval(() => void this.carregarFila(), 60_000),
      setInterval(() => void this.carregarMidia(), 300_000),
    );
  }

  ngOnDestroy(): void {
    this.intervalos.forEach((i) => clearInterval(i));
    if (this.timeoutDestaque) clearTimeout(this.timeoutDestaque);
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

  private async carregarMidia(): Promise<void> {
    try {
      const resposta = await this.api.get<RespostaMidia>('/dispositivo/midia', this.sessao.headers());
      this.midia.set(resposta.atual);
    } catch {
      // mantém a mídia atual; o fallback tenta de novo
    }
  }

  private aoChamar(senha: SenhaResumo): void {
    this.destaque.set(senha);
    if (this.timeoutDestaque) clearTimeout(this.timeoutDestaque);
    this.timeoutDestaque = setTimeout(() => this.destaque.set(null), 10_000);
    this.tocarBeep();
    this.anunciar(senha);
  }

  private tocarBeep(): void {
    try {
      const ctx = new AudioContext();
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
      setTimeout(() => void ctx.close(), 1500);
    } catch {
      // sem áudio disponível — segue sem beep
    }
  }

  private anunciar(senha: SenhaResumo): void {
    try {
      if (!('speechSynthesis' in window)) return;
      const soletrado = senha.codigo
        .replace(/-/g, ' ')
        .split('')
        .join(' ')
        .replace(/\s{2,}/g, ', ');
      const fala = new SpeechSynthesisUtterance(
        `Senha ${soletrado}, guichê ${senha.guiche ?? ''}`,
      );
      fala.lang = 'pt-BR';
      fala.rate = 0.9;
      speechSynthesis.cancel();
      speechSynthesis.speak(fala);
    } catch {
      // sem síntese de voz — segue sem anúncio
    }
  }
}
