# SISFERIAS

Sistema web para planejamento, lançamento, acompanhamento, impressão e administração de férias do efetivo, feito para rodar **em um computador da rede interna** e ser acessado pelo navegador nos demais.

- **Banco de dados PostgreSQL** (padrão da DCTIM): embutido, sem instalação separada (os binários oficiais vêm junto e o sistema o liga sozinho), ou um PostgreSQL externo do CLTI.
- **Instalação simples:** instalador para **Windows** (`.exe`, Avançar, Avançar, Concluir) e pacotes para **Ubuntu** (`.deb`) e **Oracle Linux / Red Hat 8 e 9** (`.rpm`), com o Node.js e o banco já dentro. Nada para instalar antes, sem internet.
- **Segurança conforme as normas da DCTIM:** HTTPS obrigatório, dados pessoais cifrados (AES-256), regra de senha forte, bloqueio após 5 tentativas, troca obrigatória de senha provisória, registro de todas as operações e usuário de banco com privilégio mínimo. Detalhes em **[CONFORMIDADE.md](CONFORMIDADE.md)**.
- **Funciona sem internet:** interface, fontes e estilos vão empacotados.
- **Backup automático:** um por dia, e também antes de cada importação ou exclusão de usuário (com os dados pessoais cifrados).
- **Importação e exportação** pela própria tela (CSV ou backup JSON), inclusive com as senhas já criptografadas.

