<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# SISFERIAS

Sistema web para planejamento, lançamento, acompanhamento, impressão e administração de férias do efetivo. Esta documentação é o guia de entrega para técnicos de TI.

## Visão geral

O SISFERIAS é uma SPA (Single Page Application) em React 19, TypeScript e Vite 6. O frontend é publicado como arquivo estático e acessa diretamente o Supabase, que fornece autenticação, banco PostgreSQL e funções RPC. Não existe backend Node próprio neste repositório.

Tecnologias principais:

- React, React DOM e `react-router-dom`.
- TypeScript e Vite.
- Supabase Auth e Supabase Database.
- `date-fns` para datas, `recharts` para gráficos e `lucide-react` para ícones.
- Vercel como hospedagem prevista.

O ponto de entrada é `index.tsx`. `App.tsx` monta `ErrorBoundary`, `MemoryRouter`, `AuthProvider` e `VacationProvider`. O primeiro provider controla sessão e perfis; o segundo carrega e persiste férias, configurações, avisos, auditoria e sugestões.

## Estrutura do projeto

```text
App.tsx                    Rotas, guards e composição dos providers
index.tsx                  Montagem do React no elemento #root
types.ts                   Tipos, categorias, postos e setores
vite.config.ts             Vite, porta e variáveis de build
components/                Header, lista, gráficos e exportações
contexts/AuthContext.tsx   Sessão, perfis, usuários e administração
contexts/VacationContext.tsx Férias, avisos, auditoria e sugestões
pages/                     Telas funcionais
lib/supabase.ts            Cliente Supabase
lib/textUtils.ts           Normalização de texto
supabase/migrations/       Evolução do banco e funções SQL
```

## Rotas e permissões

`PrivateRoute` exige usuário autenticado. `AdminRoute` exige autenticação e `user.role === 'admin'`. Usuários comuns que tentam uma rota administrativa são enviados para `/home`.

| Rota | Tela | Acesso | Função |
|---|---|---|---|
| `/login` | Login | Público | Login por e-mail ou NIP |
| `/register` | Register | Público | Cadastro de conta e perfil |
| `/home` | Home | Autenticado | Área pessoal e avisos |
| `/` | Dashboard | Admin | Indicadores e gestão de férias |
| `/justifications` | Justifications | Admin | Justificativas |
| `/tramite` | Tramite | Admin | Trâmite administrativo |
| `/vacation-form` | VacationForm | Autenticado | Novo lançamento |
| `/vacation-form/:id` | VacationForm | Autenticado | Editar lançamento |
| `/vacation-form/user/:userId` | VacationForm | Autenticado | Formulário de usuário |
| `/calendar` | CalendarView | Admin | Calendário do planejamento |
| `/print` e `/print/:id` | PrintVacation | Autenticado | Documento para impressão |
| `/suggestions` | Suggestions | Autenticado | Envio e consulta de sugestões |
| `/security` | Security | Autenticado | Usuários, permissões e auditoria |
| `*` | Redirecionamento | Todos | Vai para `/home` |

O guard do frontend não substitui RLS. As policies do Supabase devem aplicar as mesmas regras mesmo que alguém faça chamadas diretamente à API.

## Regras de visibilidade

Perfis possuem papel `admin` ou `user`. Para registros em `employees`, o administrador:

- vê todos os setores quando `view_all_sectors` é `true`;
- vê somente seu setor quando `view_all_sectors` é `false` e possui setor;
- não recebe registros quando está sem setor e sem visão global.

O setor do perfil prioriza o setor do lançamento de férias mais recente por `planning_year`; na ausência de lançamento, usa `profiles.sector`.

## Modelo de dados

### `auth.users` e `profiles`

O Auth guarda credenciais e sessão. `profiles` guarda `id`, `name`, `email`, `war_name`, `nip`, `category`, `sector`, `rank`, `role`, `is_blocked` e `view_all_sectors`. O frontend não mantém senha; o campo existente no tipo `User` fica vazio por compatibilidade.

