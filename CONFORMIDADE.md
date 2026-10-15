# SISFERIAS — Conformidade com as normas da DCTIM

Este documento relaciona cada requisito das normas da DCTIM com a forma como o SISFERIAS
(versão 3) o atende, onde verificar e o que ainda depende da OM. Serve de apoio ao
**Relatório de Homologação** e aos formulários exigidos na solicitação.

Normas consideradas:

| Norma | Assunto |
|---|---|
| **DCTIMARINST 33-06B** | Conformidade, Homologação e Hospedagem de Sistemas Digitais na MB |
| **DCTIMBOTEC 31/002/2020** | Recomendações e Requisitos Mínimos de Segurança da Informação para Sistemas Digitais |
| **DCTIMBOTEC 30/002/2023** | Padronização de tecnologias, linguagens e ferramentas para desenvolvimento de SD |
| **DCTIMARINST 30-17** | Adequação dos SD e Bancos de Dados à proteção de Dados Pessoais (LGPD) |

Legenda: ✅ atendido pelo sistema · 📄 depende de documento/ação da OM · ⚠️ observação

---

## 1. Correções das falhas apontadas pela Divisão de Informática (out/2026)

| Falha (versão original, hospedada na Vercel) | Situação na versão 3 |
|---|---|
| Senha administrativa fixa `admin1234` guardada no navegador (`pages/Security.tsx`) | ✅ Removida. Não há senha fixa no código. A área de Segurança só abre para administradores, que confirmam a **própria** senha no servidor (expira em 15 min sem uso, registrado na auditoria) |
| Banco Supabase sem RLS: tabelas legíveis com a chave pública | ✅ Supabase removido. O navegador nunca acessa o banco: todo acesso passa pelo servidor, que confere sessão, perfil, setor e dono de cada registro. Banco PostgreSQL só aceita conexões locais (embutido) ou do servidor do SISFERIAS (externo) |
| `GEMINI_API_KEY` embutida no JavaScript (`vite.config.ts`) | ✅ Removida. Não há chave de API nem integração externa no código |
| Hospedagem pública (`vercel.app`), fora da infraestrutura da MB | ✅ Dependências de Vercel e Supabase removidas. O sistema roda somente na rede interna, sem acesso à internet |

---

## 2. DCTIMBOTEC 30/002/2023 — tecnologias padronizadas

| Requisito (Tabela 1 — uso obrigatório) | SISFERIAS | Situação |
|---|---|---|
| Linguagem de programação (SDA): Java, PHP, Python ou **JavaScript** | JavaScript (Node.js 22 no servidor; React 19 na interface) | ✅ |
| SGBD relacional: **PostgreSQL** ou Oracle (CD-MB) | **PostgreSQL 17** (embutido) ou PostgreSQL externo (CLTI) | ✅ |
| Controle de versão: **Git**/GitLab/SVN | Git (repositório GitHub, migrável para o GitLab da MB) | ✅ |
| IDE: Eclipse, Netbeans ou **VSCode** | VSCode | ✅ |
| Contêineres (opcional): **Docker** / Kubernetes | `Dockerfile` e `docker-compose.yml` (SISFERIAS + PostgreSQL) | ✅ |

| Recomendação (Tabela 3 e item 3.2) | SISFERIAS | Situação |
|---|---|---|
| Front-end: **React**, Angular ou Vue.js | React | ✅ |
| Arquitetura em camadas | Interface (React) · API (Express) · acesso a dados (`server/db.js`) · banco | ✅ |
| SOA: lógica de negócio em API **REST**, intercâmbio em **JSON** | API REST em `/api`, JSON | ✅ |
| Testes automatizados (Tabela 2: JUnit/PHPUnit/PyUnit, Selenium) | Testes de API com `node:test` (equivalente para JavaScript) e testes de navegador com Playwright (equivalente ao Selenium) | ✅ |
| Integração contínua | GitHub Actions (testes, compilação, tipos e Docker a cada envio) | ✅ |
| Login único **SCORE** | Não implementado (recomendação, não obrigação). Pode ser integrado depois, com apoio do CTIM | ⚠️ |
| Software livre (ePING) | Todas as dependências são software livre (MIT/BSD/PostgreSQL License) | ✅ |

---

