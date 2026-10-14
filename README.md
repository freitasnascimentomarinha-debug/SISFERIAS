# SISFERIAS

Sistema web para planejamento, lançamento, acompanhamento, impressão e administração de férias do efetivo, feito para rodar **em um computador da rede interna** e ser acessado pelo navegador nos demais.

- **Banco de dados PostgreSQL** (padrão da DCTIM): embutido, sem instalação separada (os binários oficiais vêm junto e o sistema o liga sozinho), ou um PostgreSQL externo do CLTI.
- **Instalação simples:** só é preciso ter o Node.js.
- **Segurança conforme as normas da DCTIM:** HTTPS obrigatório, dados pessoais cifrados (AES-256), regra de senha forte, bloqueio após 5 tentativas, troca obrigatória de senha provisória, registro de todas as operações e usuário de banco com privilégio mínimo. Detalhes em **[CONFORMIDADE.md](CONFORMIDADE.md)**.
- **Funciona sem internet:** interface, fontes e estilos vão empacotados.
- **Backup automático:** um por dia, e também antes de cada importação ou exclusão de usuário (com os dados pessoais cifrados).
- **Importação e exportação** pela própria tela (CSV ou backup JSON), inclusive com as senhas já criptografadas.

> **Vai instalar ou administrar o sistema?** Comece pelo guia passo a passo **[INSTALACAO.md](INSTALACAO.md)**: instalação, primeiro acesso, quem administra, recuperação de acesso, chave dos dados e backups, em linguagem simples.
>
> **Homologação na DCTIM?** Veja **[CONFORMIDADE.md](CONFORMIDADE.md)**: cada requisito das normas DCTIMARINST 33-06B, DCTIMBOTEC 31/002/2020, DCTIMBOTEC 30/002/2023 e DCTIMARINST 30-17, como é atendido e como verificar.

---

## 1. Instalação rápida (Windows)

1. Instale o **Node.js LTS** (versão 22.13 ou mais recente) em <https://nodejs.org>, aceitando as opções padrão.
2. Baixe o SISFERIAS de uma das duas formas:
   - **Pacote pronto (recomendado, não precisa de internet na instalação):** na página **Releases** do GitHub, baixe `sisferias-vX.Y.Z-windows.zip` (ou `-linux.zip`).
   - **Código-fonte:** botão verde **Code → Download ZIP**. Nesse caso a primeira execução precisa de internet para baixar as dependências.
3. Extraia o `.zip` em uma pasta fixa, por exemplo `C:\SISFERIAS`.
4. Dê dois cliques em **`iniciar.bat`**.
5. A janela mostra os endereços de acesso:
   ```
   SISFERIAS em execução.
     Neste computador:  https://localhost:3000
     Na rede:           https://192.168.0.15:3000
     Banco de dados:    PostgreSQL embutido (C:\SISFERIAS\data\postgres, porta 5433, somente localhost)
   ```
   Nos outros computadores da rede, abra o endereço **"Na rede"** no navegador.

A janela precisa ficar aberta enquanto o sistema estiver em uso. Ao fechá-la, o sistema para.

### Primeiro acesso

Na primeira execução é criado um administrador:

- **Login:** `admin` (ou `admin@sisferias.local`)
- **Senha provisória:** aparece na janela e fica gravada em `data/ADMIN_INICIAL.txt`

No primeiro acesso o sistema exige uma nova senha. Depois, apague o arquivo `ADMIN_INICIAL.txt` e **guarde uma cópia de `data/chave-dados.key`** fora do servidor: sem ela os dados cifrados não podem ser lidos.

### Quem acessa a área de Segurança

Não existe senha única para a área de Segurança. O controle funciona assim:

