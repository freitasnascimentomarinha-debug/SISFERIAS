#!/usr/bin/env bash
# Instala (ou atualiza) o SISFERIAS no Ubuntu/Linux como serviço do sistema.
#
#   sudo ./instalar.sh
#
# - Copia o sistema para /opt/sisferias (os dados ficam em /opt/sisferias/data
#   e são mantidos nas atualizações).
# - Cria o usuário de sistema "sisferias" (sem login): o serviço e o banco
#   PostgreSQL embutido rodam com ele, nunca como root.
# - Instala o serviço do systemd: liga sozinho com o computador e volta se cair.
# - Libera a porta no firewall (ufw ou firewalld), se estiver ativo.
# - Mostra o endereço de acesso e, na primeira instalação, a senha provisória
#   do administrador.
# Também é usado pelos pacotes .deb e .rpm (já em /opt/sisferias, sem cópia).
set -euo pipefail

DEST=/opt/sisferias
USUARIO=sisferias
SRC="$(cd "$(dirname "$0")" && pwd)"

if [ "$(id -u)" -ne 0 ]; then
  echo "Execute como administrador: sudo $0"
  exit 1
fi
if ! command -v systemctl >/dev/null 2>&1; then
  echo "Este computador não usa o systemd. Use ./iniciar.sh para rodar o SISFERIAS."
  exit 1
fi

echo "== SISFERIAS: instalação em $DEST =="

if ! id -u "$USUARIO" >/dev/null 2>&1; then
  useradd --system --home-dir "$DEST" --no-create-home --shell /usr/sbin/nologin "$USUARIO"
  echo "Usuário de sistema \"$USUARIO\" criado."
fi

if [ "$SRC" != "$DEST" ]; then
  if systemctl is-active --quiet sisferias 2>/dev/null; then
    echo "Parando a versão em execução..."
    systemctl stop sisferias
  fi
  mkdir -p "$DEST"
  # Troca os arquivos do sistema, preservando a pasta de dados.
  find "$DEST" -mindepth 1 -maxdepth 1 ! -name data -exec rm -rf {} +
  (cd "$SRC" && tar --exclude=./data -cf - .) | (cd "$DEST" && tar -xf -)
  echo "Arquivos copiados."
fi

NODE="$DEST/runtime/bin/node"
if [ ! -x "$NODE" ]; then
  NODE="$(command -v node || true)"
  if [ -z "$NODE" ]; then
    echo "Node.js não encontrado. Use o pacote completo (com a pasta runtime) ou instale o Node.js 22 LTS."
    exit 1
  fi
fi

mkdir -p "$DEST/data"
chown -R "$USUARIO:$USUARIO" "$DEST/data"
chmod 750 "$DEST/data"

SISFERIAS_USUARIO="$USUARIO" "$NODE" "$DEST/scripts/servico.js" instalar

PORTA="$(cd "$DEST" && "$NODE" --input-type=module -e "import { config } from './server/config.js'; console.log(config.port)" 2>/dev/null || echo 3000)"
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow "$PORTA/tcp" >/dev/null && echo "Firewall (ufw): porta $PORTA liberada."
elif command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --state >/dev/null 2>&1; then
  firewall-cmd --permanent --add-port="$PORTA/tcp" >/dev/null && firewall-cmd --reload >/dev/null && echo "Firewall (firewalld): porta $PORTA liberada."
fi

# Na primeira instalação o sistema cria o administrador e grava a senha provisória.
ADMIN="$DEST/data/ADMIN_INICIAL.txt"
# Numa atualização o arquivo não é recriado: depois de 20 s com o banco pronto, segue.
for i in $(seq 1 90); do
  [ -f "$ADMIN" ] && break
  if [ "$i" -gt 20 ] && [ -f "$DEST/data/chave-dados.key" ] && [ -d "$DEST/data/postgres" ]; then break; fi
  sleep 1
done

IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo
echo "============================================================"
echo " SISFERIAS instalado."
echo " Acesse pelo navegador: https://${IP:-IP-DO-SERVIDOR}:$PORTA"
echo "                    ou: https://localhost:$PORTA"
if [ -f "$ADMIN" ]; then
  echo
  cat "$ADMIN"
fi
echo
echo " Dados e chave de criptografia: $DEST/data"
echo " GUARDE UMA CÓPIA de $DEST/data/chave-dados.key fora do servidor."
echo " Situação do serviço: systemctl status sisferias"
echo " Registros: journalctl -u sisferias -f"
echo "============================================================"
