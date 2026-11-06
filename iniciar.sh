#!/usr/bin/env sh
# Inicia o SISFERIAS (Linux/macOS). Na primeira vez instala as dependências
# e compila a interface.
set -e
cd "$(dirname "$0")"

# Pacote com o Node.js embutido (pasta runtime): não precisa instalar nada.
[ -x runtime/bin/node ] && PATH="$PWD/runtime/bin:$PATH" && export PATH

if ! command -v node >/dev/null 2>&1; then
  echo "O Node.js não está instalado. Instale a versão LTS (https://nodejs.org) e tente novamente."
  exit 1
fi
if ! node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)"; then
  echo "Versão do Node.js muito antiga ($(node -v)). Instale a LTS mais recente: https://nodejs.org"
  exit 1
fi

if [ ! -d node_modules/pg ]; then
  echo "Instalando dependências (somente na primeira vez)..."
  npm install
fi
if [ ! -f dist/index.html ]; then
  echo "Compilando a interface (somente na primeira vez)..."
  npm run build
fi

exec node server/start.js