1. **Só administradores veem a área.** Usuários comuns não têm o item no menu, e o servidor recusa as ações deles.
2. **Para entrar, o administrador confirma a própria senha de login.** Cada um usa a sua senha, e cada entrada (ou tentativa errada) fica registrada na **Auditoria** com o nome de quem tentou.
3. **A área bloqueia sozinha** após 15 minutos sem uso (configurável em `ELEVATION_MINUTES`) e tem o botão **Bloquear área**, para quando o administrador se afastar do computador.
4. **Quem é administrador** é definido em **Gestão de Contas**, botão de nível de acesso. Para tirar o acesso de alguém, basta voltar a conta para **Acesso Padrão**.

### Linux

```bash
./iniciar.sh
```

### Docker (alternativa)

```bash
cp .env.exemplo .env     # e troque as duas senhas do banco
docker compose up -d
```

Sobe dois contêineres: o PostgreSQL 17 (dados em `./data/postgres-docker`, sem porta exposta na rede) e o SISFERIAS (chave, backups e certificados em `./data`). O usuário de banco `sisferias_app` (privilégio mínimo) é criado por `docker/init-banco.sh`. Para ver a senha inicial, use `docker compose logs sisferias`.
A imagem base pode ser trocada por um espelho interno: `docker build --build-arg NODE_IMAGE=meu-espelho/node:22-alpine .` e `POSTGRES_IMAGE=meu-espelho/postgres:17-alpine` no `.env`.
A instalação por Docker é testada automaticamente no GitHub a cada mudança (workflow "Testes").

---

## 2. Acesso pela rede

- **Firewall:** o computador servidor precisa aceitar conexões na porta **3000**. No Windows, na primeira execução, permita o acesso quando o Firewall perguntar. Se não perguntar, crie uma regra de entrada TCP para a porta 3000.
- **Endereço fixo:** peça à TI um **IP fixo** (ou nome DNS) para o servidor, para que o endereço não mude.
- **Outra porta:** se a 3000 estiver ocupada, defina a variável `PORT` antes de iniciar (no Windows, `set PORT=8080` e depois `iniciar.bat`).
- **Iniciar com o Windows, como serviço:** execute `instalar-servico.bat`, que pede a permissão de administrador sozinho.
  - Cria uma tarefa do Agendador de Tarefas que roda como SISTEMA na inicialização, sem janela e sem limite de tempo.
  - Usa o modo `node server/start.js servico`, que reinicia o servidor se ele cair e grava o log em `data/logs/sisferias.log`.
  - Para remover: `remover-servico.bat`.
  - No Linux: `sudo node scripts/servico.js instalar` (systemd). Os comandos disponíveis são `instalar`, `remover`, `iniciar`, `parar` e `status`; acrescente `--simular` para só ver o que seria feito.

---

### Conexão criptografada (HTTPS)

O HTTPS vem **ligado por padrão** (DCTIMBOTEC 31/002/2020, item 3.1.b), com TLS 1.2 ou superior, HSTS e cookie de sessão `Secure`.

- **Certificado provisório:** na primeira execução o sistema gera um certificado próprio em `data/certs/`, válido por 5 anos, para o nome do computador e todos os seus IPs. Se o servidor ganhar um IP novo, o certificado é refeito sozinho.
- **Certificado do CTIM** (exigido na RECIM, item 3.1.c):
  - PEM: `npm run https -- ativar --cert C:\certs\servidor.crt --key C:\certs\servidor.key`
  - PFX/P12: `npm run https -- ativar --pfx C:\certs\servidor.pfx --senha SENHA`
- **Reinício:** depois de mudar, reinicie o SISFERIAS (ou o serviço).
- **Evitar o aviso de "conexão não segura"** (só com o certificado provisório): em cada computador, abra `https://IP-DO-SERVIDOR:3000/api/certificado`, salve o arquivo, dê dois cliques nele e escolha **Instalar certificado → Máquina Local → Autoridades de Certificação Raiz Confiáveis**. A TI pode distribuir o mesmo arquivo por política de grupo.
- **Desativar** (`npm run https -- desativar`): só quando um proxy HTTPS da TI fica na frente do SISFERIAS. Para conferir a situação: `npm run https -- status`.

A configuração fica em `data/config.json`, que também vale para o modo serviço.

---

## 3. Importar dados (de outro servidor, sistema anterior ou planilha)

