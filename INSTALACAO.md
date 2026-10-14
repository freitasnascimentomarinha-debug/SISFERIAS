# SISFERIAS — Guia de Instalação e Funcionamento

Este guia explica, passo a passo, como instalar o SISFERIAS em um computador da rede
interna, como funciona o primeiro acesso, quem pode administrar o sistema e o que
fazer se ninguém conseguir entrar.

> Informações técnicas para a equipe de TI estão no arquivo `README.md`.

---

## 1. Como o sistema funciona

- **Servidor:** o SISFERIAS fica instalado em **um único computador**. Esse computador
  precisa estar ligado e com o SISFERIAS aberto enquanto as pessoas usam o sistema.
- **Demais computadores:** acessam pelo **navegador** (Edge, Chrome, Firefox), digitando
  o endereço do servidor. Neles não se instala nada.
- **Dados:** todos ficam guardados em um único arquivo dentro do servidor:
  `data\sisferias.db`. Não é preciso instalar banco de dados.
- **Internet:** não é necessária para usar o sistema, apenas a rede interna.

```
  Computador A ─┐
  Computador B ─┼──(rede interna)──▶  SERVIDOR (SISFERIAS + arquivo de dados)
  Computador C ─┘
```

---

## 2. O que é preciso

| Item | Detalhe |
|---|---|
| Um computador para ser o servidor | Windows 10/11 ou Linux, ligado durante o expediente |
| Node.js versão 22.13 ou mais nova | Gratuito: <https://nodejs.org> (botão "LTS") |
| Rede interna | Os demais computadores precisam enxergar o servidor |

---

## 3. Instalação no Windows (passo a passo)

### Passo 1 — Instalar o Node.js (uma única vez)

1. Acesse <https://nodejs.org> e baixe a versão **LTS**.
2. Execute o instalador e clique em **Próximo** até concluir, mantendo as opções padrão.

Se o servidor não tiver internet, baixe o instalador em outro computador e leve-o por pen drive.

### Passo 2 — Baixar o SISFERIAS

Use uma das formas abaixo:

| Forma | Quando usar | Como |
|---|---|---|
| **Pacote pronto** (recomendado) | Sempre que possível. Não precisa de internet na instalação | No GitHub do projeto, página **Releases**, baixe `sisferias-vX.Y.Z.zip` |
| **Código-fonte** | Quando não houver pacote publicado | No GitHub, botão verde **Code → Download ZIP**. A primeira execução precisa de internet |

### Passo 3 — Extrair

Extraia o `.zip` em uma pasta **fixa**, por exemplo `C:\SISFERIAS`.
Não rode de dentro do `.zip` nem da pasta Downloads.

### Passo 4 — Iniciar

Dê dois cliques em **`iniciar.bat`**. Uma janela preta abrirá.

- Na primeira vez, se for o código-fonte, ela instala os componentes e prepara a
  interface. Isso leva de 1 a 3 minutos.
- Quando aparecer a mensagem abaixo, o sistema está funcionando:

```
SISFERIAS em execução.
  Neste computador:  http://localhost:3000
  Na rede:           http://192.168.0.15:3000
```

**Não feche essa janela.** Fechá-la desliga o sistema. Ela pode ficar minimizada.

### Passo 5 — Liberar no Firewall

Na primeira execução o Windows pode perguntar se permite o acesso pela rede.
Marque **Redes privadas** e clique em **Permitir acesso**.

Se não perguntar e os outros computadores não conseguirem abrir o sistema, peça à TI
para liberar a **porta TCP 3000** para conexões de entrada.

### Passo 6 — Acessar

- **No próprio servidor:** abra <http://localhost:3000>.
- **Nos outros computadores:** abra o endereço mostrado em **"Na rede"**
  (exemplo: `http://192.168.0.15:3000`).

Dica: peça à TI um **IP fixo** para o servidor, para que esse endereço não mude.

---

## 4. Primeiro acesso: a conta de administrador inicial

Quando o SISFERIAS inicia **sem nenhum administrador com senha** (instalação nova),
ele cria automaticamente uma conta de administrador:

| Campo | Valor |
|---|---|
| Login | `admin` (ou o e-mail `admin@sisferias.local`) |
| Senha | Gerada ao acaso e mostrada **na janela do servidor** |

A senha também é gravada no arquivo **`data\ADMIN_INICIAL.txt`**, que fica apenas no
computador servidor.

Siga esta sequência:

