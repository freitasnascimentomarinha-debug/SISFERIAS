# SISFERIAS — Guia de Instalação e Funcionamento

Este guia explica, passo a passo, como instalar o SISFERIAS em um computador da rede
interna, como funciona o primeiro acesso, quem pode administrar o sistema e o que
fazer se ninguém conseguir entrar.

> Informações técnicas para a equipe de TI estão no arquivo `README.md`.
> A relação de cada requisito das normas da DCTIM com o sistema está em `CONFORMIDADE.md`.

---

## 1. Como o sistema funciona

- **Servidor:** o SISFERIAS fica instalado em **um único computador** (ou num servidor do CLTI).
  Esse computador precisa estar ligado e com o SISFERIAS em execução enquanto as pessoas usam o sistema.
- **Demais computadores:** acessam pelo **navegador** (Edge, Chrome, Firefox), digitando
  o endereço do servidor. Neles não se instala nada.
- **Banco de dados:** **PostgreSQL**, o banco padronizado pela DCTIM (DCTIMBOTEC 30/002/2023).
  Há duas formas de uso:
  - **Embutido (padrão):** o próprio SISFERIAS traz o PostgreSQL e o liga sozinho, guardando
    os dados na pasta `data\postgres`. **Não é preciso instalar nada.** O banco só aceita
    conexões do próprio computador.
  - **Externo (recomendado em produção):** um servidor PostgreSQL administrado pela TI/CLTI
    (seção 11).
- **Dados pessoais cifrados:** nome, NIP, e-mail, foto, telefone e endereço são gravados
  **cifrados** (AES-256). Quem tiver acesso apenas ao banco ou a um backup não consegue lê-los.
  A chave fica no arquivo `data\chave-dados.key` (seção 8).
- **Conexão criptografada (HTTPS):** sempre ligada. O endereço começa com `https://`.
- **Internet:** não é necessária para usar o sistema, apenas a rede interna.

```
  Computador A ─┐
  Computador B ─┼──(rede interna, HTTPS)──▶  SERVIDOR (SISFERIAS + PostgreSQL)
  Computador C ─┘
```

---

## 2. O que é preciso

| Item | Detalhe |
|---|---|
| Um computador para ser o servidor | Windows 10/11 ou Windows Server (64 bits), ou **Ubuntu** (20.04 ou mais novo, 64 bits), ligado durante o expediente |
| Nada mais para instalar | O Node.js e o banco PostgreSQL **já vêm dentro** do instalador. Não é preciso internet |
| Rede interna | Os demais computadores precisam enxergar o servidor |
| Certificado do servidor | Emitido pelo **CTIM** (DCTIMBOTEC 31/002, item 3.1.c). Até chegar, o sistema usa um provisório |

Os arquivos ficam na página **Releases** do GitHub do projeto:

| Arquivo | Para quê |
|---|---|
| `sisferias-vX.Y.Z-instalador-windows.exe` | **Instalador do Windows** (recomendado) |
| `sisferias_X.Y.Z_amd64.deb` | **Instalador do Ubuntu** (recomendado) |
| `sisferias-vX.Y.Z-windows.zip` / `-linux.zip` | O mesmo sistema sem instalador (extrair e executar) |

---

## 3. Instalação

### 3.1 Windows: instalador (Avançar, Avançar, Concluir)