Em **Segurança → Dados e Backup → Importar Dados** o administrador pode carregar:

| Arquivo | Conteúdo |
|---|---|
| **Backup completo (.json)** | Gerado pelo botão "Backup completo" de outro servidor SISFERIAS, ou um backup automático (`data/backups/*.json`, com dados pessoais cifrados: só abre no servidor com a mesma chave). Inclui tudo, inclusive as senhas criptografadas |
| **Um CSV por tabela** | `profiles`, `employees`, `system_settings`, `notices`, `audit_logs`, `suggestions` e `print_preferences`, com os nomes das colunas na primeira linha (os mesmos dos CSVs que o próprio sistema exporta) |
| **CSV de usuários e senhas** (opcional) | Colunas `id`, `email` e `password_hash` (ou `encrypted_password`), com a senha em **bcrypt**. Serve para que ninguém precise trocar de senha (quem tiver senha fora da regra atual troca no próximo acesso) |

Passo a passo:

1. Selecione **todos os arquivos de uma vez** e clique em **Analisar arquivos**. Nada é gravado nessa etapa. A tela mostra:
   - qual tabela foi reconhecida em cada arquivo (dá para corrigir manualmente);
   - quantos registros serão **novos**, **atualizados** e **com erro**, com o motivo e o número da linha;
   - avisos, como perfis que ficarão sem senha ou colunas não previstas.
2. Escolha o modo: **Mesclar** (insere e atualiza, nada é apagado) ou **Substituir** (apaga as tabelas importadas e recarrega, usado para restaurar backups). A auditoria nunca é apagada: registros importados são acrescentados.
3. Clique em **Importar**. Antes de gravar, o sistema faz um backup automático. A importação roda em uma transação: se algo falhar, nada é alterado.
4. Confira o quadro **Antes / Depois** e confira alguns registros por amostragem.

Outros detalhes:

- **Importar de novo não duplica:** os registros são reconhecidos pelo identificador e apenas atualizados.
- **Colunas desconhecidas não se perdem:** ficam guardadas no campo `extra_json` e voltam no backup.
- **Perfis sem senha:** quando o CSV de usuários e senhas não é importado, esses perfis aparecem com o aviso **"Sem senha"** em Gestão de Contas. O admin define uma senha e o usuário passa a conseguir entrar.

> **Atenção:** os CSVs e a exportação completa contêm dados pessoais **decifrados** (NIP, e-mail, hash de senha). **Não os coloque no GitHub** nem os envie por e-mail aberto. As pastas `data/` e `dados/` já estão no `.gitignore`. Cada exportação fica registrada na auditoria.

---

## 4. Backups

| Tipo | Quando | Onde |
|---|---|---|
| Automático diário | Ao iniciar e a cada hora, se ainda não houver backup no dia | `data/backups/` |
| Antes de importar | Em toda importação | `data/backups/` |
| Antes de excluir usuário | Em toda exclusão | `data/backups/` |
| Manual | Botão **Criar backup agora**, ou `npm run backup` | `data/backups/` |
| Exportação completa | Botão **Backup completo (.json)** | Download no navegador |

O sistema mantém os 30 backups mais recentes (`data/backups/sisferias_DATA_motivo.json`). Para mudar a quantidade, use a variável `KEEP_BACKUPS`. Os dados pessoais ficam **cifrados** nos backups: guarde a chave `data/chave-dados.key` separada deles.

**Guarde cópias fora do servidor.** Em **Segurança → Dados e Backup**, configure uma pasta extra (rede ou outro disco).
- **Funcionamento:** todo backup também é copiado para essa pasta, mantendo a mesma quantidade (`KEEP_BACKUPS`).
- **Teste:** ao salvar, o sistema testa a gravação.
- **Acompanhamento:** a tela mostra o resultado da última cópia.
- **Importação:** a pasta configurada não é importada junto com backups de outro servidor.

### Restaurar