> **Quer só instalar?** Baixe o instalador na seção **[1. Instalação rápida](#1-instalação-rápida)** (links diretos para Windows, Ubuntu e Oracle Linux).
>
> **Vai instalar ou administrar o sistema?** Comece pelo guia passo a passo **[INSTALACAO.md](INSTALACAO.md)**: instalação, primeiro acesso, quem administra, recuperação de acesso, chave dos dados e backups, em linguagem simples.
>
> **Homologação na DCTIM?** Veja **[CONFORMIDADE.md](CONFORMIDADE.md)**: cada requisito das normas DCTIMARINST 33-06B, DCTIMBOTEC 31/002/2020, DCTIMBOTEC 30/002/2023 e DCTIMARINST 30-17, como é atendido e como verificar.

---

## 1. Instalação rápida

### ⬇️ Baixar o instalador (última versão)

| Computador | Baixar |
|---|---|
| **Windows** | **[sisferias-instalador-windows.exe](https://github.com/freitasnascimentomarinha-debug/SISFERIAS/releases/latest/download/sisferias-instalador-windows.exe)**: dois cliques e siga o assistente |
| **Ubuntu** | **[sisferias-instalador-ubuntu.deb](https://github.com/freitasnascimentomarinha-debug/SISFERIAS/releases/latest/download/sisferias-instalador-ubuntu.deb)**: dois cliques, ou `sudo apt install ./sisferias-instalador-ubuntu.deb` |
| **Oracle Linux / Red Hat 8 e 9** | **[sisferias-instalador-oracle-linux.rpm](https://github.com/freitasnascimentomarinha-debug/SISFERIAS/releases/latest/download/sisferias-instalador-oracle-linux.rpm)**: `sudo dnf install ./sisferias-instalador-oracle-linux.rpm` |
| **Todos + manual e guia** | **[SISFERIAS-completo.zip](https://github.com/freitasnascimentomarinha-debug/SISFERIAS/releases/latest/download/SISFERIAS-completo.zip)**: extraia e use o instalador da pasta Windows, Ubuntu ou Oracle Linux |

> O botão verde **Code → Download ZIP** baixa só o código-fonte, **sem** os instaladores. Use os links acima.

Detalhes de cada arquivo, na página **[Releases](https://github.com/freitasnascimentomarinha-debug/SISFERIAS/releases/latest)**:

- **Windows:** baixe `sisferias-vX.Y.Z-instalador-windows.exe`, dê dois cliques e siga o assistente. O sistema fica em `C:\SISFERIAS`, roda como serviço (inicia com o Windows), a porta 3000 é liberada no firewall e o atalho **SISFERIAS** é criado na área de trabalho. Se o Windows mostrar "O Windows protegeu o computador", clique em **Mais informações → Executar assim mesmo** (o instalador não tem assinatura digital de empresa).
- **Ubuntu:** baixe `sisferias_X.Y.Z_amd64.deb` e instale com `sudo apt install ./sisferias_X.Y.Z_amd64.deb`. O sistema fica em `/opt/sisferias`, roda como serviço do systemd com o usuário de sistema `sisferias`, e o endereço e a senha provisória aparecem no final.
- **Oracle Linux (e Red Hat, Rocky, AlmaLinux) 8 ou 9:** baixe `sisferias-X.Y.Z-1.x86_64.rpm` e instale com `sudo dnf install ./sisferias-X.Y.Z-1.x86_64.rpm`. Mesmo funcionamento do Ubuntu: `/opt/sisferias`, serviço do systemd, usuário `sisferias`, porta liberada no `firewalld`.
- **Sem instalador:** `sisferias-vX.Y.Z-windows.zip` / `-linux.zip`: extraia numa pasta fixa e execute `iniciar.bat` / `./iniciar.sh` (no Linux, `sudo ./instalar.sh` instala como serviço).

Todos trazem o **Node.js** (pasta `runtime`) e o **PostgreSQL** embutidos. Nos outros computadores da rede, abra `https://IP-DO-SERVIDOR:3000` no navegador. Comandos de administração no servidor: `sisferias.cmd COMANDO` (Windows) ou `sudo /opt/sisferias/sisferias COMANDO` (Ubuntu e Oracle Linux), equivalentes a `npm run COMANDO --` do código-fonte.

Os instaladores são gerados pelo GitHub a cada versão e **testados de verdade** antes de publicar: instalados, acessados e desinstalados numa máquina Windows, numa Ubuntu e em Oracle Linux 8 e 9 (workflow "Instaladores").

Para rodar o **código-fonte** (desenvolvimento): Node.js 22.13+, `npm install` e `iniciar.bat` (ou `npm run build && npm start`).

### Primeiro acesso

Na primeira execução é criado um administrador:

- **Login:** `admin` (ou `admin@sisferias.local`)
- **Senha provisória:** aparece na janela e fica gravada em `data/ADMIN_INICIAL.txt`

No primeiro acesso o sistema exige uma nova senha. Assim que ela é trocada, o arquivo `ADMIN_INICIAL.txt` é apagado sozinho (numa atualização ele também é apagado se a senha provisória não valer mais). **Guarde uma cópia de `data/chave-dados.key`** fora do servidor: sem ela os dados cifrados não podem ser lidos.

### Quem acessa a área de Segurança

Não existe senha única para a área de Segurança. O controle funciona assim:

1. **Só administradores com Visão Global (Departamento de Pessoal) veem a área.** Usuários comuns e encarregados de setor (admin "Apenas Setor") não têm o item no menu, e o servidor recusa as ações deles.
2. **Para entrar, o administrador confirma a própria senha de login.** Cada um usa a sua senha, e cada entrada (ou tentativa errada) fica registrada na **Auditoria** com o nome de quem tentou.
3. **A área bloqueia sozinha** após 15 minutos sem uso (configurável em `ELEVATION_MINUTES`) e tem o botão **Bloquear área**, para quando o administrador se afastar do computador.
4. **Quem é administrador** é definido em **Gestão de Contas**, botão de nível de acesso. A conta promovida começa como **Apenas Setor** (encarregado); a **Visão Global** é concedida no botão ao lado. Para tirar o acesso de alguém, basta voltar a conta para **Acesso Padrão**. Sempre resta ao menos um administrador com Visão Global.

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

### Histórico de versões

| Versão | Principais mudanças | Ação na atualização |
|---|---|---|
| **3.1.7** | **Instalador para Oracle Linux (e Red Hat, Rocky, AlmaLinux) 8 e 9:** pacote `.rpm` com o Node.js e o PostgreSQL embutidos (`sudo dnf install ./sisferias-instalador-oracle-linux.rpm`), com o mesmo funcionamento do `.deb`: `/opt/sisferias`, usuário de sistema, serviço do systemd, `firewalld`, atalhos e Manual. Instalação, atualização e remoção testadas de verdade em contêineres Oracle Linux 8 e 9 a cada versão. O `SISFERIAS-completo.zip` ganha a pasta "Oracle Linux". | Nenhuma. |
| **3.1.6** | **Senha provisória do administrador:** o arquivo `data/ADMIN_INICIAL.txt` é apagado sozinho quando a senha provisória é trocada, e também ao iniciar o sistema se ela não valer mais. Assim, ao atualizar uma instalação em que o administrador já trocou a senha, o instalador não mostra mais uma senha antiga que não funciona. | Nenhuma: a atualização apaga o arquivo antigo, se houver. |
| **3.1.5** | **Volta sozinho depois de desligar o computador:** o banco embutido remove a trava deixada por um desligamento sem encerrar o sistema (no Windows, o número do processo antigo pode passar a outro programa e o PostgreSQL se recusava a iniciar); a tarefa do Windows passa a iniciar também quando alguém entra no Windows (com a "Inicialização rápida", desligar e ligar não dispara o gatilho de inicialização). Testado no Windows simulando a queda: o serviço volta sozinho. | Execute o instalador da versão nova (a tarefa do Windows é recriada com o gatilho novo). |
| **3.1.4** | **Manual do Usuário junto com o sistema:** o PDF vem no instalador do Windows (menu Iniciar → "Manual do Usuário" e opção "Abrir o Manual do Usuário" no fim da instalação), no `.deb` (menu de aplicativos → "Manual do SISFERIAS"), nos `.zip` e no `SISFERIAS-completo.zip`. Painel: os botões Gerar Relatório (PDF), Exportar Excel e Exportar CSV passam a ter o mesmo estilo (fundo branco). Cabeçalho: o logo não sobrepõe mais o menu; para administradores, o menu completo aparece em telas a partir de 1360 px de largura e, abaixo disso, fica no botão ☰ (menu lateral). | Nenhuma. |
| **3.1.3** | **Download com um clique:** links diretos no README para o instalador da última versão (Windows e Ubuntu) e o novo **SISFERIAS-completo.zip** (os dois instaladores, o guia e um LEIA-ME: extrair e clicar). Os exemplos de NUP e NIP nas telas, nos testes e no código passam a ser números fictícios (`12345.000001/2026-01`, `12345678`). | Nenhuma. |
| **3.1.2** | Instalador do Windows passa a exibir a tela de boas-vindas com o logo e o mascote (o Inno Setup 6 a omitia por padrão). Fotos das telas do instalador geradas automaticamente numa máquina Windows (workflow "Capturas do instalador"); as fotos estão no INSTALACAO.md e no Manual do Usuário. | Nenhuma. |
| **3.1.1** | **Identidade visual:** logo e mascote do SISFERIAS na tela de entrada, no topo das telas (ícone), no ícone da aba do navegador e numa faixa de boas-vindas na tela Início (o logo também substitui o quadro "MB" enquanto a OM não cadastra o próprio). Instalador do Windows com o logo e o mascote nas telas do assistente e ícone próprio nos atalhos e no Painel de Controle; no Ubuntu com área de trabalho, o .deb cria o atalho SISFERIAS no menu de aplicativos. | Nenhuma. |
| **3.1.0** | **Instaladores:** instalador para Windows (`.exe`: pasta `C:\SISFERIAS`, serviço, firewall, atalhos, senha inicial; desinstalador mantém os dados) e pacote para Ubuntu (`.deb`: `/opt/sisferias`, usuário de sistema `sisferias`, serviço do systemd, `ufw`). Os pacotes `.zip` passam a trazer o **Node.js embutido** (nada para instalar antes). Comando de administração `sisferias.cmd` / `sisferias`. Instalação, atualização e remoção testadas de verdade no Windows e no Ubuntu a cada versão. | Quem já usa o `.zip` pode continuar igual, ou instalar o `.exe`/`.deb` por cima na mesma pasta (Windows: `C:\SISFERIAS`), mantendo a pasta `data`. |
| **3.0.9** | **Requerimento de férias:** o ano do adiantamento do adicional natalino passa a vir preenchido com o **exercício de pagamento** (1º de dezembro a 30 de novembro) em que a parcela começa. Exemplo: parcela iniciada em 20/12/2025 → 13º de 2026. Continua editável. | Nenhuma. |
| **3.0.8** | **Requerimento de férias:** botão **Requerimento** na tela Impressão. Abre uma janela para conferir os dados do militar e marcar Sim/Não para o adiantamento do adicional natalino (50%), o adicional de férias (1/3) e a remuneração de férias (70%) (SGM-302, Vol. II, arts. 24.3, 24.4 e 24.7). Ao confirmar, baixa o requerimento em Word, no modelo da OM, com o brasão. A geração fica registrada na auditoria. | Nenhuma. |
| **3.0.7** | **Minhas Férias:** novo destaque "Restam cumprir" com o total de dias do direito que ainda faltam gozar. **Papeleta:** os quatro campos de assinatura (Vice-Diretor, Encarregado do Dep. Pessoal, Encarregado e militar) passam a ter o mesmo espaço para assinar, mantendo o layout. | Nenhuma. |
| **3.0.6** | **Direção (consulta):** novo nível de acesso para Diretor e Vice-Diretor, que veem toda a OM (Painel, Calendário, Justificativas, Trâmite e relatórios) sem alterar lançamentos de outras pessoas e sem acessar a Segurança. **Atalhos no Painel** para editar as férias e imprimir a papeleta de cada militar (lápis e impressora) e **Lançar / editar férias** no Diagnóstico, para o encarregado (no seu setor) e o Departamento de Pessoal. | Para a Direção: **Segurança → Visibilidade → Liberar Todos os Setores → Somente consulta (Direção)**. |
| **3.0.5** | **Encarregado de setor sem acesso à gestão do sistema:** o administrador "Apenas Setor" passa a ver e alterar somente os lançamentos, cadastros e papeletas do próprio setor, e não entra mais na área de Segurança (contas, senhas, níveis de visão, prazo, configurações, exportação, backups e auditoria). Só o administrador com **Visão Global** (Departamento de Pessoal) gerencia o sistema e desbloqueia ou redefine senhas. Tudo verificado no servidor. | Se nenhum administrador tinha Visão Global, o sistema a concede aos administradores existentes; confira em **Segurança → Gestão de Contas** e deixe a Visão Global só para o Departamento de Pessoal. |
| **3.0.4** | Calendário mensal: os dias do mês vizinho voltam a aparecer esmaecidos, com o número em cinza (mantendo o contraste mínimo exigido). | Nenhuma. |
| **3.0.3** | **Acessibilidade (e-MAG / WCAG 2.1 AA):** contraste mínimo de 4,5:1 (paleta ajustada), rótulos associados a todos os campos, nome acessível nos botões com ícone, textos alternativos nas imagens e áreas com rolagem acessíveis pelo teclado. Verificação automática (axe-core) em todas as telas incluída nos testes. | Nenhuma. |
| **3.0.2** | O servidor valida as parcelas de férias (datas, ordem e soma dentro do direito), mesmo sem passar pela tela. Remoção de código antigo sem uso que continha uma senha fixa. O Aviso de Privacidade mostra "Carregando…" até receber os dados do Encarregado. | Nenhuma. |
| **3.0.1** | Usuário comum recebe do servidor apenas os próprios dados pessoais. **Aviso de Privacidade** no login e no cadastro, com ciência obrigatória. Encarregado de dados configurável por OM. Versão real na tela de login. | Preencher **Segurança → Sistema → Proteção de Dados (LGPD)**. |
| **3.0.0** | Adequação às normas da DCTIM: PostgreSQL, regra de senha, bloqueio após 5 tentativas, dados pessoais cifrados, HTTPS, registro de operações, ambiente de homologação. | Migração automática dos dados da 2.x; guardar cópia de `data/chave-dados.key`. |
| 2.x | Servidor próprio na rede interna (fim do Vercel/Supabase). | — |

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

| Ação | Usuário | Encarregado (admin "Apenas Setor") | Direção (consulta) | Admin com Visão Global |
|---|---|---|---|---|
| Ver lançamentos de férias | Completos só os próprios; dos demais, apenas setor, categoria e datas (para os indicadores da tela inicial), sem nome, NIP, foto, justificativa ou NUP | Só os do próprio setor | Todos | Todos |
| Ver cadastro de usuários | Completo só o próprio; dos demais, apenas o identificador e a categoria | Completos só os do próprio setor | Todos | Todos |
| Criar, editar ou excluir lançamento | Só os próprios, e se não estiver bloqueado | Só do próprio setor (não move ninguém para outro setor, nem a si mesmo) | Só os próprios | Qualquer um |
| Preferências de impressão | Só as próprias | Do próprio setor | Lê de todos; altera só as próprias | Qualquer usuário |
| Enviar sugestão | Sim | Sim | Sim | Sim |
| Ver sugestões | Só as próprias | Só as próprias | Só as próprias | Todas |
| Área de Segurança: avisos, configurações, prazo, auditoria | Só leitura de avisos e configurações | Só leitura de avisos e configurações | Só leitura de avisos e configurações | Total |
| Usuários (bloquear, papel, visibilidade, senha, desbloquear conta, excluir) | Não | Não | Não | Sim |
| Importar, exportar e backups | Não | Não | Não | Sim |
| Registro de operações | Não | Não | Não | Sim (só leitura) |

A Direção (consulta) é um admin com Visão Global e `read_only = true`. O último administrador com Visão Global que gerencia o sistema não pode ser rebaixado, perder a Visão Global nem virar consulta, e o admin não pode excluir a própria conta.

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
| `/login`, `/register` | Login e cadastro (com o Aviso de Privacidade) | Público |
| `/home` | Área pessoal e avisos | Autenticado |
| `/` | Painel | Admin |
| `/calendar`, `/justifications`, `/tramite` | Calendário, justificativas, trâmite | Admin |
| `/vacation-form` | Lançamento de férias | Autenticado |
| `/print` | Documento para impressão | Autenticado |
| `/suggestions` | Sugestões | Autenticado |
| `/security` | Segurança (abas administrativas e **Dados e Backup**) | Admin com Visão Global, com confirmação da própria senha |

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
