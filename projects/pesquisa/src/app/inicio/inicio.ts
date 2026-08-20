import { Component } from '@angular/core';

@Component({
  selector: 'app-inicio',
  template: `
    <main class="inicio">
      <div class="inicio__cartao cartao">
        <div class="inicio__icone" aria-hidden="true">
          <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <path d="M14 14h3v3h-3zM20 14h1M14 20h1M18 18h3v3h-3z" />
          </svg>
        </div>
        <h1>Avalie o atendimento</h1>
        <p>Aponte a câmera para o QR Code no guichê para avaliar o atendimento.</p>
      </div>
      <footer class="inicio__rodape">DETRAN-DF · Pesquisa de Satisfação</footer>
    </main>
  `,
  styles: `
    .inicio {
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 24px;
      padding: 24px 16px;
    }

    .inicio__cartao {
      max-width: 480px;
      width: 100%;
      text-align: center;
      padding: 40px 28px;

      h1 {
        font-size: 22px;
        color: var(--marinho);
        margin-bottom: 10px;
      }

      p {
        margin: 0;
        color: var(--texto-2);
        font-size: 15.5px;
      }
    }

    .inicio__icone {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 112px;
      height: 112px;
      border-radius: 50%;
      background: var(--azul-suave);
      color: var(--azul);
      margin-bottom: 18px;
    }

    .inicio__rodape {
      font-size: 12.5px;
      color: var(--texto-3);
    }
  `,
})
export class InicioComponent {}