- **Pela tela:** em **Importar Dados**, selecione o `.json` e escolha o modo **Substituir**.
- **Pelo comando:** `npm run restaurar -- data/backups/sisferias_....json` (acrescente `--mesclar` para não apagar o que não estiver no arquivo).
- **Backups `.db` das versões 2.x:** `npm run banco -- migrar-sqlite caminho/do/arquivo.db`.

### Mudar de computador

Feche o SISFERIAS, copie a pasta inteira, incluindo a pasta `data/` (banco, chave e backups), para o novo computador e execute `iniciar.bat`.

---

## 5. Esqueci a senha do administrador

No servidor, abra um terminal na pasta do SISFERIAS e execute:

```bash
npm run admin -- --senha NovaSenha@2026
```

Isso redefine a senha da conta `admin` (ou recria a conta, se tiver sido excluída). A senha precisa seguir a regra (10+ caracteres com maiúscula, minúscula, número e especial) e é **provisória**: o sistema pede outra no primeiro acesso. Para outra conta, informe o login:

```bash
npm run admin -- --login 12345678 --senha NovaSenha@2026
npm run admin -- --login 12345678 --desbloquear      # só libera conta bloqueada por tentativas
```

Atenção: com `--senha`, o comando também **torna a conta administradora** e a desbloqueia. Pode ser usado com o SISFERIAS ligado.

---

## 6. Atualizar para uma versão nova

1. Faça um backup (botão **Criar backup agora**).
2. Substitua os arquivos do sistema pelos da versão nova, **mantendo a pasta `data/`**.
3. Execute `atualizar.bat` (Windows) ou `./atualizar.sh` (Linux). Com o pacote pronto da página Releases, não é necessário: basta substituir os arquivos.
4. Inicie normalmente. Se houver mudanças no banco, elas são aplicadas automaticamente.

**Da versão 2.x (SQLite) para a 3.x (PostgreSQL):** na primeira execução, se existir `data/sisferias.db` e o PostgreSQL estiver vazio, todos os dados são copiados (já cifrados) e o arquivo antigo é renomeado para `sisferias.db.migrado-AAAA-MM-DD`. As senhas continuam valendo; quem tiver senha fora da regra nova troca no próximo acesso.

---

## 7. Configuração (variáveis de ambiente)

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `3000` | Porta do servidor |
| `HOST` | `0.0.0.0` | Interface de rede (`0.0.0.0` = todas) |
| `DATA_DIR` | `./data` | Pasta do banco embutido, chave, backups e certificados |
| `DATABASE_URL` | (vazio = embutido) | PostgreSQL externo, usuário da aplicação: `postgres://sisferias_app:SENHA@servidor:5432/sisferias` |
| `DATABASE_OWNER_URL` | (vazio) | PostgreSQL externo, usuário dono (migrações e privilégios) |
| `PG_PORT` | `5433` | Porta do PostgreSQL embutido (só localhost) |
| `SISFERIAS_CHAVE` | (arquivo `data/chave-dados.key`) | Chave dos dados cifrados (32 bytes em base64) |
| `HTTPS` | `1` | `0` desliga o HTTPS (somente com proxy HTTPS na frente) |
| `HTTPS_CERT` / `HTTPS_KEY` / `HTTPS_PFX` / `HTTPS_PFX_SENHA` | (vazio) | Certificado do CTIM |
| `AMBIENTE` | `producao` | `homologacao` mostra a faixa de aviso e libera `npm run dados-ficticios` |
| `ADMIN_EMAIL` | `admin@sisferias.local` | E-mail do admin criado na primeira execução |
| `ADMIN_PASSWORD` | (aleatória) | Senha do admin criado na primeira execução (provisória se gerada ou fora da regra) |
| `SESSION_DAYS` | `7` | Dias até a sessão expirar |
| `ELEVATION_MINUTES` | `15` | Minutos sem uso até a área de Segurança pedir a senha de novo |
| `KEEP_BACKUPS` | `30` | Quantidade de backups mantidos |
| `BCRYPT_COST` | `12` | Custo do hash das senhas (testes usam 4) |

