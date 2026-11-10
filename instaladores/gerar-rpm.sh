#!/usr/bin/env bash
# Gera o pacote .rpm do SISFERIAS para Oracle Linux (e Red Hat, Rocky, AlmaLinux) 8 ou 9, x86_64.
#
#   instaladores/gerar-rpm.sh pacote/sisferias 3.1.7 sisferias-3.1.7-1.x86_64.rpm
#
# O primeiro argumento é o pacote completo para Linux (com o Node.js embutido),
# gerado por "npm run pacote -- --plataforma linux". Precisa do rpmbuild
# (no Ubuntu: apt-get install rpm).
#
# Instalar:   sudo dnf install ./sisferias-instalador-oracle-linux.rpm
# Atualizar:  o mesmo comando com o arquivo da versão nova (os dados são mantidos)
# Remover:    sudo dnf remove sisferias   (a pasta /opt/sisferias/data é mantida)
set -euo pipefail
SRC="$1"; VERSAO="$2"; SAIDA="$3"
[ -x "$SRC/runtime/bin/node" ] || { echo "O pacote em $SRC não tem o Node.js embutido (runtime/)."; exit 1; }
command -v rpmbuild >/dev/null || { echo "rpmbuild não encontrado (no Ubuntu: sudo apt-get install rpm)."; exit 1; }

RAIZ="$(cd "$(dirname "$0")" && pwd)"
TOP="$(mktemp -d)"
trap 'rm -rf "$TOP"' EXIT
mkdir -p "$TOP"/{BUILD,RPMS,SOURCES,SPECS,SRPMS}
ARVORE="$TOP/SOURCES/raiz"
mkdir -p "$ARVORE/opt/sisferias" "$ARVORE/usr/share/applications" "$ARVORE/usr/share/icons/hicolor/256x256/apps"
(cd "$SRC" && tar --exclude=./data -cf - .) | (cd "$ARVORE/opt/sisferias" && tar -xf -)

# Atalhos para quem usa o Oracle Linux com área de trabalho (os mesmos do .deb).
cp "$RAIZ/marca/sisferias.png" "$ARVORE/usr/share/icons/hicolor/256x256/apps/sisferias.png"
cat > "$ARVORE/usr/share/applications/sisferias.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=SISFERIAS
Comment=Planejamento e controle de férias
Exec=xdg-open https://localhost:3000
Icon=sisferias
Terminal=false
Categories=Office;
DESKTOP
if [ -f "$SRC/Manual_do_Usuario_SISFERIAS.pdf" ]; then
cat > "$ARVORE/usr/share/applications/sisferias-manual.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Manual do SISFERIAS
Comment=Manual do Usuário do SISFERIAS (PDF)
Exec=xdg-open /opt/sisferias/Manual_do_Usuario_SISFERIAS.pdf
Icon=sisferias
Terminal=false
Categories=Office;
DESKTOP
fi

cat > "$TOP/SPECS/sisferias.spec" <<SPEC
Name:           sisferias
Version:        ${VERSAO}
Release:        1
Summary:        SISFERIAS - planejamento e controle de ferias
License:        Uso interno - Marinha do Brasil
BuildArch:      x86_64
# O Node.js e o PostgreSQL vêm dentro do pacote: nada de dependências automáticas.
AutoReqProv:    no
Requires:       systemd, shadow-utils, tar

# Pacote já compilado: sem "strip", sem pacote de depuração e com compressão xz
# (lida pelo rpm do Oracle Linux 8 e 9).
%global debug_package %{nil}
%global __os_install_post %{nil}
%global _build_id_links none
%global _binary_payload w6.xzdio

%description
Sistema web para planejamento, lancamento, acompanhamento e impressao das
ferias do efetivo, para a rede interna. Inclui o Node.js e o banco PostgreSQL;
instala o servico em /opt/sisferias (dados em /opt/sisferias/data).

%install
mkdir -p %{buildroot}
cp -a %{_sourcedir}/raiz/. %{buildroot}/

%pre
# Atualização: para a versão em execução antes de trocar os arquivos.
if [ "\$1" -ge 2 ]; then
  systemctl stop sisferias 2>/dev/null || true
fi

%posttrans
# No fim da transação (instalação ou atualização): usuário de sistema, serviço,
# firewall e, na primeira vez, a senha provisória do administrador.
/opt/sisferias/instalar.sh

%preun
# Remoção (não atualização): tira o serviço.
if [ "\$1" -eq 0 ]; then
  /opt/sisferias/runtime/bin/node /opt/sisferias/scripts/servico.js remover || true
fi

%postun
if [ "\$1" -eq 0 ]; then
  echo "SISFERIAS removido. Os dados continuam em /opt/sisferias/data (apague manualmente se quiser, depois de guardar um backup e a chave)."
fi

%files
/opt/sisferias
/usr/share/applications/sisferias*.desktop
/usr/share/icons/hicolor/256x256/apps/sisferias.png
SPEC

rpmbuild --quiet --define "_topdir $TOP" -bb "$TOP/SPECS/sisferias.spec"
cp "$TOP"/RPMS/x86_64/sisferias-*.rpm "$SAIDA"
echo "Gerado: $SAIDA ($(du -h "$SAIDA" | cut -f1))"
