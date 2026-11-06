; Instalador do SISFERIAS para Windows (Inno Setup 6).
;
;   iscc /DVersao=3.1.0 /DOrigem=..\pacote\sisferias instaladores\sisferias.iss
;
; Gerado automaticamente pelo GitHub a cada versão (workflow "Instaladores").
; - Instala em C:\SISFERIAS o sistema com o Node.js e o PostgreSQL embutidos
;   (nada para instalar antes, sem internet).
; - Instala o serviço (inicia com o Windows), libera a porta no firewall e cria
;   os atalhos "SISFERIAS" (abre o sistema no navegador).
; - Ao final mostra a senha provisória do administrador (primeira instalação).
; - Atualizar: execute o instalador da versão nova; os dados são mantidos.
; - O desinstalador remove o serviço e os arquivos do sistema, mas NÃO apaga a
;   pasta C:\SISFERIAS\data (banco, backups e chave de criptografia).

#ifndef Versao
  #define Versao "0.0.0"
#endif
#ifndef Origem
  #define Origem "..\pacote\sisferias"
#endif
#define Porta "3000"

[Setup]
AppId={{8C1B6E3A-5F2D-4C1A-9E7B-3D2F1A0B9C11}
AppName=SISFERIAS
AppVersion={#Versao}
AppVerName=SISFERIAS {#Versao}
AppPublisher=Marinha do Brasil
AppComments=Sistema de planejamento e controle de férias (rede interna)
DefaultDirName=C:\SISFERIAS
DisableProgramGroupPage=yes
DefaultGroupName=SISFERIAS
UsePreviousAppDir=yes
OutputDir=.
OutputBaseFilename=sisferias-v{#Versao}-instalador-windows
Compression=lzma2/max
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
WizardStyle=modern
; Mostra a tela de boas-vindas (com o logo e o mascote), que o Inno Setup 6 pula por padrão.
DisableWelcomePage=no
; Identidade visual: logo e mascote do SISFERIAS (várias escalas para telas de alta resolução).
WizardImageFile=marca\instalador-grande-0.bmp,marca\instalador-grande-1.bmp,marca\instalador-grande-2.bmp,marca\instalador-grande-3.bmp,marca\instalador-grande-4.bmp
WizardSmallImageFile=marca\instalador-pequena-0.bmp,marca\instalador-pequena-1.bmp,marca\instalador-pequena-2.bmp,marca\instalador-pequena-3.bmp,marca\instalador-pequena-4.bmp
WizardImageStretch=no
SetupIconFile=marca\sisferias.ico
UninstallDisplayIcon={app}\sisferias.ico
CloseApplications=no
UninstallDisplayName=SISFERIAS
SetupLogging=yes

[Languages]
Name: "pt"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Tasks]
Name: "atalho"; Description: "Criar atalho do SISFERIAS na área de trabalho"

[Files]
Source: "{#Origem}\*"; DestDir: "{app}"; Excludes: "\data,\data\*,*.sh,\sisferias"; Flags: recursesubdirs createallsubdirs ignoreversion
Source: "marca\sisferias.ico"; DestDir: "{app}"; Flags: ignoreversion

[INI]
Filename: "{app}\SISFERIAS.url"; Section: "InternetShortcut"; Key: "URL"; String: "https://localhost:{#Porta}"

[Icons]
Name: "{group}\SISFERIAS"; Filename: "{app}\SISFERIAS.url"; IconFilename: "{app}\sisferias.ico"
Name: "{group}\Pasta do SISFERIAS"; Filename: "{app}"
Name: "{group}\Manual do Usuário"; Filename: "{app}\Manual_do_Usuario_SISFERIAS.pdf"
Name: "{group}\Guia de instalação"; Filename: "{app}\INSTALACAO.md"
Name: "{group}\Desinstalar o SISFERIAS"; Filename: "{uninstallexe}"
Name: "{autodesktop}\SISFERIAS"; Filename: "{app}\SISFERIAS.url"; IconFilename: "{app}\sisferias.ico"; Tasks: atalho

[Run]
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall delete rule name=""SISFERIAS"""; Flags: runhidden; StatusMsg: "Liberando a porta {#Porta} no firewall do Windows..."
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall add rule name=""SISFERIAS"" dir=in action=allow protocol=TCP localport={#Porta}"; Flags: runhidden; StatusMsg: "Liberando a porta {#Porta} no firewall do Windows..."
Filename: "{app}\runtime\node.exe"; Parameters: """{app}\scripts\servico.js"" instalar"; WorkingDir: "{app}"; Flags: runhidden waituntilterminated; StatusMsg: "Instalando o serviço e iniciando o SISFERIAS. Na primeira vez o banco de dados é criado e isso pode levar até 2 minutos..."
Filename: "{win}\notepad.exe"; Parameters: """{app}\data\ADMIN_INICIAL.txt"""; Description: "Ver a senha provisória do administrador (primeiro acesso)"; Flags: postinstall skipifsilent nowait; Check: ArquivoAdminExiste
Filename: "{app}\SISFERIAS.url"; Description: "Abrir o SISFERIAS no navegador"; Flags: postinstall shellexec skipifsilent nowait
Filename: "{app}\Manual_do_Usuario_SISFERIAS.pdf"; Description: "Abrir o Manual do Usuário"; Flags: postinstall shellexec skipifsilent nowait unchecked

[UninstallRun]
Filename: "{app}\runtime\node.exe"; Parameters: """{app}\scripts\servico.js"" remover"; WorkingDir: "{app}"; Flags: runhidden waituntilterminated; RunOnceId: "RemoverServico"
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall delete rule name=""SISFERIAS"""; Flags: runhidden; RunOnceId: "RemoverFirewall"

[UninstallDelete]
Type: files; Name: "{app}\SISFERIAS.url"

[Messages]
pt.FinishedLabel=O SISFERIAS foi instalado e já está funcionando como serviço (inicia junto com o Windows).%n%nNos outros computadores da rede, acesse https://NOME-OU-IP-DESTE-COMPUTADOR:{#Porta}%n%nGUARDE UMA CÓPIA do arquivo C:\SISFERIAS\data\chave-dados.key fora deste computador.

[Code]
{ O sistema apaga o arquivo ao iniciar quando a senha provisória já foi trocada:
  numa atualização a opção só aparece se ela ainda vale. }
function ArquivoAdminExiste: Boolean;
begin
  Result := FileExists(ExpandConstant('{app}\data\ADMIN_INICIAL.txt'));
end;

{ Atualização: para o serviço da versão anterior antes de trocar os arquivos. }
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  Node, Servico: String;
  Codigo: Integer;
begin
  Result := '';
  Servico := ExpandConstant('{app}\scripts\servico.js');
  if FileExists(Servico) then
  begin
    Node := ExpandConstant('{app}\runtime\node.exe');
    if not FileExists(Node) then
      Node := 'node.exe';
    Exec(Node, '"' + Servico + '" parar', ExpandConstant('{app}'), SW_HIDE, ewWaitUntilTerminated, Codigo);
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if (CurUninstallStep = usPostUninstall) and not UninstallSilent then
    MsgBox('O SISFERIAS foi removido. Os dados (banco, backups e chave de criptografia) continuam em ' +
      ExpandConstant('{app}') + '\data. Apague essa pasta somente se não for mais usar o sistema e depois de guardar um backup.',
      mbInformation, MB_OK);
end;