As mesmas opções podem ficar em `data/config.json` (`port`, `host`, `https`, `database`, `ambiente`), que vale também para o modo serviço. O arquivo é gravado com permissão só do dono, pois pode conter senhas do banco.

---

## 8. Informações técnicas

### Arquitetura

```text
Navegador (React)  ──HTTPS──▶  Servidor Node (Express)  ──▶  PostgreSQL 17
                               • entrega a interface (dist/)   (embutido em data/postgres, só localhost,
                               • API REST /api/* (JSON)          ou externo no CLTI)
                               • cifra/decifra dados pessoais
```

- **Front-end:** React 19, TypeScript, Vite 6, Tailwind CSS 3 (compilado), `react-router-dom`, `recharts`, `date-fns` e `lucide-react`.
- **Servidor:** Node.js 22.13+ com Express 5 e o driver `pg`.
- **Banco:** PostgreSQL. No modo embutido, os binários oficiais (pacotes `@embedded-postgres/<plataforma>`) são iniciados pelo `pg_ctl` com `listen_addresses = localhost`, autenticação `scram-sha-256` e log de conexões e de DDL. O PostgreSQL continua de pé se o Node cair e é reaproveitado no reinício; é desligado ao encerrar o SISFERIAS.
- **Usuários de banco:** `sisferias_dono` (migrações) e `sisferias_app` (só `SELECT/INSERT/UPDATE/DELETE`; em `audit_logs` e `operation_log` só `SELECT/INSERT`).
- **Dados pessoais:** cifrados na aplicação com AES-256-GCM (`server/crypto.js`); buscas por NIP/e-mail por índice cego HMAC-SHA256. A chave fica fora do banco e é conferida na inicialização (impressão digital em `app_meta`).
- **Login:** NIP ou e-mail. Senhas em `bcrypt(SHA-256(id + senha))`, custo 12. Sessão em cookie `httpOnly`/`Secure` (o banco guarda só o hash do token).
- **Segurança:**
  - permissões verificadas no servidor (não só na tela);
  - ações administrativas exigem a confirmação recente da senha do próprio admin (expira por inatividade);
  - bloqueio da conta após 5 senhas erradas seguidas, mensagem de erro genérica, troca obrigatória de senha provisória;
  - limite de 30 erros de login por IP em 15 minutos;
  - `Cache-Control: no-store`, `autocomplete="off"`, HSTS, proteção contra requisições forjadas;
  - registro de todas as operações (`operation_log`).

### Estrutura

```text
server/
  start.js        Ponto de entrada (verifica a versão do Node)
  index.js        Servidor HTTP: API + interface compilada
  api.js          Rotas da API e regras de permissão
  auth.js         Sessões, login e proteção das rotas
  db.js           Conexão PostgreSQL, transações, conversões/cifragem, migrações, privilégios e admin inicial
  pgembed.js      PostgreSQL embutido (initdb/pg_ctl) e criação de banco e usuários
  crypto.js       Cifragem AES-256-GCM, índice cego, chave, regra e hash de senhas
  oplog.js        Registro de operações
  legacy.js       Migração automática dos dados das versões 2.x (SQLite)
  schema.js       Tabelas, colunas cifradas e migrações versionadas
  importer.js     Importação (CSV/JSON, inclusive backups cifrados) e exportação
  backup.js       Backups (JSON cifrado) e rotina diária
scripts/          admin.js, backup.js, restaurar.js, banco.js, dados-ficticios.js, https.js, servico.js, pacote.js
lib/api.ts        Cliente da API usado pelas telas
contexts/         AuthContext (sessão/usuários) e VacationContext (dados)
pages/, components/  Telas
```

### Permissões aplicadas pelo servidor