1. Baixe o instalador pelo link direto **[sisferias-instalador-windows.exe](https://github.com/freitasnascimentomarinha-debug/SISFERIAS/releases/latest/download/sisferias-instalador-windows.exe)** (sempre a última versão; na página Releases ele também aparece como `sisferias-vX.Y.Z-instalador-windows.exe`) e dê dois cliques nele.
   É preciso ser administrador do computador (o Windows pede a confirmação).
   - Se aparecer **"O Windows protegeu o computador"**, clique em **Mais informações → Executar assim mesmo**.
     O aviso aparece porque o instalador não tem assinatura digital de empresa. Se a política da OM bloquear
     executáveis baixados, peça à Divisão de Informática para executar a instalação.
2. Siga o assistente. A pasta padrão é **`C:\SISFERIAS`** (mantenha).
3. Ao concluir, o instalador:
   - instala o sistema com o Node.js e o PostgreSQL embutidos;
   - instala o **serviço**: o SISFERIAS inicia sozinho com o Windows, mesmo sem ninguém fazer login, e volta sozinho se parar;
   - libera a **porta 3000** no firewall do Windows;
   - cria o atalho **SISFERIAS** na área de trabalho e no menu Iniciar (abre o sistema no navegador);
   - na primeira instalação, abre o arquivo com a **senha provisória do administrador** (seção 4).

Telas do assistente (capturadas num Windows real, na versão 3.1.2):

| | |
|---|---|
| ![Boas-vindas](docs/capturas-instalador/1-boas-vindas.png) | ![Pasta de instalação](docs/capturas-instalador/2-pasta.png) |
| 1. Boas-vindas: clique em **Avançar** | 2. Pasta: mantenha `C:\SISFERIAS` |
| ![Atalho](docs/capturas-instalador/3-tarefas.png) | ![Pronto para instalar](docs/capturas-instalador/4-pronto.png) |
| 3. Deixe marcado o atalho na área de trabalho | 4. Confira e clique em **Instalar** |
| ![Instalando](docs/capturas-instalador/5-instalando.png) | ![Concluído](docs/capturas-instalador/6-concluido.png) |
| 5. Aguarde (até 2 minutos na primeira vez) | 6. Deixe as opções marcadas e clique em **Concluir** |

![Atalho na área de trabalho](docs/capturas-instalador/7-area-de-trabalho.png)

7. O atalho **SISFERIAS** na área de trabalho abre o sistema no navegador.

**Atualizar:** faça um backup (seção 10) e execute o instalador da versão nova. Ele para o serviço, troca os
arquivos e inicia de novo, **mantendo os dados**.

**Desinstalar:** Configurações do Windows → Aplicativos → **SISFERIAS** → Desinstalar (ou "Desinstalar o
SISFERIAS" no menu Iniciar). O serviço e os arquivos do sistema são removidos, mas a pasta
**`C:\SISFERIAS\data`** (banco, backups e chave) é mantida.

### 3.2 Ubuntu: pacote .deb

1. Copie **`sisferias_X.Y.Z_amd64.deb`** para o servidor.
2. Instale com dois cliques (Central de Aplicativos) ou pelo terminal:

```
sudo apt install ./sisferias_X.Y.Z_amd64.deb
```

3. O instalador:
   - instala o sistema em **`/opt/sisferias`** (dados em `/opt/sisferias/data`);
   - cria o usuário de sistema **`sisferias`** (sem login), com o qual o sistema e o banco rodam;
   - instala o **serviço** (systemd): inicia sozinho com o computador e volta se parar;
   - libera a porta 3000 no firewall (`ufw`), se estiver ativo;
   - mostra no final o **endereço de acesso** e a **senha provisória do administrador**.

Comandos úteis: `systemctl status sisferias` (situação), `journalctl -u sisferias -f` (registros),
`sudo systemctl restart sisferias` (reiniciar).

**Atualizar:** faça um backup e instale o `.deb` da versão nova do mesmo jeito. Os dados são mantidos.
**Remover:** `sudo apt remove sisferias`. A pasta `/opt/sisferias/data` é mantida.

Sem o `.deb`, o pacote `sisferias-vX.Y.Z-linux.zip` faz o mesmo: extraia e execute `sudo ./instalar.sh`
(para remover, `sudo /opt/sisferias/desinstalar.sh`).

### 3.3 Sem instalador (pacote .zip)

Para testar rapidamente ou quando não for possível executar o instalador:

1. Baixe `sisferias-vX.Y.Z-windows.zip` (ou `-linux.zip`) e extraia em uma pasta **fixa**, por exemplo
   `C:\SISFERIAS` (não rode de dentro do `.zip` nem da pasta Downloads).
2. Dê dois cliques em **`iniciar.bat`** (no Linux, `./iniciar.sh`). Uma janela preta abrirá. O Node.js já vem
   no pacote (pasta `runtime`), não é preciso instalar nada.
3. Na primeira vez o sistema cria o banco de dados PostgreSQL e a chave dos dados. Quando aparecer a mensagem
   abaixo, está funcionando:

```
SISFERIAS em execução.
  Neste computador:  https://localhost:3000
  Na rede:           https://192.168.0.15:3000
  Banco de dados:    PostgreSQL embutido (C:\SISFERIAS\data\postgres, porta 5433, somente localhost)
```

**Não feche essa janela**, ou instale como serviço com `instalar-servico.bat` (seção 14).
Na primeira execução o Windows pode perguntar se permite o acesso pela rede: marque **Redes privadas** e
**permita só o Node.js** (o PostgreSQL não precisa ser acessado pela rede). Se os outros computadores não
conseguirem abrir o sistema, peça à TI para liberar a **porta TCP 3000** para conexões de entrada.

Para desenvolvedores: o código-fonte (botão **Code → Download ZIP** no GitHub) precisa do Node.js 22.13 ou
mais novo e de internet na primeira execução (`iniciar.bat` instala os componentes e compila a interface).

### 3.4 Comandos de administração no servidor

Os comandos deste guia escritos como `npm run COMANDO -- opções` (backup, restaurar, banco, https,
admin) são para quem roda o código-fonte. Na instalação pelo instalador ou pelo pacote `.zip`, use:

| Sistema | Forma |
|---|---|
| **Windows** | Prompt de Comando **como administrador**, na pasta `C:\SISFERIAS`: `sisferias.cmd COMANDO opções` |
| **Ubuntu** | Terminal: `sudo /opt/sisferias/sisferias COMANDO opções` |

Exemplo: `npm run https -- status` vira `sisferias.cmd https status` (Windows) ou
`sudo /opt/sisferias/sisferias https status` (Ubuntu). Depois de mudar configurações, reinicie o sistema
(Windows: reinicie o computador ou `sisferias.cmd servico parar` e `sisferias.cmd servico iniciar`;
Ubuntu: `sudo systemctl restart sisferias`).

### 3.5 Acessar

**O sistema funciona sozinho, como serviço.** Depois de instalado, não é preciso deixar nada aberto nem
abrir nada para funcionar em rede. O serviço liga junto com o computador (mesmo antes de alguém entrar no
Windows) e roda em segundo plano, sem janela. O atalho **SISFERIAS** só abre o navegador na tela de entrada:
fechar o navegador não desliga o sistema.

- **No próprio servidor:** abra <https://localhost:3000>.
- **Nos outros computadores da rede:** use o **nome ou o IP do servidor**, e não `localhost`
  (em outro computador, `localhost` é o próprio computador). Exemplo: `https://192.168.0.15:3000`.
  - Para descobrir o IP no Windows: tecla Windows → `cmd` → `ipconfig` → **Endereço IPv4** do adaptador
    em uso (Wi-Fi ou Ethernet). No Ubuntu: `hostname -I`. O instalador do Ubuntu também mostra o endereço no final.
  - Digite o endereço completo, com **`https://`** e **`:3000`**.

**Para os outros computadores conseguirem acessar:**
- O servidor precisa estar **ligado e conectado à rede**. Se ele desligar, hibernar ou entrar em suspensão,
  o sistema sai do ar até ele voltar. No Windows, em **Configurações → Sistema → Energia → Tela e suspensão**,
  ponha **"Nunca"** em "Colocar o dispositivo em suspensão".
- No Windows, a rede do servidor deve estar como **rede de domínio** ou **rede privada**. Em rede "pública", o
  Windows bloqueia o acesso vindo de outros computadores (Configurações → Rede e Internet → clique na rede →
  "Rede privada").
- O instalador libera a porta 3000 só no firewall do Windows (ou no `ufw`/`firewalld` do Ubuntu). Se a OM usar
  **antivírus ou firewall corporativo**, a Divisão de Informática deve liberar a porta 3000 do servidor na rede interna.

**Conferir se o serviço está funcionando:** no Windows, abra o Prompt de Comando como administrador e execute
`C:\SISFERIAS\sisferias.cmd servico status` (ou procure a tarefa **SISFERIAS** no Agendador de Tarefas,
`taskschd.msc`). No Ubuntu: `systemctl status sisferias`. Para reiniciar: `sisferias.cmd servico parar` e
`sisferias.cmd servico iniciar` (Windows) ou `sudo systemctl restart sisferias` (Ubuntu).

Enquanto o certificado do CTIM não for instalado (seção 12), o navegador mostra o aviso
"conexão não é particular". A conexão já é criptografada; o aviso só indica que o certificado
é provisório. Para removê-lo, siga a seção 12.

Dica: peça à TI um **IP fixo** para o servidor, para que esse endereço não mude.

---

## 4. Primeiro acesso: a conta de administrador inicial

Quando o SISFERIAS inicia **sem nenhum administrador com senha** (instalação nova),
ele cria automaticamente uma conta de administrador:

| Campo | Valor |
|---|---|
| Login | `admin` (ou o e-mail `admin@sisferias.local`) |
| Senha | **Provisória**, gerada ao acaso e mostrada **na janela do servidor** |

A senha também é gravada no arquivo **`data\ADMIN_INICIAL.txt`**, que fica apenas no
computador servidor.

Siga esta sequência:

1. Entre no sistema com o login `admin` e a senha provisória.
2. O sistema pede **imediatamente uma nova senha** (troca obrigatória da senha provisória).
3. **Apague o arquivo `data\ADMIN_INICIAL.txt`.**
4. **Guarde uma cópia do arquivo `data\chave-dados.key`** em local seguro, fora do servidor (seção 8).
5. Em **Segurança → Sistema → Proteção de Dados (LGPD)**, informe o **Encarregado pelo tratamento
   de dados** (o cargo ou a função, não o nome de uma pessoa) e um **contato institucional** (e-mail
   do setor e ramal). Eles aparecem no Aviso de Privacidade do cadastro e do login. Enquanto não
   forem preenchidos, o Painel mostra um alerta.
6. Peça às pessoas que se cadastrem (tela de login → **Cadastre-se**; é preciso marcar a ciência do
   Aviso de Privacidade), ou importe os dados antigos (seção 7).
7. Em **Segurança → Gestão de Contas**, dê **Acesso Administrativo** a quem vai administrar.
8. Opcional: depois que houver outro administrador funcionando, exclua a conta `admin`.

**Vindo da versão 2.x?** Na primeira execução da versão 3, os dados do arquivo antigo
`data\sisferias.db` são **copiados automaticamente** para o PostgreSQL. O arquivo antigo é mantido
como `sisferias.db.migrado-AAAA-MM-DD`. As senhas continuam valendo; quem tiver senha fora da regra
nova (seção 5) terá de trocá-la no próximo acesso.

---

## 5. Senhas e bloqueio de contas (regras da DCTIM)

| Regra | Como funciona |
|---|---|
| **Composição da senha** | Mínimo de **10 caracteres**, com **letra maiúscula, letra minúscula, número e caractere especial** (ex.: `@ # $ %`). Não há tamanho máximo. A tela mostra o que falta enquanto a pessoa digita |
| **Senha provisória** | Senha definida pelo administrador (ou a inicial) é provisória: no primeiro acesso o sistema exige uma senha pessoal antes de liberar qualquer tela |
| **Bloqueio por tentativas** | Após **5 tentativas de senha erradas seguidas**, a conta é **bloqueada**. Só um administrador pode liberar |
| **Mensagem de erro** | A tela de login sempre diz "Usuário e/ou senha inválidos", sem revelar se o usuário existe, se a senha está errada ou se a conta está bloqueada |
| **Guarda da senha** | O sistema não guarda a senha, só um código (hash) que não permite recuperá-la. Por isso ninguém, nem a TI, consegue ver a senha de alguém: só redefini-la |

**Liberar uma conta bloqueada:** **Segurança → Gestão de Contas**. A conta aparece com o aviso
"Conta bloqueada por tentativas inválidas de senha" e o botão **Desbloquear**. Redefinir a senha
também libera a conta.

---

## 6. Quem administra e como funciona a área de Segurança

Existem quatro níveis de conta:

| Nível | O que pode fazer |
|---|---|
| **Usuário** (Acesso Padrão) | Lançar e imprimir as próprias férias, ver avisos, enviar sugestões |
| **Encarregado de setor** (Acesso Administrativo, **Apenas Setor**) | Tudo o que o usuário faz, mais Painel, Diagnóstico, Calendário, Justificativas, Trâmite e relatórios, **somente do efetivo do próprio setor**: corrige lançamentos e NUP e imprime papeletas desse efetivo. **Não entra na área de Segurança**, não muda a própria visão nem o próprio setor, não mexe em contas e senhas, não exporta a base e não vê a auditoria |
| **Direção (consulta)** (Acesso Administrativo, **Visão Global somente leitura**) | Diretor e Vice-Diretor: veem **toda a OM** (Painel, Diagnóstico, Calendário, Justificativas, Trâmite e relatórios), mas **não alteram** lançamentos ou NUP de outras pessoas e **não entram na área de Segurança**. Lançam e imprimem as próprias férias normalmente |
| **Administrador** (Acesso Administrativo, **Visão Global**) | Departamento de Pessoal: tudo, para toda a OM, inclusive a área de **Segurança** (contas, desbloqueio e redefinição de senhas, níveis de visão, prazo, configurações, backups e auditoria) |

Para tornar alguém encarregado: em **Segurança → Gestão de Contas**, mude a conta para
**Acesso Administrativo** (ela começa como **Apenas Setor**). Para a Direção, em **Segurança →
Visibilidade**, clique em **Liberar Todos os Setores** e depois em **Somente consulta (Direção)**.
Só deixe a **Visão Global** sem "somente consulta" para quem administra o sistema (Departamento de Pessoal).

O encarregado e o Departamento de Pessoal editam as férias e imprimem a papeleta de outra pessoa
pelos botões de lápis e impressora de cada militar no **Painel**, ou por **Lançar / editar férias**
no **Diagnóstico**. O sistema não deixa retirar a Visão Global do último administrador que a tem.
O setor do encarregado é o do seu lançamento de férias mais recente; se ele mudar de setor,
o Departamento de Pessoal corrige o lançamento dele.

Ao atualizar de uma versão anterior à 3.0.5, se nenhum administrador tiver Visão Global, o
sistema a concede a todos os administradores existentes, para ninguém perder o acesso. Depois,
o Departamento de Pessoal deixa a Visão Global só para quem deve tê-la.

Sobre a área de Segurança:

- **Senha:** não existe senha única ou compartilhada. Cada administrador entra com a
  **própria senha de login**, que o sistema pede de novo ao abrir a área. Erros aqui também
  contam para o bloqueio da conta.
- **Bloqueio automático:** a área se bloqueia sozinha após **15 minutos sem uso**, e há o
  botão **Bloquear área** para quando o administrador sair de perto do computador.
- **Usuários comuns e encarregados de setor:** não veem a área no menu, e o servidor recusa
  qualquer ação administrativa vinda deles (só o administrador com Visão Global entra).

### Prazo final de lançamento

Em **Segurança → Usuários → Prazo Final de Lançamento** o administrador define a data limite:

- **Para todos:** o prazo fica gravado no servidor e vale para todos os administradores, em qualquer computador.
- **Bloqueio automático:** quando o dia do prazo termina, o sistema bloqueia os lançamentos de **todos** os usuários,
  mesmo que ninguém esteja com a tela aberta. Contas criadas depois disso já nascem bloqueadas.
- **Exceções:** se o administrador liberar alguém manualmente depois do prazo, essa pessoa continua liberada.
- **Remover o prazo:** o botão ao lado da data remove o prazo e libera todos.

### Atualização das telas

As telas buscam os dados mais recentes sozinhas: ao trocar de tela ou de aba na Segurança, ao voltar
para a janela do navegador e a cada 1 minuto. Não é preciso apertar F5 para ver o que outras pessoas lançaram.

### Auditoria e Registro de Operações

| Onde | O que registra |
|---|---|
| **Auditoria Detalhada** | As alterações feitas nas telas (férias, avisos, acessos, senhas, prazo), com o nome de quem fez |
| **Registro de Operações** | **Toda** operação feita no sistema: logins (inclusive os recusados), consultas, gravações, exclusões, exportações e downloads, com usuário, data/hora, computador (IP) e resultado. Pode ser filtrado e exportado em CSV |

Nenhum dos dois pode ser alterado ou apagado pelo sistema: o usuário de banco da aplicação
só tem permissão para **inserir e consultar** esses registros (DCTIMARINST 30-17, item 4.4).

Para **dar ou tirar** o acesso de administrador: **Segurança → Gestão de Contas** →
botão de nível de acesso ao lado do nome.

Proteções contra ficar sem administrador:

- Não é possível rebaixar o **último** administrador.
- O administrador não pode excluir a **própria** conta.

---

## 7. Ninguém consegue entrar como administrador: o que fazer

| Situação | O que acontece / o que fazer |
|---|---|
| Instalação nova, banco vazio | O sistema cria a conta `admin` sozinho (seção 4) |
| Não há nenhum administrador com senha e a conta `admin` não existe | Ao reiniciar, o sistema **recria** a conta `admin` com senha provisória, mostrada na janela |
| A conta `admin` existe, mas foi rebaixada ou está sem senha, e não há outro administrador | A janela do servidor mostra um **aviso em destaque**. Use o comando abaixo |
| O administrador esqueceu a senha ou foi **bloqueado** por tentativas | Outro administrador redefine/desbloqueia em **Gestão de Contas**. Se não houver outro, use o comando abaixo |
| Um usuário comum esqueceu a senha ou foi bloqueado | Um administrador redefine ou clica em **Desbloquear** em **Segurança → Gestão de Contas** |
| Alguém quer trocar a própria senha | Ícone de **chave** no canto superior direito (pede a senha atual) |

### Comandos de recuperação

No **computador servidor** (pode ser com o SISFERIAS ligado). Use o comando de administração
`sisferias` da pasta do sistema (seção 3.4):

| Instalação | Como executar |
|---|---|
| **Windows** | Abra o **Prompt de Comando como administrador**, digite `cd /d C:\SISFERIAS` e use `sisferias.cmd ...` |
| **Ubuntu** | No terminal: `sudo /opt/sisferias/sisferias ...` |

Exemplos (no Ubuntu, troque `sisferias.cmd` por `sudo /opt/sisferias/sisferias`):

```
sisferias.cmd admin --senha NovaSenha@2026
```

Redefine a senha da conta `admin` (provisória: o sistema pede outra no primeiro acesso),
desbloqueia e a torna administradora com Visão Global. Se ela não existir, ele a cria.

```
sisferias.cmd admin --login 12345678 --senha NovaSenha@2026
```

Faz o mesmo para a conta com esse NIP (ou e-mail).

```
sisferias.cmd admin --login 12345678 --desbloquear
```

Só libera a conta bloqueada por tentativas, sem mudar a senha.

A senha informada precisa seguir a regra da seção 5. Os comandos só funcionam **no próprio
servidor**, então quem não tem acesso a esse computador não consegue usá-los.

---

## 8. A chave dos dados (MUITO IMPORTANTE)

Os dados pessoais ficam cifrados com a chave do arquivo **`data\chave-dados.key`**, criada na
primeira execução.

- **Guarde uma cópia desse arquivo fora do servidor** (pen drive guardado em local seguro,
  cofre da Divisão, pasta restrita da TI). **Sem ele, os dados do banco e dos backups não podem
  ser lidos por ninguém.**
- **Não** envie a chave junto com os backups nem por e-mail.
- Se o arquivo for apagado ou trocado, o sistema **não inicia** (para não gravar dados que depois
  não poderiam ser lidos) e mostra como resolver: basta devolver o arquivo original para a pasta `data`.
- Alternativa para a TI: informar a chave na variável de ambiente `SISFERIAS_CHAVE` (README.md).

---

## 9. Trazer dados de outro lugar

Resumo. Os formatos aceitos estão no `README.md`, seção 3.

1. Tenha em mãos o **backup (.json)** de outro servidor SISFERIAS ou os **CSVs** das tabelas.
   Opcionalmente, inclua o CSV de usuários e senhas criptografadas, para manter as senhas.
2. No SISFERIAS: **Segurança → Dados e Backup → Importar Dados**.
3. Selecione todos os arquivos e clique em **Analisar arquivos**. Nada é gravado nessa etapa.
4. Confira o resumo e clique em **Importar**. Um backup é feito antes, automaticamente.

Não envie esses arquivos para o GitHub nem por e-mail aberto, pois contêm dados pessoais.

---

## 10. Backups

| Tipo | Quando |
|---|---|
| **Automático** | Um por dia, enquanto o sistema estiver ligado |
| **Antes de mudanças grandes** | Antes de cada importação e de cada exclusão de usuário |
| **Manual** | **Segurança → Dados e Backup → Criar backup agora** (ou `npm run backup`) |

- **Onde ficam:** pasta `data\backups`, arquivos `sisferias_DATA_motivo.json`. O sistema guarda os 30 mais recentes.
- **Cifrados:** os dados pessoais continuam cifrados dentro do backup. Para restaurá-lo é preciso a
  mesma chave (seção 8).
- **Cópia automática para outro lugar (recomendado):** em **Segurança → Dados e Backup**, no campo
  "Copiar cada backup também para esta pasta", informe uma pasta de rede (ex.: `\\servidor\backups\sisferias`)
  ou outro disco (ex.: `D:\Backups\SISFERIAS`) e clique em **Salvar e testar**. A partir daí, todo backup
  é copiado para lá também, e a tela mostra se a última cópia deu certo.
- **Atenção com o serviço do Windows:** como o serviço roda com a conta do sistema, use o caminho de rede
  completo (`\\servidor\pasta`), não uma letra de unidade mapeada, e peça à TI para liberar a gravação
  na pasta compartilhada para a conta do computador servidor.

### Restaurar um backup

- **Pela tela:** **Segurança → Dados e Backup → Importar Dados**, selecione o arquivo `.json` do backup,
  **Analisar arquivos** → modo **Substituir** → **Importar**.
- **Pelo comando** (no servidor): `npm run restaurar -- data\backups\sisferias_....json`

Antes de restaurar, o sistema faz um backup do estado atual. Os registros de auditoria nunca são apagados.

Para **trocar de computador**: feche o SISFERIAS, copie a pasta inteira (com a `data`, inclusive a
chave) para o novo servidor e execute `iniciar.bat` lá.

---

## 11. Usando um PostgreSQL da TI/CLTI (banco externo)

Em produção, o recomendado é o banco ficar num servidor PostgreSQL administrado pela TI.
Com o **usuário administrador do PostgreSQL** (fornecido pelo DBA), execute no servidor do SISFERIAS:

```
npm run banco -- preparar --url postgres://postgres:SENHA@10.200.0.10:5432/postgres
```

O comando cria o banco `sisferias` e **dois usuários de banco** com senhas aleatórias:

| Usuário de banco | Para quê |
|---|---|
| `sisferias_dono` | Criar e alterar as tabelas (só nas atualizações de versão) |
| `sisferias_app` | O dia a dia do sistema: só lê e grava dados; **não** pode alterar tabelas nem apagar auditoria |

A configuração fica em `data\config.json` (protegido). A senha do administrador do PostgreSQL **não** é guardada.

Se o DBA preferir criar o banco e os usuários ele mesmo:

```
npm run banco -- configurar --url postgres://sisferias_app:SENHA@SERVIDOR:5432/sisferias --dono-url postgres://sisferias_dono:SENHA@SERVIDOR:5432/sisferias
```

Outros comandos: `npm run banco -- status` (qual banco está em uso e quantos registros),
`npm run banco -- embutido` (volta ao banco embutido). Reinicie o SISFERIAS depois de mudar.

Para levar os dados do banco embutido para o externo: faça um backup, configure o banco externo,
reinicie e restaure o backup (seção 10).

---

## 12. Conexão criptografada (HTTPS) e certificado do CTIM

O HTTPS vem **sempre ligado** (DCTIMBOTEC 31/002/2020, item 3.1.b). Na primeira execução o sistema
gera um certificado **provisório**. Na RECIM, o certificado deve ser emitido pelo **CTIM** (item 3.1.c):

1. Peça à TI/CTIM o certificado do servidor (nome e IP do computador do SISFERIAS).
2. Instale com um dos comandos (conforme o formato recebido):

```
npm run https -- ativar --cert C:\certs\sisferias.crt --key C:\certs\sisferias.key
npm run https -- ativar --pfx C:\certs\sisferias.pfx --senha SENHA_DO_PFX
```

3. Reinicie o SISFERIAS. Com o certificado do CTIM, os navegadores da RECIM não mostram aviso.

Enquanto usar o provisório, é possível evitar o aviso instalando o certificado provisório nos computadores:
abra `https://ENDERECO:3000/api/certificado`, salve o arquivo, dê dois cliques → **Instalar certificado** →
**Máquina Local** → **Autoridades de Certificação Raiz Confiáveis**.

O comando `npm run https -- desativar` existe só para quando um **proxy HTTPS da TI** fica na frente do
SISFERIAS; sem isso, desativar viola a norma.

---

## 13. Ambiente de homologação (testes)

A DCTIMARINST 30-17 (item 4.3) exige que testes sejam feitos em **ambiente separado, com dados fictícios**.

1. Instale o SISFERIAS em **outra pasta** (ou outro computador), nunca na mesma `data` da produção.
2. Crie o arquivo `data\config.json` dessa instalação com o conteúdo `{ "ambiente": "homologacao" }`.
   (Se houver as duas instalações no mesmo computador, use também `"port": 3001` e `"database": { "port": 5434 }`.)
3. Inicie e, numa janela de comando nessa pasta, execute `npm run dados-ficticios` para criar 30
   militares fictícios (NIP `99000001` em diante, senha `Teste@2026#`).

Todas as telas desse ambiente mostram a faixa amarela **"Ambiente de homologação — use somente dados fictícios"**.

---

## 14. Uso no dia a dia

- **Instalado pelo instalador (Windows) ou pelo .deb (Ubuntu):** o serviço já está instalado e não há nada a fazer;
  os itens abaixo sobre `instalar-servico.bat` valem para quem usa o pacote `.zip`.
- **Iniciar junto com o Windows, sem janela (recomendado):** dê dois cliques em **`instalar-servico.bat`**
  e confirme a permissão de administrador. O SISFERIAS passa a rodar como serviço:
  - inicia sozinho quando o computador liga, mesmo sem ninguém fazer login;
  - não tem janela para alguém fechar por engano;
  - volta sozinho se parar por algum erro;
  - registra o funcionamento em `data\logs\sisferias.log`.

  Para voltar ao modo com janela, execute **`remover-servico.bat`**.
- **Desligar o sistema:** no modo com janela, feche a janela preta ou pressione `Ctrl + C`
  (o PostgreSQL embutido é desligado junto). No modo serviço, execute `remover-servico.bat` (ou, para só
  parar até o próximo reinício do computador, `runtime\node scripts\servico.js parar` como administrador).
  No Ubuntu: `sudo systemctl stop sisferias` (e `start` para ligar de novo).
- **Trocar a própria senha:** qualquer usuário clica no ícone de **chave**, no canto superior direito,
  ao lado de "Sair". O sistema pede a senha atual e a nova (regra da seção 5).
- **Atualizar para uma versão nova:**
  1. Faça um backup e confira se há cópia da chave (seção 8).
  2. **Com o instalador:** execute o instalador da versão nova (Windows `.exe` ou Ubuntu `.deb`). Ele para o
     serviço, troca os arquivos e inicia de novo, mantendo os dados. Siga para o passo 6.
  3. **Com o pacote .zip:** pare o sistema (feche a janela ou, no modo serviço, execute
     `runtime\node scripts\servico.js parar` como administrador) e extraia o pacote novo por cima da pasta
     atual, **mantendo a pasta `data`**.
  4. Se for código-fonte, execute `atualizar.bat`.
  5. Inicie normalmente (ou `instalar-servico.bat`, no modo serviço). Mudanças no banco de dados são
     aplicadas sozinhas na primeira inicialização.
  6. Confira, no rodapé da tela de login, se aparece a versão nova (ex.: **Versão 3.1.3**).
  7. Leia as novidades da versão no `README.md` (seção "Histórico de versões") e faça os ajustes
     indicados. Vindo da 3.0.0: preencha **Segurança → Sistema → Proteção de Dados (LGPD)** (novidade da 3.0.1).
- **Manter o servidor atualizado:** a OM deve aplicar as atualizações de segurança do Windows/Linux e
  manter o antivírus homologado da MB (DCTIMBOTEC 31/002, item 3.4).

### Relatório em Excel

No **Painel**, o botão verde **Exportar Excel** gera uma planilha com o que está na tela, respeitando os filtros. As abas são:

| Aba | Conteúdo |
|---|---|
| Informações | Janela, ano de direito, filtros usados, data e quem gerou |
| Resumo por setor | Militares, dias de direito, programados, cumpridos, restantes, a planejar e % cumprido, com linha de total |
| Militares | Uma linha por militar, com os mesmos números e a justificativa |
| Parcelas | Uma linha por parcela: início, término, dias, situação e NUP |
| Por mês | De dezembro a novembro: quantos militares estão de férias em cada mês e o % do efetivo |

### Fotos e logo

Pode enviar fotos grandes: o sistema reduz a imagem automaticamente antes de gravar (foto até 400 pixels, logo até 600 pixels). Isso mantém o banco de dados leve.

---

## 15. Perguntas frequentes

**Os dados se apagam com o tempo?**
Não. Ficam no banco PostgreSQL (pasta `data\postgres` no modo embutido) até alguém apagá-los.
Desligar o computador não apaga nada.

**Quantas pessoas podem usar ao mesmo tempo?**
Centenas, sem dificuldade.

**Aparece "A porta 3000 já está em uso".**
O SISFERIAS já está rodando neste computador, provavelmente como serviço. Basta abrir o endereço no
navegador; não é preciso executar o `iniciar.bat`.

**Aparece "Não foi possível iniciar o PostgreSQL na porta 5433".**
Outro programa usa essa porta. Escolha outra em `data\config.json`: `{ "database": { "port": 5440 } }`.

**Aparece "A chave de criptografia dos dados não foi encontrada" ou "não corresponde a este banco".**
O arquivo `data\chave-dados.key` foi apagado ou trocado. Devolva o arquivo original (da sua cópia, seção 8).

**A janela fechou logo ao abrir (pacote .zip ou código-fonte).**
Confira se a pasta `runtime` existe dentro da pasta do sistema (o pacote completo traz o Node.js nela).
No código-fonte, verifique a versão do Node.js: abra o Prompt de Comando e digite `node -v`. Precisa ser
22.13 ou maior.

**O instalador do Windows não abre ou é bloqueado.**
Clique em **Mais informações → Executar assim mesmo**. Se a política da OM bloquear, peça à Divisão de
Informática para executar a instalação (é preciso ser administrador do computador).

**Os outros computadores não abrem o sistema.**
Confira se usam o endereço **"Na rede"** (começando com `https://`), se o servidor está ligado com o
SISFERIAS aberto e se a porta 3000 está liberada no firewall.

**Alguém não consegue entrar, mesmo com a senha certa.**
A conta pode ter sido bloqueada por 5 tentativas erradas, ou não ter senha definida (importação).
Um administrador resolve em **Segurança → Gestão de Contas** (Desbloquear ou Redefinir Senha).

**Aparece "Muitas tentativas a partir deste computador".**
Proteção contra tentativas em massa: aguarde 15 minutos, ou reinicie o SISFERIAS.

**Aparece "Interface não compilada".**
Execute `atualizar.bat` (necessita internet na primeira vez) e depois `iniciar.bat`.
