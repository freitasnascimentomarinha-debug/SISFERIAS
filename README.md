# SISFERIAS

Sistema web para planejamento, lançamento, acompanhamento, impressão e administração de férias do efetivo, feito para rodar **em um computador da rede interna** e ser acessado pelo navegador nos demais.

- **Instalação simples:** só é preciso ter o Node.js. Não há banco de dados para instalar.
- **Banco embutido (SQLite):** os dados ficam em um único arquivo, `data/sisferias.db`.
- **Funciona sem internet:** interface, fontes e estilos vão empacotados.
- **Backup automático:** um por dia, e também antes de cada importação ou exclusão de usuário.
- **Importação e exportação** pela própria tela, incluindo a migração do Supabase com preservação das senhas.

---

## 1. Instalação rápida (Windows)

1. Instale o **Node.js LTS** (versão 22.13 ou mais recente) em <https://nodejs.org>, aceitando as opções padrão.
2. Baixe o SISFERIAS de uma das duas formas:
   - **Pacote pronto (recomendado, não precisa de internet na instalação):** na página **Releases** do GitHub, baixe `sisferias-vX.Y.Z.zip`.
   - **Código-fonte:** botão verde **Code → Download ZIP**. Nesse caso a primeira execução precisa de internet para baixar as dependências.
3. Extraia o `.zip` em uma pasta fixa, por exemplo `C:\SISFERIAS`.
4. Dê dois cliques em **`iniciar.bat`**.
5. A janela mostra os endereços de acesso:
   ```
   SISFERIAS em execução.
     Neste computador:  http://localhost:3000
     Na rede:           http://192.168.0.15:3000
   ```
   Nos outros computadores da rede, abra o endereço **"Na rede"** no navegador.

A janela precisa ficar aberta enquanto o sistema estiver em uso. Ao fechá-la, o sistema para.

### Primeiro acesso

Na primeira execução é criado um administrador:

- **Login:** `admin` (ou `admin@sisferias.local`)
- **Senha:** aparece na janela e fica gravada em `data/ADMIN_INICIAL.txt`

