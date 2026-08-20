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
          <span class="sigla">SGA</span>
          <h1>Sistema de Gestão<br />de Atendimento</h1>
          <p>DETRAN-DF</p>
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
      background: linear-gradient(150deg, var(--marinho) 0%, var(--marinho-2) 55%, var(--azul-escuro) 100%); }
    .caixa { width: min(400px, 92vw); padding: 36px; }
    .marca { text-align: center; margin-bottom: 26px;
      .sigla { display: inline-grid; place-items: center; width: 64px; height: 64px; border-radius: 16px;
        background: var(--azul); color: #fff; font: 800 22px var(--fonte); margin-bottom: 12px; }
      h1 { font-size: 19px; color: var(--marinho); }
      p { margin: 4px 0 0; color: var(--texto-3); font-size: 13px; letter-spacing: .12em; }
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