1. Entre no sistema com o login `admin` e a senha da janela ou do arquivo.
2. Clique em **Segurança** no menu e confirme a mesma senha.
3. Vá em **Sistema → Alterar Minha Senha** e defina uma senha nova.
4. **Apague o arquivo `data\ADMIN_INICIAL.txt`.**
5. Peça às pessoas que se cadastrem (tela de login → **Cadastre-se**), ou importe os dados
   antigos (seção 7).
6. Em **Segurança → Gestão de Contas**, dê **Acesso Administrativo** a quem vai administrar.
7. Opcional: depois que houver outro administrador funcionando, exclua a conta `admin`.

Quer escolher a senha inicial em vez de usar uma aleatória? Antes do primeiro
`iniciar.bat`, abra o Prompt de Comando na pasta e execute:

```
set ADMIN_PASSWORD=SuaSenhaInicial
iniciar.bat
```

---

## 5. Quem administra e como funciona a área de Segurança

Existem dois níveis de conta:

| Nível | O que pode fazer |
|---|---|
| **Usuário** (Acesso Padrão) | Lançar e imprimir as próprias férias, ver avisos, enviar sugestões |
| **Administrador** (Acesso Administrativo) | Tudo o que o usuário faz, mais Painel, Calendário, Justificativas, Trâmite e a área de **Segurança** |

Sobre a área de Segurança:

- **Senha:** não existe senha única ou compartilhada. Cada administrador entra com a
  **própria senha de login**, que o sistema pede de novo ao abrir a área.
- **Bloqueio automático:** a área se bloqueia sozinha após **15 minutos sem uso**, e há o
  botão **Bloquear área** para quando o administrador sair de perto do computador.
- **Auditoria:** toda entrada na área e toda tentativa com senha errada ficam registradas em
  **Auditoria Detalhada**, com o nome de quem tentou.
- **Usuários comuns:** não veem a área no menu, e o servidor recusa qualquer ação
  administrativa vinda deles.

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

### Auditoria

Toda ação fica registrada com o **nome de quem a fez**, inclusive entre vários administradores.

Para **dar ou tirar** o acesso de administrador: **Segurança → Gestão de Contas** →
botão de nível de acesso ao lado do nome.

Proteções contra ficar sem administrador:

- Não é possível rebaixar o **último** administrador.
- O administrador não pode excluir a **própria** conta.

---

## 6. Ninguém consegue entrar como administrador: o que fazer

| Situação | O que acontece / o que fazer |
|---|---|
| Instalação nova, banco vazio | O sistema cria a conta `admin` sozinho (seção 4) |
| Não há nenhum administrador com senha e a conta `admin` não existe | Ao reiniciar, o sistema **recria** a conta `admin` com senha nova, mostrada na janela |
| A conta `admin` existe, mas foi rebaixada ou está sem senha, e não há outro administrador | A janela do servidor mostra um **aviso em destaque**. Use o comando abaixo |
| O administrador esqueceu a senha | Outro administrador redefine em **Gestão de Contas**. Se não houver outro, use o comando abaixo |
| Um usuário comum esqueceu a senha | Um administrador redefine em **Segurança → Gestão de Contas** |
| Alguém quer trocar a própria senha | Ícone de **chave** no canto superior direito (pede a senha atual) |

### Comando de recuperação

No **computador servidor**:

1. Feche a janela do SISFERIAS.
2. Abra a pasta do SISFERIAS no Explorador de Arquivos, clique na barra de endereço,
   digite `cmd` e pressione Enter.
3. Execute um dos comandos:

```
npm run admin -- --senha NOVA_SENHA
```

Esse primeiro comando redefine a senha da conta `admin` e a torna administradora. Se
ela não existir, ele a cria.

```
npm run admin -- --login 12345678 --senha NOVA_SENHA
```

Esse segundo faz o mesmo para a conta com esse NIP (ou e-mail).

4. Inicie de novo com `iniciar.bat` e entre com a nova senha.

O comando só funciona **no próprio servidor**, então quem não tem acesso a esse computador
não consegue usá-lo.

---

## 7. Trazer dados de outro lugar

Resumo. Os formatos aceitos estão no `README.md`, seção 3.

1. Tenha em mãos o **backup completo (.json)** de outro servidor SISFERIAS ou os **CSVs** das tabelas.
   Opcionalmente, inclua o CSV de usuários e senhas criptografadas, para manter as senhas.
2. No SISFERIAS: **Segurança → Dados e Backup → Importar Dados**.
3. Selecione todos os arquivos e clique em **Analisar arquivos**. Nada é gravado nessa etapa.
4. Confira o resumo e clique em **Importar**. Um backup é feito antes, automaticamente.