| Ação | Usuário | Admin |
|---|---|---|
| Ver lançamentos de férias | Completos só os próprios; dos demais, apenas setor, categoria e datas (para os indicadores da tela inicial), sem nome, NIP, foto, justificativa ou NUP | Todos se tiver visão global, senão só do próprio setor |
| Ver cadastro de usuários | Completo só o próprio; dos demais, apenas o identificador e a categoria | Todos |
| Criar, editar ou excluir lançamento | Só os próprios, e se não estiver bloqueado | Qualquer um |
| Preferências de impressão | Só as próprias | Qualquer usuário |
| Enviar sugestão | Sim | Sim |
| Ver sugestões | Só as próprias | Todas |
| Avisos, configurações, auditoria | Só leitura de avisos e configurações | Total |
| Usuários (bloquear, papel, visibilidade, senha, desbloquear conta, excluir) | Não | Sim |
| Importar, exportar e backups | Não | Sim |
| Registro de operações | Não | Sim (só leitura) |

O último administrador não pode ser rebaixado, e o admin não pode excluir a própria conta.

Outras regras do servidor:
- **Prazo final de lançamento:** fica em `system_settings.vacation_deadline` (`server/deadline.js`). É verificado ao iniciar e a cada 10 minutos. Quando vence, bloqueia todos uma única vez por prazo, o que preserva as liberações manuais. Contas novas nascem bloqueadas enquanto o prazo vencido estiver em vigor.
- **Senhas:** mínimo de 10 caracteres com maiúscula, minúscula, número e especial em todo o sistema (cadastro, troca pelo próprio usuário, redefinição pelo admin e `npm run admin`). Para trocar a própria senha, fora da área de Segurança, é preciso informar a atual, e a nova deve ser diferente. Senhas definidas por outra pessoa são provisórias (`must_change_password`): até a troca, a API só aceita `/auth/me`, `/auth/password` e `/auth/logout`.
- **Bloqueio de conta:** `auth_users.failed_attempts`/`locked_at`. Ao atingir 5 erros seguidos, as sessões do usuário são apagadas e o bloqueio vai para a auditoria. Desbloqueio: `PATCH /api/profiles/:id { unlock: true }` ou `npm run admin -- --desbloquear`.
- **Auditoria:** o autor é sempre o usuário da sessão; o nome enviado pela tela é ignorado.
- **Aviso de Privacidade (LGPD):** `GET /api/privacidade` (público) devolve o nome da OM, o Encarregado pelo tratamento de dados e o contato (`system_settings.privacy_officer`/`privacy_contact`, configurados em Segurança → Sistema). O cadastro exige `privacy_ack: true` (ciência do aviso), registrada no Registro de Operações. Sem Encarregado configurado, o aviso usa um texto genérico e o Painel mostra um alerta aos administradores.
- **Telas:** buscam os dados de novo ao trocar de tela, ao voltar para a janela e a cada 60 s. Registros sem mudança mantêm o mesmo objeto, para não reiniciar formulários abertos.
- **"Quadro/Esp.":** gravado em `print_preferences.specialization` no cadastro e no formulário de férias.
- **Imagens:** foto e logo são reduzidos no navegador (foto até 400 px; logo até 600 px, mantendo a transparência). O servidor recusa imagens acima de 2 MB ou fora dos formatos JPG, PNG, WEBP e GIF.
- **Relatório Excel:** gerado no navegador a partir da lista do Painel (`lib/excelReport.ts`), respeitando os filtros. A biblioteca só é baixada no clique.
- **Carregamento:** as telas são carregadas sob demanda (`React.lazy`), e as bibliotecas grandes ficam em arquivos próprios. A tela de login abre com cerca de 260 KB.
- **Papeleta:** usa o CSS compilado do próprio sistema, sem CDN, e funciona sem internet.

### Telas e rotas

| Rota | Tela | Acesso |
|---|---|---|
| `/login`, `/register` | Login e cadastro | Público |
| `/home` | Área pessoal e avisos | Autenticado |
| `/` | Painel | Admin |
| `/calendar`, `/justifications`, `/tramite` | Calendário, justificativas, trâmite | Admin |
| `/vacation-form` | Lançamento de férias | Autenticado |
| `/print` | Documento para impressão | Autenticado |
| `/suggestions` | Sugestões | Autenticado |
| `/security` | Segurança (abas administrativas e **Dados e Backup**) | Admin, com confirmação da própria senha |