Depois de entrar, troque a senha em **Segurança → Sistema → Alterar Minha Senha** e apague o arquivo `ADMIN_INICIAL.txt`.

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
docker compose up -d
```

Os dados ficam em `./data`. Para ver a senha inicial, use `docker compose logs sisferias`.

---

## 2. Acesso pela rede

- **Firewall:** o computador servidor precisa aceitar conexões na porta **3000**. No Windows, na primeira execução, permita o acesso quando o Firewall perguntar. Se não perguntar, crie uma regra de entrada TCP para a porta 3000.
- **Endereço fixo:** peça à TI um **IP fixo** (ou nome DNS) para o servidor, para que o endereço não mude.
- **Outra porta:** se a 3000 estiver ocupada, defina a variável `PORT` antes de iniciar (no Windows, `set PORT=8080` e depois `iniciar.bat`).
- **Iniciar com o Windows:** coloque um atalho de `iniciar.bat` em `shell:startup`, ou peça à TI para registrá-lo como serviço (por exemplo, com NSSM).

---

## 3. Migração do Supabase (sem perder dados)

O Supabase continua intacto durante todo o processo. Desligue-o só depois de conferir o sistema novo.

1. **Exporte as tabelas.** No painel do Supabase, em **Table Editor**, abra cada tabela e use **Export → Export table as CSV**:
   `profiles`, `employees`, `system_settings`, `notices`, `audit_logs`, `suggestions` e `print_preferences`.
2. **Exporte as senhas.** Para que ninguém precise trocar de senha, abra o **SQL Editor**, execute a consulta abaixo e exporte o resultado em CSV com o nome `users.csv`:
   ```sql
   select id, email, encrypted_password, created_at from auth.users;
   ```
   As senhas estão criptografadas (bcrypt). Nem você nem o sistema veem a senha real.
3. No SISFERIAS, entre como admin e abra **Segurança → Dados e Backup → Importar Dados**.
4. Selecione **todos os CSVs de uma vez** e clique em **Analisar arquivos**. Nada é gravado nessa etapa. A tela mostra:
   - qual tabela foi reconhecida em cada arquivo (dá para corrigir manualmente);
   - quantos registros serão **novos**, **atualizados** e **com erro**, com o motivo e o número da linha;
   - avisos, como perfis que ficarão sem senha ou colunas não previstas.
5. Clique em **Importar**. Antes de gravar, o sistema faz um backup automático. A importação roda em uma transação: se algo falhar, nada é alterado.
6. Confira o quadro **Antes / Depois** e confira alguns registros por amostragem.

Outros detalhes:

- **Importar de novo não duplica:** os registros são reconhecidos pelo identificador e apenas atualizados.
- **Colunas desconhecidas não se perdem:** ficam guardadas no campo `extra_json` e voltam no backup.
- **Perfis sem senha:** quando o CSV de `auth.users` não é importado, esses perfis aparecem com o aviso **"Sem senha"** em Gestão de Contas. O admin define uma senha e o usuário passa a conseguir entrar.

> **Atenção:** os CSVs contêm dados pessoais (NIP, e-mail, hash de senha). **Não os coloque no GitHub.** As pastas `data/` e `dados/` já estão no `.gitignore`.

---

## 4. Backups

| Tipo | Quando | Onde |
|---|---|---|
| Automático diário | Ao iniciar e a cada hora, se ainda não houver backup no dia | `data/backups/` |
| Antes de importar | Em toda importação | `data/backups/` |
| Antes de excluir usuário | Em toda exclusão | `data/backups/` |
| Manual | Botão **Criar backup agora**, ou `npm run backup` | `data/backups/` |
| Exportação completa | Botão **Backup completo (.json)** | Download no navegador |

O sistema mantém os 30 backups mais recentes. Para mudar a quantidade, use a variável `KEEP_BACKUPS`.

**Guarde cópias fora do servidor** (pasta de rede, pen drive). Se o disco do servidor falhar, só restam essas cópias.

### Restaurar

- **Pelo backup em JSON:** em **Importar Dados**, selecione o `.json` e escolha o modo **Substituir**.
- **Pelo arquivo `.db`:** feche o SISFERIAS, apague `data/sisferias.db-wal` e `data/sisferias.db-shm` (se existirem), substitua `data/sisferias.db` pelo backup desejado (renomeando-o) e inicie de novo.

### Mudar de computador

Copie a pasta inteira do SISFERIAS, incluindo a pasta `data/`, para o novo computador e execute `iniciar.bat`.

---

## 5. Esqueci a senha do administrador

No servidor, abra um terminal na pasta do SISFERIAS e execute:

```bash
npm run admin -- --senha NOVA_SENHA
```

Isso redefine a senha da conta `admin` (ou recria a conta, se tiver sido excluída). Para outra conta, informe o login:

```bash
npm run admin -- --login 12345678 --senha NOVA_SENHA
```

Atenção: esse comando também **torna a conta administradora** e a desbloqueia.

---

## 6. Atualizar para uma versão nova

1. Faça um backup (botão **Criar backup agora**).
2. Substitua os arquivos do sistema pelos da versão nova, **mantendo a pasta `data/`**.
3. Execute `atualizar.bat` (Windows) ou `./atualizar.sh` (Linux). Com o pacote pronto da página Releases, não é necessário: basta substituir os arquivos.
4. Inicie normalmente. Se houver mudanças no banco, elas são aplicadas automaticamente.

---

## 7. Configuração (variáveis de ambiente)

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `3000` | Porta do servidor |
| `HOST` | `0.0.0.0` | Interface de rede (`0.0.0.0` = todas) |
| `DATA_DIR` | `./data` | Pasta do banco e dos backups |
| `ADMIN_EMAIL` | `admin@sisferias.local` | E-mail do admin criado na primeira execução |
| `ADMIN_PASSWORD` | (aleatória) | Senha do admin criado na primeira execução |
| `SESSION_DAYS` | `7` | Dias até a sessão expirar |
| `ELEVATION_MINUTES` | `15` | Minutos sem uso até a área de Segurança pedir a senha de novo |
| `KEEP_BACKUPS` | `30` | Quantidade de backups mantidos |

---

## 8. Informações técnicas

### Arquitetura

```text
Navegador (React)  ──HTTP──▶  Servidor Node (Express)  ──▶  SQLite (data/sisferias.db)
                              • entrega a interface (dist/)
                              • API /api/* com login e permissões
```

- **Front-end:** React 19, TypeScript, Vite 6, Tailwind CSS 3 (compilado), `react-router-dom`, `recharts`, `date-fns` e `lucide-react`.
- **Servidor:** Node.js 22.13+ com Express 5. O banco usa o módulo nativo `node:sqlite`, então não há nada para compilar nem banco para instalar.
- **Banco:** modo WAL (leituras e gravações simultâneas), atende de algumas centenas a poucos milhares de usuários simultâneos.
- **Login:** NIP ou e-mail. Senhas em bcrypt. Sessão em cookie `httpOnly` (sem token no navegador).
- **Segurança:**
  - permissões verificadas no servidor (não só na tela);
  - ações administrativas exigem a confirmação recente da senha do próprio admin (expira por inatividade);
  - limite de 10 tentativas de login em 15 minutos;
  - proteção contra requisições forjadas.

### Estrutura

```text
server/
  start.js        Ponto de entrada (verifica a versão do Node)
  index.js        Servidor HTTP: API + interface compilada
  api.js          Rotas da API e regras de permissão
  auth.js         Sessões, login e proteção das rotas
  db.js           Conexão SQLite, conversões, migrações e admin inicial
  schema.js       Tabelas e migrações versionadas
  importer.js     Importação (CSV/JSON) e exportação
  backup.js       Backups (VACUUM INTO) e rotina diária
scripts/          admin.js (senha), backup.js, pacote.js (pacote offline)
lib/api.ts        Cliente da API usado pelas telas
contexts/         AuthContext (sessão/usuários) e VacationContext (dados)
pages/, components/  Telas
```

### Permissões aplicadas pelo servidor

| Ação | Usuário | Admin |
|---|---|---|
| Ver lançamentos de férias | Todos | Todos se tiver visão global, senão só do próprio setor |
| Criar, editar ou excluir lançamento | Só os próprios, e se não estiver bloqueado | Qualquer um |
| Preferências de impressão | Só as próprias | Qualquer usuário |
| Enviar sugestão | Sim | Sim |
| Ver sugestões | Só as próprias | Todas |
| Avisos, configurações, auditoria | Só leitura de avisos e configurações | Total |
| Usuários (bloquear, papel, visibilidade, senha, excluir) | Não | Sim |
| Importar, exportar e backups | Não | Sim |

O último administrador não pode ser rebaixado, e o admin não pode excluir a própria conta.

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
| `npm run admin -- --senha X` | Redefine a senha do administrador |
| `npm run pacote` | Gera `pacote/sisferias` pronto para rodar sem internet |

### Publicar uma versão (pacote pronto no GitHub)

Crie e envie uma tag:

```bash
git tag v2.0.0
git push origin v2.0.0
```

A automação `.github/workflows/release.yml` gera `sisferias-v2.0.0.zip` e o publica na página **Releases**.

### Evolução do banco

Para mudar o esquema, acrescente uma nova migração ao final de `MIGRATIONS` em `server/schema.js`, sem alterar as já publicadas. Ela é aplicada automaticamente na próxima inicialização (depois de um backup manual, por segurança).

### Diagnóstico

- **A janela fecha logo ao abrir:** confira a versão do Node com `node -v` (precisa ser 22.13 ou mais recente).
- **Outros computadores não acessam:** verifique o firewall (porta 3000) e se estão usando o IP mostrado em "Na rede".
- **"Esta conta ainda não tem senha definida":** o admin precisa definir a senha em Gestão de Contas.
- **"Muitas tentativas":** aguarde 15 minutos ou reinicie o servidor.
- **"Interface não compilada":** execute `npm run build` (ou `atualizar.bat`).
