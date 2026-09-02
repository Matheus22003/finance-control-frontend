# Finance Control - Frontend

SPA Angular do Finance Control. A interface combina controle financeiro pessoal e dívidas compartilhadas, consumindo exclusivamente o BFF.

## Stack

- Angular `22.1.0`
- Angular CLI e build tooling `22.1.2`
- TypeScript `6.0.2`
- RxJS `7.8.2`
- Cliente SignalR `10.0.0`
- Vitest `4.1.10`
- Playwright Test `1.62.1`
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
- Web desktop-first; o layout responsivo atual é apenas um fallback seguro para
  navegador móvel, sem meta de paridade com o futuro aplicativo nativo.
- Nenhuma chamada direta ao Finance Service ou Debt Service.
- Central de notificações persistente com atualização via SignalR, reconexão automática, sincronização deduplicada, preferências por evento/canal e Web Push instalável.
- Tela de Finanças com filtro mensal, categorias padrão e personalizadas, limites de orçamento, lançamentos semanais, mensais ou anuais, metas financeiras com aportes manuais ou vinculados ao saldo disponível de receitas, detalhamento de como cada receita foi distribuída e projeção de caixa para seis meses.

## Rotas

| Caminho            | Acesso  | Tela                                                         |
| ------------------ | ------- | ------------------------------------------------------------ |
| `/login`           | Público | Autenticação demonstrativa                                   |
| `/register`        | Público | Cadastro com confirmação de e-mail                           |
| `/confirm-email`   | Público | Ativação da conta pelo link recebido                         |
| `/forgot-password` | Público | Solicitação de recuperação                                   |
| `/reset-password`  | Público | Definição da nova senha                                      |
| `/dashboard`       | JWT     | Visão geral, metas, tendência, orçamento e projeção agregada |
| `/finance`         | JWT     | Receitas, despesas, orçamento, recorrências, metas e aportes |
| `/debts`           | JWT     | CRUD, divisão por cotas e pagamentos simplificados           |
| `/people`          | JWT     | Pessoas participantes                                        |
| `/security`        | JWT     | Troca de senha e gestão de sessões                           |

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

Quando uma conta altera amizades, grupos, dívidas ou pagamentos, a outra recebe a notificação sem recarregar a página. Alertas de orçamento e metas próximas do prazo, atrasadas ou concluídas também aparecem na central. Dashboard, finanças, dívidas, badges e área social refazem somente as consultas relacionadas ao tipo de evento recebido.

Ao iniciar ou reconectar, o cliente chama `POST /api/v1/notifications/sync` e depois consulta novamente a caixa persistente. Esse fluxo funciona como fallback quando o transporte em tempo real estiver indisponível e pode ser reutilizado pelos futuros aplicativos iOS e Android.

Em **Minha conta**, cada evento pode ser habilitado separadamente na caixa do
aplicativo, no Push e no e-mail. A mesma tela registra o navegador atual e
revoga outros dispositivos. A integração usa `@angular/service-worker`
`22.1.0`; cliques em Push abrem diretamente a rota relacionada ao evento.

O service worker é gerado somente no build de produção. Portanto, teste Push no
container local (`http://localhost`, que é um contexto seguro para service
workers) ou no endereço HTTPS da Vercel; `npm start` mantém o modo de
desenvolvimento sem service worker.

## Build e testes

```powershell
npm run build
npm test
npm run test:e2e
npm run test:e2e:isolated
npm audit
```

Os testes E2E usam Chromium e exercitam a aplicação completa em
`http://localhost:4200`, incluindo o BFF e os bancos reais do ambiente Docker.
Antes de executá-los, suba o `docker compose` do repositório
`finance-control-infra`. Para apontar para outro ambiente, defina
`E2E_BASE_URL`.

O fluxo multiusuário usa `npm run test:e2e:isolated`. Esse comando inicia uma
segunda instância do Docker Compose nas portas `4280`, `8180` e `8125`, com
PostgreSQLs e Mailpit próprios. Ao terminar, mesmo em caso de falha, os
containers, redes e volumes temporários são removidos. Assim, amizades, dívidas
e pagamentos criados pelo teste nunca alteram os dados do ambiente de
desenvolvimento.