## 3. DCTIMBOTEC 31/002/2020 — requisitos mínimos de segurança

### 3.1 SD com interface via navegador web

| Item | Requisito | Como o SISFERIAS atende | Onde verificar | Situação |
|---|---|---|---|---|
| 3.1.a | Compatível com os navegadores padronizados da MB | Interface web padrão (testada em Chromium; usa apenas recursos suportados por Edge, Chrome e Firefox atuais) | — | ✅ |
| 3.1.b | **HTTPS** obrigatório; conexões sem criptografia não aceitas | HTTPS **ligado por padrão** (TLS 1.2+), cookie de sessão `Secure` e `HttpOnly`, cabeçalho HSTS. Só pode ser desligado de forma explícita, quando há proxy HTTPS na frente (aviso no log) | `server/index.js`, `server/config.js`; teste "HTTPS é o padrão" | ✅ |
| 3.1.c | Na RECIM, certificado emitido pelo **CTIM** | Aceita o certificado do CTIM em PEM (`--cert/--key`) ou `.pfx/.p12` (`--pfx --senha`): `npm run https -- ativar ...`. Até a emissão, usa certificado provisório (com aviso no log) | `scripts/https.js`, `server/tls.js` | ✅ sistema · 📄 OM solicitar o certificado ao CTIM |
| 3.1.d | Desabilitar cache no cliente (`Cache-Control: no-store`) | Todas as respostas da API e a página principal com `Cache-Control: no-store` e `Pragma: no-cache` | `server/index.js`; teste "3.1.d" | ✅ |
| 3.1.e | `autocomplete="off"` em formulários sensíveis, inclusive login | `autocomplete="off"` em **todos** os formulários e campos da interface (login, cadastro, senhas, férias, papeleta) | teste e2e "formulário e campos com autocomplete=off" | ✅ |
| 3.1.f | Autenticação só por **POST**; GET bloqueado | `POST /api/auth/login`; `GET` responde 405 | teste "3.1.f" | ✅ |
| e-MAG (citado no modelo do DAIS, item 1.6) | Acessibilidade para pessoas com deficiência (WCAG 2.1 níveis A e AA) | Todas as telas verificadas com o **axe-core**, sem violações: contraste mínimo de 4,5:1, rótulos associados aos campos (`lib/a11y.ts`), nome acessível nos botões, textos alternativos, navegação por teclado, idioma `pt-BR` | teste de navegador "t10_acessibilidade" | ✅ |
| Boas práticas | Validação das entradas no servidor (não confiar no navegador) | Regras de senha, imagens (tipo e tamanho), tamanho dos campos de texto e **parcelas de férias** (datas válidas, início antes do término, soma dentro do direito) conferidas na API; consultas ao banco sempre parametrizadas; nenhuma senha ou chave fixa no código | `server/api.js`; teste "servidor valida as parcelas" | ✅ |

### 3.2 Controle de acesso e autenticação

| Item | Requisito | Como o SISFERIAS atende | Situação |
|---|---|---|---|
| 3.2.a | Usuário preferencialmente o **NIP** | Login pelo **NIP**. Também aceita o e-mail funcional, para militares que ainda não sabem/usam o NIP no cadastro e para a conta técnica `admin`. *Justificativa a constar no formulário (Anexo A, item 2)* | ✅ |
| 3.2.b | Senha com maiúsculas, minúsculas, números e especiais, **mínimo 10**, sem máximo | Regra aplicada no **servidor** (cadastro, troca, redefinição, linha de comando) e mostrada na tela com checklist. Sem limite máximo (o SHA-256 prévio elimina o limite de 72 bytes do bcrypt) | ✅ |
| 3.2.c | Senha nunca em claro nem recuperável; hash com o **ID do usuário** (salt); SHA-256/512 sugerido | Guardado apenas `bcrypt(SHA-256(ID do usuário + ":" + senha))`, custo 12, com salt aleatório próprio do bcrypt. Não existe função de leitura/recuperação de senha. *O bcrypt é mais robusto que o SHA-256 puro contra força bruta (é lento de propósito); a norma admite "outro definido pela DE"* | ✅ ⚠️ confirmar aceitação do bcrypt com a DCTIM |
| 3.2.d | Senha padrão só na criação, com **troca obrigatória no 1º acesso** | Senha inicial do `admin`, senhas definidas pelo administrador e pela linha de comando são **provisórias**: o servidor recusa qualquer operação (código `password_change_required`) até a troca, e a tela mostra a troca obrigatória | ✅ |
| 3.2.e | Senha oculta na tela (campo `password`) | Campos `type="password"` (com botão opcional de mostrar no login) | ✅ |
| 3.2.f | Autenticar após preencher tudo; **mensagem genérica** ("Usuário e/ou senha inválidos") | Mensagem única para usuário inexistente, senha errada, conta sem senha ou conta bloqueada. O tempo de resposta também é igualado (evita descobrir contas pelo tempo) | ✅ |
| 3.2.g | **Bloqueio** da conta após tentativas inválidas seguidas (5 para sistemas não RESERVADOS) | Após **5** erros seguidos a conta é bloqueada (persistente no banco, vale para todos os computadores), as sessões abertas são encerradas e o fato vai para a auditoria. Liberação só por administrador (**Desbloquear**) ou pela linha de comando no servidor. Erros na confirmação de senha da área de Segurança também contam. Há ainda limite por IP (30 erros/15 min) contra tentativas em massa | ✅ |