Não envie esses CSVs para o GitHub nem por e-mail aberto, pois contêm dados pessoais.

---

## 8. Backups

| Tipo | Quando |
|---|---|
| **Automático** | Um por dia, enquanto o sistema estiver aberto |
| **Antes de mudanças grandes** | Antes de cada importação e de cada exclusão de usuário |
| **Manual** | **Segurança → Dados e Backup → Criar backup agora** |

- **Onde ficam:** pasta `data\backups`. O sistema guarda os 30 mais recentes.
- **Cópia automática para outro lugar (recomendado):** em **Segurança → Dados e Backup**, no campo
  "Copiar cada backup também para esta pasta", informe uma pasta de rede (ex.: `\\servidor\backups\sisferias`)
  ou outro disco (ex.: `D:\Backups\SISFERIAS`) e clique em **Salvar e testar**. A partir daí, todo backup
  é copiado para lá também, e a tela mostra se a última cópia deu certo. Se o disco do servidor falhar,
  essas cópias salvam os dados.
- **Atenção com o serviço do Windows:** como o serviço roda com a conta do sistema, use o caminho de rede
  completo (`\\servidor\pasta`), não uma letra de unidade mapeada, e peça à TI para liberar a gravação
  na pasta compartilhada para a conta do computador servidor.

Para **trocar de computador**: feche o SISFERIAS, copie a pasta inteira (com a `data`) para o
novo servidor e execute `iniciar.bat` lá.

---

## 9. Uso no dia a dia

- **Iniciar junto com o Windows, sem janela (recomendado):** dê dois cliques em **`instalar-servico.bat`**
  e confirme a permissão de administrador. O SISFERIAS passa a rodar como serviço:
  - inicia sozinho quando o computador liga, mesmo sem ninguém fazer login;
  - não tem janela para alguém fechar por engano;
  - volta sozinho se parar por algum erro;
  - registra o funcionamento em `data\logs\sisferias.log`.

  Para voltar ao modo com janela, execute **`remover-servico.bat`**.
- **Desligar o sistema:** no modo com janela, feche a janela preta ou pressione `Ctrl + C`.
  No modo serviço, execute `remover-servico.bat` (ou, para só parar até o próximo
  reinício do computador, `node scripts\servico.js parar` como administrador).
- **Trocar a própria senha:** qualquer usuário clica no ícone de **chave**, no canto superior direito,
  ao lado de "Sair". O sistema pede a senha atual e a nova (mínimo de **6 caracteres**).
- **Atualizar para uma versão nova:**
  1. Faça um backup.
  2. Substitua os arquivos do sistema **mantendo a pasta `data`**.
  3. Se for código-fonte, execute `atualizar.bat`.
  4. Inicie normalmente.

---

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

Pode enviar fotos direto do celular, mesmo grandes: o sistema reduz a imagem automaticamente antes de gravar (foto até 400 pixels, logo até 600 pixels). Isso mantém o banco de dados leve.

### Conexão criptografada (HTTPS)

Se a TI pedir conexão criptografada, o procedimento está no `README.md`, seção "Conexão criptografada (HTTPS)". O comando é `npm run https -- ativar`, e depois é preciso reiniciar o SISFERIAS. O endereço passa a começar com `https://`.

---

## 10. Perguntas frequentes

**Os dados se apagam com o tempo?**
Não. Ficam no arquivo `data\sisferias.db` até alguém apagá-lo. Desligar o computador não
apaga nada.

**Quantas pessoas podem usar ao mesmo tempo?**
Centenas, sem dificuldade.

**Aparece "A porta 3000 já está em uso".**
O SISFERIAS já está rodando neste computador, provavelmente como serviço. Basta abrir o endereço no
navegador; não é preciso executar o `iniciar.bat`.

**A janela fechou logo ao abrir.**
Verifique a versão do Node.js: abra o Prompt de Comando e digite `node -v`. Precisa ser
22.13 ou maior.

**Os outros computadores não abrem o sistema.**
Confira se usam o endereço **"Na rede"** mostrado na janela, se o servidor está ligado com o
SISFERIAS aberto e se a porta 3000 está liberada no firewall.

**Aparece "Esta conta ainda não tem senha definida".**
A conta veio de uma importação sem senha. Um administrador deve definir a senha em
**Segurança → Gestão de Contas**.

**Aparece "Muitas tentativas".**
Aguarde 15 minutos, ou reinicie o SISFERIAS.

**Aparece "Interface não compilada".**
Execute `atualizar.bat` (necessita internet na primeira vez) e depois `iniciar.bat`.
