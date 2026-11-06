#!/usr/bin/env bash
# Remove o serviço e os arquivos do SISFERIAS do Ubuntu/Linux, MANTENDO os dados
# (/opt/sisferias/data: banco, backups e chave de criptografia).
#
#   sudo ./desinstalar.sh
#
# Para apagar também os dados, apague a pasta /opt/sisferias/data depois de
# guardar um backup e a chave em local seguro.
set -euo pipefail

DEST=/opt/sisferias

if [ "$(id -u)" -ne 0 ]; then
  echo "Execute como administrador: sudo $0"
  exit 1
fi

NODE="$DEST/runtime/bin/node"
[ -x "$NODE" ] || NODE="$(command -v node || true)"
if [ -n "$NODE" ] && [ -f "$DEST/scripts/servico.js" ]; then
  "$NODE" "$DEST/scripts/servico.js" remover || true
else
  systemctl disable --now sisferias.service 2>/dev/null || true
  rm -f /etc/systemd/system/sisferias.service
  systemctl daemon-reload 2>/dev/null || true
fi

if [ -d "$DEST" ]; then
  find "$DEST" -mindepth 1 -maxdepth 1 ! -name data -exec rm -rf {} +
fi

echo "SISFERIAS removido. Os dados continuam em $DEST/data."