### Desenvolvimento

```bash
npm install
npm run dev:server   # API em http://localhost:3000 (reinicia ao salvar)
npm run dev          # interface em http://localhost:5173 (repassa /api para a 3000)
```

| Script | Função |
|---|---|
| `npm start` | Inicia o servidor (usa `dist/`) |
| `npm run build` | Compila a interface em `dist/` |
| `npm run preview` | Compila e inicia |
| `npm run backup` | Cria um backup manual |
| `npm run restaurar -- arquivo.json` | Restaura um backup |
| `npm run admin -- --senha X` | Redefine a senha do administrador (também `--desbloquear`) |
| `npm run banco -- status` | Banco em uso e contagem de registros; também `preparar`, `configurar`, `embutido`, `migrar-sqlite`, `parar` |
| `npm run dados-ficticios` | Popula o ambiente de homologação com militares fictícios |
| `npm run pacote -- --plataforma windows` | Gera `pacote/sisferias` pronto para rodar sem internet (com os binários do PostgreSQL da plataforma) |
| `npm run servico -- instalar` | Instala como serviço (Windows/Linux); também `remover`, `parar`, `status` |
| `npm test` | Testes do servidor (API, permissões, prazo, backups, persistência, normas da DCTIM, migração 2.x) em menos de 1 minuto, sem navegador |
| `npm run typecheck` | Verifica os tipos do código (TypeScript); deve terminar sem erros |
| `npm run https -- ativar --cert ... --key ...` | Instala o certificado do CTIM (veja "Conexão criptografada") |
| `npm run test:e2e` | Testes completos no navegador com 5 contas. Requer uma vez: `npm install --no-save playwright && npx playwright install chromium` |

Rode `npm test` antes de publicar qualquer mudança. Os testes de navegador cobrem as telas de ponta a ponta, inclusive a papeleta, o reinício do servidor e as gravações simultâneas.

### Publicar uma versão (pacote pronto no GitHub)

Pelo GitHub, sem usar a linha de comando:
1. Abra **Actions → Pacote de instalação → Run workflow**.
2. Informe a versão (ex.: `v2.0.1`) e confirme.

Pela linha de comando: `git tag v2.0.1 && git push origin v2.0.1`.

Nos dois casos, a automação roda os testes, gera `sisferias-v2.0.1-windows.zip` e `sisferias-v2.0.1-linux.zip` (cada um com os binários do PostgreSQL da sua plataforma) e os publica na página **Releases** com as instruções de instalação.

### Evolução do banco

Para mudar o esquema, acrescente uma nova migração ao final de `MIGRATIONS` em `server/schema.js`, sem alterar as já publicadas. Ela é aplicada automaticamente na próxima inicialização (depois de um backup manual, por segurança).

### Diagnóstico

- **"A porta 3000 já está em uso":** o SISFERIAS já está rodando, provavelmente como serviço. Basta abrir o endereço no navegador.
- **A janela fecha logo ao abrir:** confira a versão do Node com `node -v` (precisa ser 22.13 ou mais recente).
- **Outros computadores não acessam:** verifique o firewall (porta 3000) e se estão usando o IP mostrado em "Na rede".
- **"Usuário e/ou senha inválidos" com a senha certa:** a conta pode estar bloqueada (5 erros) ou sem senha (importação). O admin resolve em Gestão de Contas.
- **"Muitas tentativas a partir deste computador":** aguarde 15 minutos ou reinicie o servidor.
- **"Não foi possível iniciar o PostgreSQL":** a porta 5433 pode estar ocupada; mude com `PG_PORT` ou `"database": { "port": 5440 }` em `data/config.json`. O log fica em `data/postgres/inicializacao.log` e `data/postgres/log/`.
- **"A chave de criptografia ... não foi encontrada / não corresponde":** restaure o arquivo `data/chave-dados.key` original.
- **"Interface não compilada":** execute `npm run build` (ou `atualizar.bat`).