### 3.3 Informações sensíveis no banco de dados

| Requisito | Como o SISFERIAS atende | Situação |
|---|---|---|
| Camada de proteção adicional: dados sensíveis **cifrados** (AES) | Dados pessoais cifrados pela aplicação com **AES-256-GCM** antes de chegar ao banco (ver inventário na seção 5). A chave (`data/chave-dados.key` ou variável `SISFERIAS_CHAVE`) fica **fora** do banco; nem o DBA nem um backup roubado permitem a leitura. Buscas por NIP/e-mail usam índice cego (HMAC-SHA256). Se a chave for trocada ou perdida, o sistema se recusa a iniciar | ✅ |

### 3.4 Atualização do sistema operacional

| Requisito | Situação |
|---|---|
| Manter SO e softwares do servidor atualizados; antivírus homologado da MB | 📄 Responsabilidade da OM hospedeira. Dependências do SISFERIAS: atualizar com `atualizar.bat` / novas versões. ⚠️ O pacote `node-forge` tem alerta público (GHSA-86w9-cpqp-85rv) sobre **verificação** de assinaturas RSA; o SISFERIAS só o usa para **gerar** o certificado provisório, sem verificar assinaturas, e com o certificado do CTIM ele não é usado |

### 4–6. Varredura, documentação e escopo

| Item | Situação |
|---|---|
| 4 — Varredura de vulnerabilidades pelo CTIM | 📄 Etapa da homologação (após a solicitação formal) |
| 5 — Formulário "Resumo de Definições de SI" (Anexo A) | 📄 A preencher pela OM. Respostas de referência: seção 7 deste documento |

---

## 4. DCTIMARINST 30-17 — proteção de dados pessoais

