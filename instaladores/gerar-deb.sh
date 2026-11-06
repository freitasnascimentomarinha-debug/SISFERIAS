#!/usr/bin/env bash
# Gera o pacote .deb (Ubuntu/Debian) a partir do pacote Linux pronto.
#
#   instaladores/gerar-deb.sh pacote/sisferias 3.1.0 sisferias_3.1.0_amd64.deb
#
# O .deb instala os arquivos em /opt/sisferias e, ao final (postinst), executa
# o instalar.sh: usuário de sistema, serviço do systemd, firewall e senha inicial.
# A pasta /opt/sisferias/data não faz parte do pacote: remover ou atualizar o
# pacote nunca apaga os dados.
set -euo pipefail
SRC="$1"; VERSAO="$2"; SAIDA="$3"
[ -x "$SRC/runtime/bin/node" ] || { echo "O pacote em $SRC não tem o Node.js embutido (runtime/)."; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/opt/sisferias" "$TMP/DEBIAN"
(cd "$SRC" && tar --exclude=./data -cf - .) | (cd "$TMP/opt/sisferias" && tar -xf -)

# Atalho e ícone para quem usa o Ubuntu com área de trabalho (abre o sistema no navegador).
RAIZ="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$TMP/usr/share/applications" "$TMP/usr/share/icons/hicolor/256x256/apps"
cp "$RAIZ/marca/sisferias.png" "$TMP/usr/share/icons/hicolor/256x256/apps/sisferias.png"
cat > "$TMP/usr/share/applications/sisferias.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=SISFERIAS
Comment=Planejamento e controle de férias
Exec=xdg-open https://localhost:3000
Icon=sisferias
Terminal=false
Categories=Office;
DESKTOP

TAMANHO="$(du -sk "$TMP/opt" "$TMP/usr" | awk '{s+=$1} END {print s}')"
cat > "$TMP/DEBIAN/control" <<CONTROL
Package: sisferias
Version: $VERSAO
Section: misc
Priority: optional
Architecture: amd64
Installed-Size: $TAMANHO
Depends: systemd, passwd
Maintainer: SISFERIAS <sisferias@localhost>
Description: SISFERIAS - planejamento e controle de ferias
 Sistema web para planejamento, lancamento, acompanhamento e impressao das
 ferias do efetivo, para a rede interna. Inclui o Node.js e o banco PostgreSQL;
 instala o servico em /opt/sisferias (dados em /opt/sisferias/data).
CONTROL

cat > "$TMP/DEBIAN/postinst" <<'SCRIPT'
#!/bin/sh
set -e
if [ "$1" = "configure" ]; then
  /opt/sisferias/instalar.sh
fi
SCRIPT

cat > "$TMP/DEBIAN/prerm" <<'SCRIPT'
#!/bin/sh
set -e
case "$1" in
  remove|deconfigure)
    /opt/sisferias/runtime/bin/node /opt/sisferias/scripts/servico.js remover || true ;;
  upgrade)
    systemctl stop sisferias 2>/dev/null || true ;;
esac
SCRIPT

cat > "$TMP/DEBIAN/postrm" <<'SCRIPT'
#!/bin/sh
set -e
if [ "$1" = "remove" ] || [ "$1" = "purge" ]; then
  echo "SISFERIAS removido. Os dados continuam em /opt/sisferias/data (apague manualmente se quiser, depois de guardar um backup e a chave)."
fi
SCRIPT
chmod 755 "$TMP/DEBIAN/postinst" "$TMP/DEBIAN/prerm" "$TMP/DEBIAN/postrm"

dpkg-deb --root-owner-group -Zxz --build "$TMP" "$SAIDA" >/dev/null
echo "Gerado: $SAIDA ($(du -h "$SAIDA" | cut -f1))"
