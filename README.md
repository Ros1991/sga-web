# SGA Web

Frontends do Sistema de Gestão de Atendimento do DETRAN-DF — workspace Angular 21
com quatro aplicações e uma biblioteca compartilhada.

| App | Porta | O que é |
|---|---|---|
| **portal** | 4300 | Gestão e operação: dashboard, unidades (abas: dados, guichês, dispositivos, equipe, pesquisa), catálogo de serviços, prioridades, usuários, agenda visual, atendimento (chamar/finalizar) e emissão assistida |
| **totem** | 4301 | Autoatendimento touch: serviço → subserviço → prioridade → senha |
| **painel** | 4302 | TV da sala de espera: fila, chamada com voz (TTS) e mídia agendada |
| **pesquisa** | 4303 | Avaliação de satisfação no celular do cidadão (QR do guichê) |
| `compartilhado` | — | Modelos, cliente HTTP, autenticação JWT, sessão de dispositivo, socket.io, toasts e tokens SCSS |

## Rodando

Requer a [SGA API](../sga-api) em `http://localhost:3000`.

```bash
npm install
npx ng serve portal     # 4300 — login: admin / 12345678 (seed)
npx ng serve totem      # 4301 — abrir com ?token= (URL de ativação gerada no portal)
npx ng serve painel     # 4302 — idem
npx ng serve pesquisa   # 4303 — links públicos /p/<codigo>
```

Build de produção: `npx ng build <app>`. A URL da API é o token de injeção
`API_URL` da lib `compartilhado` (padrão `http://localhost:3000/api/v1`) —
sobrescreva no `app.config.ts` de cada app para outros ambientes.

## Decisões

- **Navegação fixa por perfil** (ADMIN, GERENTE, ATENDENTE, TRIAGEM) — sem menus dinâmicos.
- **Unidade é o centro da configuração**: uma tela com abas substitui os cadastros espalhados.
- Standalone components + signals (zoneless); formulários com validação e mensagem em cada campo.
- Dispositivos ativam por URL/QR (`?token=`) — ninguém digita token em totem ou TV.
- Sem bibliotecas de UI: SCSS próprio com tokens do DETRAN em `compartilhado/src/estilos/tokens.scss`.