| Item | Requisito | Como o SISFERIAS atende | Situação |
|---|---|---|---|
| 3 | Privacidade desde a concepção; Formulário LGPD com o DVS; regras no DAIS | Medidas técnicas deste documento; inventário de dados (seção 5) para o formulário | ✅ técnico · 📄 Formulário LGPD, DVS, DAIS, RIPD |
| 4.1 | Limitar dados e privilégios; usuários de banco distintos | Coleta só o necessário para o planejamento e a papeleta de férias. **Dois usuários de banco**: o dono (`sisferias_dono`, só nas migrações) e o da aplicação (`sisferias_app`), que **não** cria/altera/apaga tabelas e **não** altera nem apaga auditoria. Usuários comuns só alteram os próprios lançamentos e **só recebem do servidor os próprios dados pessoais** (dos demais, apenas setor, categoria e datas, sem identificação, para os indicadores gerais); administradores podem ser restritos ao próprio setor | ✅ |
| LGPD art. 9º e 41 | Transparência ao titular; identificação do Encarregado | **Aviso de Privacidade** no login e no cadastro (finalidade, base legal, dados tratados, acesso, segurança, direitos e Encarregado). O cadastro exige a **ciência** do aviso, registrada no Registro de Operações. O Encarregado (cargo, não pessoa) e o contato institucional são configurados por cada OM em Segurança → Sistema, o que permite instalar o sistema em outras OM | ✅ |
| 4.1 | Usuários diferentes para produção e não produção | Cada instalação (produção/homologação) tem seu próprio banco e usuários, com senhas aleatórias próprias | ✅ |
| 4.2 | Inventário de informações pessoais | Seção 5 deste documento | ✅ |
| 4.2 | Plano de Contingência: resposta a incidentes e recuperação de desastres | Apoio técnico: backups diários automáticos (cifrados), cópia para pasta de rede, restauração (`npm run restaurar`), registro de operações para investigação | ✅ técnico · 📄 Plano da OM |
| 4.3 | Ambientes de produção e não produção separados; **dados fictícios** em teste | Configuração `"ambiente": "homologacao"` (faixa de aviso em todas as telas) e gerador de dados fictícios (`npm run dados-ficticios`, recusa rodar fora da homologação). Os testes automatizados usam apenas dados fictícios | ✅ |
| 4.4 | Registrar **todas** as operações, mesmo de usuários autorizados; monitorar | **Registro de Operações**: cada requisição (logins, inclusive recusados; consultas; gravações; exclusões; exportações; downloads), com usuário, data/hora, IP, rota e resultado. Consultas repetidas: no máximo 1 registro por hora por usuário. Usuário, IP e detalhes cifrados. Consulta e exportação em CSV na área de Segurança. O usuário de banco da aplicação só **insere e consulta** (não altera nem apaga). No PostgreSQL embutido, também ficam ligados os logs de conexões e de alterações de estrutura (`log_connections`, `log_statement = 'ddl'`) | ✅ · 📄 rotina de análise periódica pela OM |
| 4.5 | Criptografia dos dados pessoais; pseudonimização; bloqueio/eliminação | Cifragem AES-256-GCM (item 3.3). Eliminação: exclusão de usuário apaga o perfil, os lançamentos e as preferências (com backup antes). Bloqueio: bloqueio de lançamentos por usuário/geral e bloqueio de contas | ✅ |
| 5 | Histórico de incidentes | 📄 OM (o registro de operações e a auditoria apoiam a investigação) |

---

## 5. Inventário de dados pessoais (DCTIMARINST 30-17, item 4.2)

| Dado | Tabela/coluna | Finalidade | Proteção |
|---|---|---|---|
| Nome completo | `profiles.name`, `employees.name` | Identificação no planejamento e na papeleta | Cifrado (AES-256-GCM) |
| Nome de guerra | `profiles.war_name`, `employees.war_name`, `suggestions.war_name` | Identificação | Cifrado |
| NIP | `profiles.nip`, `employees.nip` | Login e identificação | Cifrado + índice cego (HMAC) |
| E-mail funcional | `profiles.email`, `auth_users.email` | Login alternativo | Cifrado + índice cego (HMAC) |
| Senha | `auth_users.password_hash` | Autenticação | Somente hash irreversível (bcrypt) |
| Foto | `employees.photo_url` | Papeleta | Cifrada; reduzida a 400 px |
| Justificativa de férias | `employees.justification` | Controle administrativo | Cifrada |
| Telefone e endereço de férias | `print_preferences.phone`, `.address` | Papeleta (contato durante as férias) | Cifrados |
| Observações da papeleta | `print_preferences.observations` | Papeleta | Cifradas |
| Posto/graduação, categoria, setor, quadro | `profiles`, `employees`, `print_preferences` | Organização e filtros | Não cifrados (dados funcionais, necessários para filtros); acesso controlado |
| Períodos de férias e NUP | `employees.vacation_parcels` | Finalidade principal do sistema | Não cifrados (sem identificação direta: ligados ao militar só pelo ID); acesso controlado |
| Autor e detalhes da auditoria | `audit_logs.user_name`, `.field`, `.old_value`, `.new_value` | Trilha de auditoria | Cifrados; não alteráveis pela aplicação |
| Usuário, IP e detalhes das operações | `operation_log.user_label`, `.ip`, `.detail` | Registro de operações (item 4.4) | Cifrados; não alteráveis pela aplicação |