O comando isolado funciona no Windows e no Linux. Em caso de falha, o log do
Docker Compose é preservado em `test-results/docker-compose.log`, junto dos
traces, vídeos e screenshots gerados pelo Playwright.

## Integração contínua

O workflow `.github/workflows/ci.yml` é executado em pushes e pull requests para
`main` e `develop`. Ele:

1. instala as dependências com Node.js `26.4.0` e executa testes, build e
   auditoria do frontend;
2. testa BFF e Debt Service com .NET SDK `10.0.301`;
3. baixa as branches `develop` do Finance Service e da infraestrutura;
4. executa os onze cenários E2E no stack Docker descartável, incluindo fluxos
   negativos, limites financeiros, recorrências, dashboard com IA mock e
   edição de participantes de dívidas. O build do Finance Service executa os
   testes Maven com Maven `3.9.12` e Java `21`;
5. publica os diagnósticos por sete dias quando ocorre uma falha.

Todas as actions estão fixadas por SHA e o workflow possui apenas permissão de
leitura. Como os repositórios integrados são públicos e a IA usa o provider
`Mock` nos testes, nenhum secret adicional é necessário. Na execução manual,
`workflow_dispatch` permite escolher a referência de cada serviço.

## Docker

Build isolado:

```powershell
docker build --tag finance-control-frontend:local .
docker run --rm --publish 4200:8080 finance-control-frontend:local
```

No uso normal, suba o projeto pelo `finance-control-infra`. O Nginx encaminha `/api/*` internamente para o container do BFF.

## Vercel

O `vercel.json` publica a SPA como conteúdo estático e mantém as APIs REST e o
BFF na mesma origem pública. O rewrite encaminha somente `/api/*` ao BFF
exposto pelo zrok no ZimaOS. Todas as outras rotas usam fallback para
`index.html`.

Esse desenho preserva o refresh cookie `HttpOnly`, evita CORS entre o Angular e
o BFF e mantém a regra de que o frontend nunca acessa os microserviços
diretamente. As respostas da API não são armazenadas no CDN.

O upgrade WebSocket não atravessa o rewrite externo da Vercel. Por isso,
somente quando o hostname termina em `.vercel.app`, o cliente SignalR usa Long
Polling. O hub continua em `/api/v1/notifications/hub`, então a negociação e as
requisições de polling passam pelo rewrite da mesma origem e recebem o header
`skip_zrok_interstitial` antes de chegar ao zrok, junto do JWT. Em localhost e
no container Nginx, o hub também é relativo e preserva os transports padrão.

Configuração do projeto:

| Campo                  | Valor                                   |
| ---------------------- | --------------------------------------- |
| Framework preset       | `Angular`                               |
| Build command          | `npm run build`                         |
| Build output directory | `dist/finance-control-frontend/browser` |
| Node.js                | `26.4.0`                                |

O frontend não exige secrets na Vercel. A chave VAPID pública é obtida por um
endpoint protegido do BFF; a chave privada nunca entra no bundle Angular. O endereço público do BFF está no
destino do rewrite e pode ser trocado no `vercel.json` sem alterar o código
Angular. O zrok é o único cliente público da rede `edge-network`; BFF, Finance
Service e Debt Service permanecem sem portas publicadas no host.

## Apoio ao projeto

O atalho **Apoie o projeto** fica fora dos módulos financeiros, na sidebar
desktop. Ele é um link externo opcional para o perfil público do Buy Me a
Coffee: não chama o BFF, não registra pagamentos e não recebe dados do usuário.

Enquanto o perfil público não for configurado em
`src/app/core/config/project-support.config.ts`, o atalho permanece desativado.
Configure apenas uma URL `https://` do perfil oficial; ela é pública e não deve
ser tratada como secret.

## Identidade visual

A implementação segue a direção aprovada no Google Stitch:

- teal como cor principal;
- coral para despesas e valores negativos;
- amber para estados pendentes;
- fundos claros suaves e dark mode azul-marinho;
- componentes com contraste WCAG AA, estados de foco e alvos touch;
- experiência web desktop-first e fallback seguro no navegador móvel; os
  futuros aplicativos iOS/Android serão produtos dedicados.
