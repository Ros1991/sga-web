import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Autenticacao, mensagemDeErro } from 'compartilhado';
import { rotaInicial } from '../guards';

@Component({
  selector: 'pagina-login',
  imports: [FormsModule],
  template: `
    <div class="fundo">
      <form class="cartao caixa" (ngSubmit)="entrar()">
        <div class="marca">
          <span class="detran"><strong>DETRAN</strong>&nbsp;- DF</span>
          <h1>Sistema de Gestão de Atendimento</h1>
        </div>

        <div class="campo">
          <label for="login">Usuário</label>
          <input id="login" name="login" [(ngModel)]="login" autocomplete="username" required autofocus />
        </div>
        <div class="campo">
          <label for="senha">Senha</label>
          <input id="senha" name="senha" type="password" [(ngModel)]="senha" autocomplete="current-password" required />
        </div>

        @if (erro()) {
          <p class="alerta">{{ erro() }}</p>
        }

        <button class="botao inteiro" [disabled]="carregando()">
          {{ carregando() ? 'Entrando…' : 'Entrar' }}
        </button>
      </form>
    </div>
  `,
  styles: [`
    .fundo { min-height: 100vh; display: grid; place-items: center;
      background: var(--fundo) url('/main_back.png') no-repeat top center / cover; }
    .caixa { width: min(410px, 92vw); padding: 36px; border-radius: 10px; }
    .marca { text-align: center; margin-bottom: 26px;
      .detran { font-family: var(--fonte-marca); font-size: 34px; color: var(--azul);
        strong { font-weight: 700; } }
      h1 { font-size: 15px; font-weight: 400; color: var(--texto-2); margin-top: 6px; }
    }
    .inteiro { width: 100%; margin-top: 6px; padding: 13px; }
    .alerta { background: var(--vermelho-suave); color: var(--vermelho); border-radius: 8px;
      padding: 10px 12px; font-size: 13.5px; margin: 0 0 12px; }
  `],
})
export class LoginPagina {
  private readonly auth = inject(Autenticacao);
  private readonly router = inject(Router);

  login = '';
  senha = '';
  readonly erro = signal<string | null>(null);
  readonly carregando = signal(false);

  async entrar() {
    if (!this.login || !this.senha) {
      this.erro.set('Informe usuário e senha.');
      return;
    }
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const usuario = await this.auth.entrar(this.login, this.senha);
      await this.router.navigateByUrl(rotaInicial(usuario.perfil));
    } catch (e) {
      this.erro.set(mensagemDeErro(e));
    } finally {
      this.carregando.set(false);
    }
  }
}