### `employees`

Cada linha representa o planejamento de férias de um usuário em um ano de direito: `id`, `user_id`, dados funcionais, `planning_year`, `total_vacation_days`, `vacation_parcels`, `photo_url` e `justification`. `vacation_parcels` é JSON serializado; cada parcela contém `id`, `startDate`, `endDate`, `days` e NUP opcional.

A migration `20260616_fix_employees_uniqueness_for_vacation_windows.sql` remove a unicidade global por NIP e cria unicidade em `(user_id, planning_year)`. Novos registros usam `upsert` por esse par, permitindo vários anos para a mesma pessoa, mas somente um registro por ano. Registro legado sem `planning_year` é exibido como ano atual menos um.

### `system_settings` e `notices`

`system_settings` normalmente usa `id = 1` e guarda nome da instituição, efetivo total, logo e `staff_json` com diretor, vice-diretor e encarregado de pessoal. `notices` guarda `title`, `content`, `created_at` e `is_pinned`.

### `audit_logs`

Guarda `timestamp`, `user_name`, ação (`Criação`, `Alteração`, `Exclusão`, `Senha`, `Bloqueio` ou `Impressão`), campo e valores anterior/novo. A tela de segurança lista em ordem decrescente e exporta CSV.

### `suggestions`

Possui `id`, `user_id`, nomes do remetente no momento do envio, `title`, `description` e `created_at`. Há índice por data. É criada pela migration `20260625_create_suggestions_table.sql`.

### `print_preferences`

Possui uma linha por `user_id` e guarda telefone, endereço, responsáveis, observações, navio, especialização, horários e indicação de desmuniciamento. `updated_at` é mantido por trigger. É criada pela migration `20260806_create_print_preferences_table.sql`.

## Fluxos lógicos

### Login e cadastro

Se a entrada do login contém `@`, ela é tratada como e-mail. Caso contrário, o sistema chama `get_email_by_nip(p_nip)` e usa o e-mail retornado em `signInWithPassword`. Depois, busca o perfil e o setor do lançamento mais recente. No cadastro, `auth.signUp` é executado primeiro e uma linha é criada em `profiles`; há fallback para payload mínimo quando colunas funcionais ainda não foram aplicadas.

### Férias

`VacationContext.saveVacation` converte camelCase para `snake_case`, serializa parcelas e atualiza por ID ou faz `upsert` por usuário/ano. Após salvar, recarrega os dados. O NUP de uma parcela é salvo editando o JSON inteiro de parcelas; a exclusão ocorre por ID.

### Avisos, configurações e sugestões

Configurações são salvas por upsert no registro 1. Avisos podem ser inseridos, excluídos e fixados. Sugestões são inseridas no banco e adicionadas ao estado local; exclusões atualizam banco e estado.

### Impressão e exportação

`PrintVacation` monta o documento no navegador e chama `window.print()`. Preferências são lidas do Supabase com fallback em `localStorage`. `ExportButtons` gera CSV e imprime; `Security` exporta auditoria em CSV. Não há geração de PDF no servidor: para PDF usa-se a opção do diálogo de impressão do navegador.

## Configuração do ambiente

