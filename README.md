# Finance Control - Frontend

SPA Angular do Finance Control. A interface combina controle financeiro pessoal e dívidas compartilhadas, consumindo exclusivamente o BFF.

## Stack

- Angular `22.1.0`
- Angular CLI e build tooling `22.1.2`
- TypeScript `6.0.2`
- RxJS `7.8.2`
- Cliente SignalR `10.0.0`
- Vitest `4.1.10`
- SCSS com design tokens próprios
- Nginx `1.29.8` no container de produção
- Node.js `26.4.0` na etapa de build do container

Todas as dependências estão fixadas em versões exatas no `package.json` e no `package-lock.json`.

## Arquitetura do frontend

O dashboard oferece análise sob demanda, combinando fluxo mensal e raio-X das dívidas exclusivamente por `POST /api/v1/ai/analyze` no BFF. A seção possui estados de carregamento e limite de uso, além de layout responsivo e compatível com dark mode.

Na mesma seção, o usuário pode fazer perguntas simples por `POST /api/v1/ai/ask`, como “quem ainda me deve pela comida?” ou “de onde acumulei minhas dívidas?”. A conversa existe apenas na memória da página e é descartada ao recarregar.

- Standalone components e rotas lazy.
- Signals para estado local da interface.
- JWT mantido somente em memória; a sessão é restaurada por refresh cookie HttpOnly.
- Interceptor adiciona o Bearer token somente em chamadas `/api/*`.
- Guard protege todas as rotas autenticadas.
- Tema `light`, `dark` ou baseado no dispositivo.
- Sidebar em desktop e bottom navigation em mobile.
- Nenhuma chamada direta ao Finance Service ou Debt Service.
- Central de notificações persistente com atualização via SignalR e reconexão automática.
- Tela de Finanças com filtro mensal e por categoria, limites de orçamento e lançamentos semanais, mensais ou anuais.

## Rotas

| Caminho      | Acesso  | Tela                                               |
| ------------ | ------- | -------------------------------------------------- |
| `/login`     | Público | Autenticação demonstrativa                         |
| `/register`  | Público | Cadastro com confirmação de e-mail                 |
| `/confirm-email` | Público | Ativação da conta pelo link recebido             |
| `/forgot-password` | Público | Solicitação de recuperação                    |
| `/reset-password` | Público | Definição da nova senha                          |
| `/dashboard` | JWT     | Visão geral agregada                               |
| `/finance`   | JWT     | Receitas, despesas, filtros, orçamento e recorrências |
| `/debts`     | JWT     | CRUD, divisão por cotas e pagamentos simplificados |
| `/people`    | JWT     | Pessoas participantes                              |
| `/security`  | JWT     | Troca de senha e gestão de sessões                 |

Em `/account`, o usuário autenticado gerencia perfil, preferências, avatar, exportação e exclusão segura da conta.

Na zona de perigo, a interface apresenta as pendências retornadas pelo BFF e só habilita a exclusão depois da senha e da confirmação `EXCLUIR`.

## Desenvolvimento local

Com o ambiente Docker dos backends disponível em `http://localhost:8080`:

```powershell
npm ci
npm start
```

Acesse `http://localhost:4200`. O Angular dev server encaminha `/api` ao BFF usando `proxy.conf.json`.

Credenciais demonstrativas:

```text
email: demo@financecontrol.local
senha: ChangeMe123!
```

A segunda conta local usa `friend@financecontrol.local` com a mesma senha. Ela permite testar amizades, grupos e a confirmação de pagamentos entre usuários.

Quando uma conta altera amizades, grupos, dívidas ou pagamentos, a outra recebe a notificação sem recarregar a página. Dashboard, dívidas, badges e área social refazem somente as consultas relacionadas ao tipo de evento recebido.

## Build e testes

```powershell
npm run build
npm test
npm audit
```

## Docker

Build isolado:

```powershell
docker build --tag finance-control-frontend:local .
docker run --rm --publish 4200:8080 finance-control-frontend:local
```

No uso normal, suba o projeto pelo `finance-control-infra`. O Nginx encaminha `/api/*` internamente para o container do BFF.

## Identidade visual

A implementação segue a direção aprovada no Google Stitch:

- teal como cor principal;
- coral para despesas e valores negativos;
- amber para estados pendentes;
- fundos claros suaves e dark mode azul-marinho;
- componentes com contraste WCAG AA, estados de foco e alvos touch;
- adaptação intencional para desktop, mobile web e futuros aplicativos iOS/Android.