Retenção: os dados permanecem enquanto o militar tiver conta; a exclusão do usuário apaga
perfil, lançamentos e preferências. Backups: 30 mais recentes (configurável), cifrados.

---

## 6. DCTIMARINST 33-06B — processo de homologação

O processo é da OM (documentos e trâmite); o sistema fornece o que é técnico.

| Fase/atividade | Documento | Situação |
|---|---|---|
| PLA01 — Apresentação da Necessidade | **DVS** (Anexo B) + **Formulário LGPD** (30-17) | 📄 |
| PLA02/PLA03 — Avaliação pela OMREL e Conformidade pela DCTIM | Parecer / mensagem da DCTIM | 📄 |
| OBT — Estratégia de desenvolvimento | **DAIS** (Anexo C); metodologia **MDS-MB-ÁGIL** (sistema de pequeno porte) | 📄 (arquitetura e infraestrutura descritas no `README.md` e neste documento) |
| OBT08–10 — Aceitação | **Termo de Aceitação** (Anexo G) | 📄 |
| OBT11 — Homologação | Solicitação por CE via OMREL com DVS, DAIS, Termo, **documentação do sistema** (`README.md`, `CONFORMIDADE.md`), **manual do usuário** (`INSTALACAO.md`) e **Formulário de SI** (Anexo A da 31/002) | 📄 |
| OBT11 — Ambiente de homologação reproduzindo a produção | Instalação separada com `"ambiente": "homologacao"` e dados fictícios (`INSTALACAO.md`, seção 13) | ✅ |
| OBT11 — Varredura do CTIM e correções | Após a solicitação | 📄 |
| PRO — Hospedagem | CLTI/CD-MB, com PostgreSQL externo (`npm run banco -- preparar`) | 📄 |

---

## 7. Respostas de referência para o Formulário do Anexo A (DCTIMBOTEC 31/002/2020)

| Campo do formulário | Resposta sugerida |
|---|---|
| 1.0 Classificação mais elevada dos dados | **Ostensivo** (dados pessoais protegidos pela LGPD; sem informação sigilosa). Confirmar com o Controlador da OM |
| 2.0 Nome de usuário | Utiliza o **NIP**: Sim. Também aceita o e-mail funcional (justificativa: item 3.2.a acima) |
| 3.0 Exige maiúsculas, minúsculas, números e especiais | **Sim**. Diferencia maiúsculas de minúsculas: **Sim**. Tamanho mínimo **10**, sem máximo |
| 4.0 Armazenamento das senhas | **No banco de dados**. Algoritmo: **bcrypt (custo 12) sobre SHA-256 de (ID do usuário + senha)** |
| 5.0 Bloqueio automático | **Sim**, após **5** tentativas inválidas seguidas |
| 6.0 Protocolos | **HTTPS** (TCP 443 ou porta configurada; padrão 3000). A.C. emitente: **CTIM** (a solicitar) |
| 7.0 Processo de autenticação | Formulário de login (POST, HTTPS) → servidor localiza a conta pelo índice cego do NIP/e-mail → confere o hash → cria sessão com token aleatório de 256 bits em cookie `HttpOnly`/`Secure`/`SameSite=Lax` (o banco guarda só o SHA-256 do token), validade de 7 dias. Área administrativa exige reconfirmação da senha (15 min sem uso). Mensagem genérica de erro; bloqueio após 5 erros |
| 8.0 Recuperação de senhas | **Não há recuperação** (a senha não pode ser lida). O administrador define uma senha provisória, que o usuário é obrigado a trocar no primeiro acesso. Sem administrador disponível, o comando `npm run admin` só funciona no próprio servidor |

---

## 8. Como verificar

| O quê | Como |
|---|---|
| Testes automatizados de API (inclui uma bateria específica "conformidade com as normas da DCTIM") | `npm test` |
| Testes de navegador (inclui a etapa "Normas da DCTIM") | `npm run test:e2e` |
| Banco em uso, usuário de privilégio mínimo e chave | `npm run banco -- status` |
| Dados cifrados | No `psql`: `SELECT name, nip FROM profiles;` → valores começam com `enc:v1:` |
| Privilégio mínimo | Conectado como `sisferias_app`: `DELETE FROM operation_log;` → *permission denied* |
| Registro de operações | Área de Segurança → **Registro de Operações** |
