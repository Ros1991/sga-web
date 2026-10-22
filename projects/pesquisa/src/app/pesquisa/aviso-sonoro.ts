import { signal } from '@angular/core';

export type EstadoAviso = 'desligado' | 'ativo' | 'indisponivel';

/**
 * Aviso no celular do cidadão quando a senha é chamada: sinal sonoro, voz
 * ("Senha R C 0 0 1. Dirija-se ao guichê número 3.") e vibração.
 *
 * Navegadores de celular só tocam som depois que a pessoa toca na página
 * (política de autoplay) — por isso o aviso começa desligado e o cidadão o
 * ativa com um toque. Com a tela bloqueada ou a página fechada o navegador
 * suspende a página e não há aviso: o cidadão precisa deixá-la aberta.
 */
export class AvisoSonoro {
  readonly estado = signal<EstadoAviso>(AvisoSonoro.suportado() ? 'desligado' : 'indisponivel');
  /**
   * Tela mantida acesa (Screen Wake Lock)? Com o bloqueio automático o
   * navegador suspende a página e o aviso não sai. O Wake Lock só existe em
   * HTTPS: em http://IP (desenvolvimento) a tela pede para o cidadão não deixar apagar.
   */
  readonly telaAcesa = signal(false);
  private audio: AudioContext | null = null;
  private trava: WakeLockSentinel | null = null;

  private static suportado(): boolean {
    return typeof window !== 'undefined' && ('speechSynthesis' in window || 'AudioContext' in window || 'webkitAudioContext' in window);
  }

  /** Chamar dentro do toque do cidadão: libera som, voz e vibração para depois. */
  ativar(): void {
    try {
      const Contexto = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Contexto) {
        this.audio ??= new Contexto();
        void this.audio.resume();
      }
      // iPhone (Safari 17+): toca mesmo com a chave de silencioso — o cidadão pediu o aviso
      const sessao = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
      if (sessao) sessao.type = 'playback';
      if ('speechSynthesis' in window) {
        // fala vazia dentro do toque: no iPhone, sem isso a voz posterior não sai
        const vazia = new SpeechSynthesisUtterance(' ');
        vazia.volume = 0;
        speechSynthesis.speak(vazia);
      }
      navigator.vibrate?.(60);
      this.estado.set('ativo');
      this.sinal(true); // bip curto: confirma que o som está funcionando
      void this.manterTelaAcesa();
    } catch {
      this.estado.set('indisponivel');
    }
  }

  /** Pede a tela acesa; chamar de novo quando a página volta a ficar visível (a trava cai ao ocultar). */
  async manterTelaAcesa(): Promise<void> {
    if (this.estado() !== 'ativo' || this.trava || !('wakeLock' in navigator)) return;
    try {
      this.trava = await navigator.wakeLock.request('screen');
      this.telaAcesa.set(true);
      this.trava.addEventListener('release', () => {
        this.trava = null;
        this.telaAcesa.set(false);
      });
    } catch {
      this.telaAcesa.set(false); // sem HTTPS, bateria fraca ou o navegador recusou
    }
  }

  /** Libera a tela quando não há mais o que esperar (pesquisa aberta, senha encerrada). */
  liberarTela(): void {
    void this.trava?.release().catch(() => undefined);
    this.trava = null;
    this.telaAcesa.set(false);
  }

  /** Senha chamada: vibra sempre que possível; som e voz só se o aviso foi ativado. */
  anunciar(codigo: string, guiche: string | null): void {
    try {
      navigator.vibrate?.([300, 150, 300, 150, 300]);
    } catch {
      // sem vibração
    }
    if (this.estado() !== 'ativo') return;
    this.sinal();
    const texto = guiche
      ? `Senha ${soletrar(codigo)}. Dirija-se ao guichê número ${guiche}.`
      : `Senha ${soletrar(codigo)}. Sua senha foi chamada.`;
    setTimeout(() => this.falar(texto), 900); // depois do sinal
  }

  private falar(texto: string): void {
    try {
      if (!('speechSynthesis' in window)) return;
      const fala = new SpeechSynthesisUtterance(texto);
      fala.lang = 'pt-BR';
      fala.rate = 0.95;
      const voz = speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith('pt'));
      if (voz) fala.voice = voz;
      speechSynthesis.cancel(); // descarta um aviso anterior ainda em curso
      speechSynthesis.speak(fala);
    } catch {
      // sem voz: ficam o sinal, a vibração e a tela
    }
  }

  /** "Ding-dong" (ou um bip curto) pelo Web Audio — funciona mesmo sem voz instalada. */
  private sinal(curto = false): void {
    const ctx = this.audio;
    if (!ctx) return;
    // ligação, Siri ou troca de app suspendem o contexto; já destravado, retoma sem novo toque
    if (ctx.state !== 'running') void ctx.resume().catch(() => undefined);
    const notas: [number, number, number][] = curto ? [[880, 0, 0.12]] : [[880, 0, 0.25], [660, 0.28, 0.45]];
    for (const [frequencia, inicio, fim] of notas) {
      const osc = ctx.createOscillator();
      const volume = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = frequencia;
      const t0 = ctx.currentTime + inicio;
      volume.gain.setValueAtTime(0.0001, t0);
      volume.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02);
      volume.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + fim);
      osc.connect(volume).connect(ctx.destination);
      osc.start(t0);
      osc.stop(ctx.currentTime + fim + 0.05);
    }
  }
}

/** "RC-001PG" → "R C, 0 0 1, P G" — a voz lê letra por letra, como o painel. */
export function soletrar(codigo: string): string {
  return codigo
    .split('-')
    .map((parte) => parte.replace(/([A-Za-z]+)|(\d+)/g, (t) => t.split('').join(' ') + ', '))
    .join(' ')
    .replace(/,\s*$/, '');
}