Crie `.env.local` em desenvolvimento ou cadastre no provedor:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICA
```

As duas variáveis são obrigatórias; `lib/supabase.ts` lança erro se estiverem ausentes. A anon key é pública, mas a `service_role key` nunca pode aparecer no frontend.

## Supabase e migrations

Migrations incrementais existentes, em ordem cronológica:

- `20260608_add_view_all_sectors_to_profiles.sql`: adiciona visão global por setor.
- `20260609_add_missing_profile_columns.sql`: adiciona dados funcionais do perfil.
- `20260609_add_staff_json_to_settings.sql`: adiciona autoridades em JSONB.
- `20260609_resolve_email_by_nip.sql`: cria RPC segura de NIP para e-mail.
- `20260616_fix_employees_uniqueness_for_vacation_windows.sql`: define unicidade por usuário e ano.
- `20260625_create_suggestions_table.sql`: cria sugestões e índice por data.
- `20260806_create_print_preferences_table.sql`: cria preferências de impressão e trigger.
- `20260821_fix_admin_reset_password.sql`: restringe reset de senha ao admin e ao usuário alvo.

O repositório não contém o esquema inicial completo nem todas as policies/RPCs consumidas. Antes da entrega, confirme no projeto Supabase as tabelas `profiles`, `employees`, `system_settings`, `notices`, `audit_logs`, `suggestions` e `print_preferences`, suas colunas, RLS, policies, índices, extensões e as RPCs `get_email_by_nip`, `admin_reset_password`, `admin_delete_user` e `admin_update_block_status`.

As funções sensíveis devem validar `auth.uid()` no banco. Em especial, `admin_reset_password` verifica papel admin e altera somente o usuário alvo; não deve ser substituída por `auth.updateUser` para redefinir senha de outra pessoa.

## Instalação e execução

Requisitos: Node.js LTS, npm e acesso ao Supabase.

```bash
npm install
npm run dev
```

O Vite usa `0.0.0.0:3000`. Validação de produção:

```bash
npm run build
npm run preview
```

Scripts disponíveis: `dev`, `build` e `preview`. Não há testes automatizados nem lint configurado no `package.json`; o mínimo é executar o build e testar manualmente os fluxos com o Supabase correto.

## Deploy na Vercel

Use preset **Vite**, comando `npm run build` e diretório `dist`. Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` em cada ambiente e faça novo deploy após alterá-las. `vercel.json` redireciona caminhos para `index.html`.

O arquivo `VERCEL_DEPLOY.md` menciona `GEMINI_API_KEY`, mas não há dependência Gemini nem uso funcional identificado no código atual. Essa variável não é necessária para o SISFERIAS presente; a injeção legada ainda existente em `vite.config.ts` pode ser removida após confirmação de que nenhuma integração externa depende dela.

O roteador atual é `MemoryRouter`, portanto as rotas são mantidas em memória. Não trocar para `BrowserRouter` sem revisar links, refresh e fallback da hospedagem.

## Persistência local

Além do Supabase, o navegador guarda rascunhos e preferências auxiliares: prazo de férias, dados temporários de cadastro/formulário, preferências de impressão e chaves legadas de segurança. Limpar `localStorage` remove esses dados locais, mas não remove registros já persistidos no Supabase.

## Diagnóstico

- **Aplicação não inicia:** conferir as variáveis `VITE_*`, instalar dependências e executar `npm run build`.
- **Login por NIP falha:** conferir `profiles.nip`, existência da RPC, `GRANT EXECUTE`, Auth e perfil correspondente.
- **Sem dados após login:** conferir perfil, papel, setor, `view_all_sectors`, RLS e respostas 401/403 na aba Network.
- **Salvamento falha:** conferir colunas de `employees`, constraint `(user_id, planning_year)` e formato JSON de `vacation_parcels`.
- **Impressão falha:** permitir pop-ups e verificar impressora/diálogo do navegador.
- **Preferências sumiram:** conferir `print_preferences` e o `localStorage` do navegador.

## Checklist de entrega

- [ ] Aplicar migrations em ordem.
- [ ] Confirmar esquema inicial, RLS, policies e RPCs.
- [ ] Criar o primeiro admin de forma controlada.
- [ ] Configurar variáveis na Vercel.
- [ ] Executar `npm run build` sem erros.
- [ ] Testar cadastro, login por e-mail/NIP e logout.
- [ ] Testar criar, editar, excluir e manter férias de anos diferentes.
- [ ] Testar restrição por setor e visão global.
- [ ] Testar avisos, auditoria, sugestões, calendário, CSV e impressão.
- [ ] Definir backup e retenção das tabelas.
- [ ] Revisar a exposição de detalhes pelo `ErrorBoundary` e dados legados no `localStorage` antes de produção pública.

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1-1zZXR1WT-SfKsfxjk7ix9039AuS_YWr

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
