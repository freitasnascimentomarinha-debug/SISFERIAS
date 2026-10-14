#!/usr/bin/env sh
# Atualiza dependências e recompila a interface após baixar uma versão nova.
# Os dados (pasta data/) não são alterados.
set -e
cd "$(dirname "$0")"
npm install
npm run build
echo "Atualização concluída. Execute ./iniciar.sh"
