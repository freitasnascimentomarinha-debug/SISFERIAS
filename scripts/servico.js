// Instala o SISFERIAS como serviço: inicia junto com o computador, sem janela,
// e volta sozinho se parar.
//
//   node scripts/servico.js instalar | remover | iniciar | parar | status
//   (acrescente --simular para só mostrar o que seria feito)
//
// Windows: tarefa do Agendador de Tarefas executada como SISTEMA na
//          inicialização (criada por XML para não ter limite de 3 dias).
// Linux:   unidade do systemd (/etc/systemd/system/sisferias.service).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NAME = 'SISFERIAS';
const START = path.join(ROOT, 'server', 'start.js');
const NODE = process.execPath;
const PORT = Number(process.env.PORT) || 3000;
const args = process.argv.slice(2);
const command = args.find(a => !a.startsWith('--')) || 'status';
const SIMULATE = args.includes('--simular');
// SISFERIAS_PLATAFORMA permite simular a instalação de outro sistema (testes).
const isWindows = (process.env.SISFERIAS_PLATAFORMA || process.platform) === 'win32';

function run(cmd, cmdArgs, { ignoreError = false } = {}) {
  if (SIMULATE) {
    console.log(`[simulação] ${cmd} ${cmdArgs.map(a => (/\s/.test(a) ? `"${a}"` : a)).join(' ')}`);
    return '';
  }
  try {
    return execFileSync(cmd, cmdArgs, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    if (ignoreError) return '';
    const detail = (err.stderr || err.stdout || err.message || '').toString().trim();
    throw new Error(`${cmd} falhou: ${detail}`);
  }
}

function checkHealth() {
  return new Promise(resolve => {
    const req = http.get({ host: '127.0.0.1', port: PORT, path: '/api/health', timeout: 3000 }, res => {
      resolve(res.statusCode === 200);
      res.resume();
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

async function waitHealth(seconds = 20) {
  for (let i = 0; i < seconds; i += 1) {
    if (await checkHealth()) return true;
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

function ensureBuilt() {
  if (!fs.existsSync(path.join(ROOT, 'dist', 'index.html'))) {
    throw new Error('A interface ainda não foi compilada. Execute "npm run build" (ou iniciar.bat uma vez) antes de instalar o serviço.');
  }
}

// ---------------------------------------------------------------------------
// Windows
// ---------------------------------------------------------------------------

const xmlEscape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function windowsTaskXml() {
  return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>SISFERIAS - sistema de ferias (servidor da rede interna). Pasta: ${xmlEscape(ROOT)}</Description>
  </RegistrationInfo>
  <Triggers>
    <BootTrigger>
      <Enabled>true</Enabled>
      <Delay>PT30S</Delay>
    </BootTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>S-1-5-18</UserId>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>7</Priority>
    <RestartOnFailure>
      <Interval>PT1M</Interval>
      <Count>999</Count>
    </RestartOnFailure>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>"${xmlEscape(NODE)}"</Command>
      <Arguments>"${xmlEscape(START)}" servico</Arguments>
      <WorkingDirectory>${xmlEscape(ROOT)}</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
`;
}

function windowsIsAdmin() {
  if (SIMULATE) return true;
  try { execFileSync('net', ['session'], { stdio: 'ignore' }); return true; } catch { return false; }
}

/** Encerra os processos node do SISFERIAS desta pasta (serviço e servidor). */
function windowsKillProcesses() {
  const pattern = START.replace(/'/g, "''");
  run('powershell', ['-NoProfile', '-Command',
    `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*${pattern}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`,
  ], { ignoreError: true });
}

const windows = {
  async instalar() {
    if (!windowsIsAdmin()) throw new Error('Execute como administrador (clique com o botão direito em instalar-servico.bat > Executar como administrador).');
    ensureBuilt();
    const xmlFile = path.join(os.tmpdir(), `sisferias-tarefa-${Date.now()}.xml`);
    if (SIMULATE) {
      console.log(`[simulação] XML da tarefa:\n${windowsTaskXml()}`);
    } else {
      // O Agendador de Tarefas lê o XML em UTF-16 com marca de ordem de bytes.
      fs.writeFileSync(xmlFile, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(windowsTaskXml(), 'utf16le')]));
    }
    try {
      run('schtasks', ['/Create', '/TN', NAME, '/XML', xmlFile, '/F']);
    } finally {
      fs.rmSync(xmlFile, { force: true });
    }
    windowsKillProcesses(); // encerra uma instância antiga, se houver
    run('schtasks', ['/Run', '/TN', NAME]);
    console.log('Serviço instalado: o SISFERIAS vai iniciar sozinho sempre que o computador ligar.');
    if (!SIMULATE) {
      console.log(await waitHealth() ? `Funcionando em http://localhost:${PORT}` : 'Ainda iniciando... confira em alguns segundos com "status" ou no log data\\logs\\sisferias.log.');
    }
  },
  async remover() {
    if (!windowsIsAdmin()) throw new Error('Execute como administrador.');
    run('schtasks', ['/End', '/TN', NAME], { ignoreError: true });
    windowsKillProcesses();
    run('schtasks', ['/Delete', '/TN', NAME, '/F'], { ignoreError: true });
    console.log('Serviço removido. Para usar o sistema, execute iniciar.bat.');
  },
  async iniciar() {
    run('schtasks', ['/Run', '/TN', NAME]);
    console.log('Serviço iniciado.');
  },
  async parar() {
    if (!windowsIsAdmin()) throw new Error('Execute como administrador.');
    run('schtasks', ['/End', '/TN', NAME], { ignoreError: true });
    windowsKillProcesses();
    console.log('Serviço parado (volta a iniciar quando o computador ligar).');
  },
  async status() {
    const info = run('schtasks', ['/Query', '/TN', NAME, '/FO', 'LIST'], { ignoreError: true });
    console.log(info ? `Tarefa ${NAME} instalada.` : `Serviço não instalado.`);
  },
};

// ---------------------------------------------------------------------------
// Linux (systemd)
// ---------------------------------------------------------------------------

const UNIT_FILE = `/etc/systemd/system/${NAME.toLowerCase()}.service`;

export function systemdUnit(user = process.env.SUDO_USER || os.userInfo().username) {
  return `[Unit]
Description=SISFERIAS - sistema de férias (rede interna)
After=network.target

[Service]
Type=simple
User=${user}
WorkingDirectory=${ROOT}
ExecStart="${NODE}" "${START}"
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
`;
}

const linux = {
  async instalar() {
    if (!SIMULATE && process.getuid && process.getuid() !== 0) throw new Error('Execute com sudo: sudo node scripts/servico.js instalar');
    ensureBuilt();
    if (SIMULATE) console.log(`[simulação] ${UNIT_FILE}:\n${systemdUnit()}`);
    else fs.writeFileSync(UNIT_FILE, systemdUnit());
    run('systemctl', ['daemon-reload']);
    run('systemctl', ['enable', '--now', `${NAME.toLowerCase()}.service`]);
    console.log('Serviço instalado e iniciado (systemd). Logs: journalctl -u sisferias -f');
    if (!SIMULATE) console.log(await waitHealth() ? `Funcionando em http://localhost:${PORT}` : 'Ainda iniciando... confira com "systemctl status sisferias".');
  },
  async remover() {
    run('systemctl', ['disable', '--now', `${NAME.toLowerCase()}.service`], { ignoreError: true });
    if (!SIMULATE) fs.rmSync(UNIT_FILE, { force: true });
    run('systemctl', ['daemon-reload'], { ignoreError: true });
    console.log('Serviço removido.');
  },
  async iniciar() { run('systemctl', ['start', `${NAME.toLowerCase()}.service`]); console.log('Serviço iniciado.'); },
  async parar() { run('systemctl', ['stop', `${NAME.toLowerCase()}.service`]); console.log('Serviço parado.'); },
  async status() { console.log(run('systemctl', ['status', `${NAME.toLowerCase()}.service`, '--no-pager'], { ignoreError: true }) || 'Serviço não instalado.'); },
};

// ---------------------------------------------------------------------------

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const impl = isWindows ? windows : linux;
  if (!impl[command]) {
    console.error('Uso: node scripts/servico.js instalar | remover | iniciar | parar | status  [--simular]');
    process.exit(1);
  }
  try {
    await impl[command]();
    if (command === 'status' && !SIMULATE) {
      console.log(await checkHealth() ? `Respondendo em http://localhost:${PORT}` : `Não está respondendo em http://localhost:${PORT}`);
    }
  } catch (err) {
    console.error(`\nErro: ${err.message}\n`);
    process.exitCode = 1;
  }
}
