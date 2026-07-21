#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PRIVATE_DIR="${PICEIVER_PRIVATE_BACKUP_DIR:-$REPO_DIR/backup-private}"

copy_if_readable() {
  local src="$1"
  local dst="$2"
  if [[ -r "$src" ]]; then
    cp -f "$src" "$dst"
    echo "OK   $src"
  else
    echo "SKIP $src (sem permissao de leitura)"
  fi
}

copy_required() {
  local src="$1"
  local dst="$2"
  if [[ -r "$src" ]]; then
    cp -f "$src" "$dst"
    echo "OK   $src"
  else
    echo "FAIL $src (arquivo obrigatorio ausente ou sem leitura)" >&2
    return 1
  fi
}

copy_privileged_if_present() {
  local src="$1"
  local dst="$2"
  if [[ ! -e "$src" ]]; then
    echo "SKIP $src (nao existe)"
  elif [[ -r "$src" ]]; then
    cp -f "$src" "$dst"
    echo "OK   $src"
  elif command -v sudo >/dev/null 2>&1; then
    local tmp
    tmp="$(mktemp "${dst}.tmp.XXXXXX")"
    if sudo cat "$src" > "$tmp"; then
      mv -f "$tmp" "$dst"
      echo "OK   $src (via sudo)"
    else
      rm -f "$tmp"
      echo "FAIL $src (nao foi possivel ler via sudo)" >&2
      return 1
    fi
  else
    echo "FAIL $src (exige privilegios)" >&2
    return 1
  fi
}

mkdir -p \
  "$REPO_DIR/backup-config/camilladsp" \
  "$REPO_DIR/backup-config/nodered" \
  "$REPO_DIR/backup-config/systemd" \
  "$REPO_DIR/backup-config/raspotify" \
  "$REPO_DIR/backup-config/mosquitto/conf.d" \
  "$REPO_DIR/backup-config/alsa" \
  "$REPO_DIR/backup-config/system/modules-load.d" \
  "$REPO_DIR/backup-config/boot" \
  "$PRIVATE_DIR/nodered"

chmod 0700 "$PRIVATE_DIR" "$PRIVATE_DIR/nodered"

copy_required /opt/dspstack/camilladsp/camilladsp.yml "$REPO_DIR/backup-config/camilladsp/camilladsp.yml"
copy_if_readable /home/elvis/camilladsp/statefile.yml "$REPO_DIR/backup-config/camilladsp/statefile.yml"

copy_required /home/elvis/.node-red/flows.json "$REPO_DIR/backup-config/nodered/flows.json"
copy_required /home/elvis/.node-red/settings.js "$REPO_DIR/backup-config/nodered/settings.js"
copy_required /home/elvis/.node-red/package.json "$REPO_DIR/backup-config/nodered/package.json"
copy_if_readable /home/elvis/.node-red/environment "$REPO_DIR/backup-config/nodered/environment"
copy_required /home/elvis/.node-red/.config.nodes.json "$REPO_DIR/backup-config/nodered/config.nodes.json"
copy_required /home/elvis/.node-red/flows_cred.json "$PRIVATE_DIR/nodered/flows_cred.json"
copy_required /home/elvis/.node-red/.config.runtime.json "$PRIVATE_DIR/nodered/config.runtime.json"
chmod 0600 "$PRIVATE_DIR/nodered/flows_cred.json" "$PRIVATE_DIR/nodered/config.runtime.json"

copy_required /etc/systemd/system/camilladsp.service "$REPO_DIR/backup-config/systemd/camilladsp.service"
copy_if_readable /etc/systemd/system/camillagui.service "$REPO_DIR/backup-config/systemd/camillagui.service"
copy_required /etc/systemd/system/toslink-to-loopback.service "$REPO_DIR/backup-config/systemd/toslink-to-loopback.service"
copy_required /lib/systemd/system/nodered.service "$REPO_DIR/backup-config/systemd/nodered.service"
copy_required /lib/systemd/system/raspotify.service "$REPO_DIR/backup-config/systemd/raspotify.service"

copy_if_readable /etc/default/raspotify "$REPO_DIR/backup-config/raspotify/default.raspotify"
copy_required /etc/systemd/system/raspotify.service.d/override.conf "$REPO_DIR/backup-config/raspotify/override.conf"
copy_required /etc/mosquitto/mosquitto.conf "$REPO_DIR/backup-config/mosquitto/mosquitto.conf"
find /etc/mosquitto/conf.d -maxdepth 1 -type f -print0 2>/dev/null | while IFS= read -r -d '' file; do
  copy_if_readable "$file" "$REPO_DIR/backup-config/mosquitto/conf.d/$(basename "$file")"
done

copy_if_readable /etc/logrotate.d/nodered "$REPO_DIR/backup-config/system/logrotate.nodered"
copy_privileged_if_present /etc/sudoers.d/nodered-audio "$REPO_DIR/backup-config/system/sudoers.nodered-audio"
copy_required /etc/modules "$REPO_DIR/backup-config/system/modules"
copy_required /etc/modules-load.d/modules.conf "$REPO_DIR/backup-config/system/modules-load.d/modules.conf"
copy_required /boot/firmware/config.txt "$REPO_DIR/backup-config/boot/config.txt"
copy_required /etc/os-release "$REPO_DIR/backup-config/system/os-release"
copy_if_readable /var/lib/alsa/icusb_spdif.state "$REPO_DIR/backup-config/alsa/icusb_spdif.state"
copy_if_readable /var/lib/alsa/asound.state "$REPO_DIR/backup-config/alsa/asound.state"
copy_required /etc/asound.conf "$REPO_DIR/backup-config/alsa/asound.conf"

services=(camilladsp camillagui mosquitto nodered raspotify toslink-to-loopback)
enabled_tmp="$(mktemp "$REPO_DIR/backup-config/system/enabled-services.txt.tmp.XXXXXX")"
{
  echo "# Gerado por scripts/sync_backup_configs.sh"
  for service in "${services[@]}"; do
    if systemctl is-enabled --quiet "$service"; then
      echo "$service.service"
    fi
  done
} > "$enabled_tmp"
mv -f "$enabled_tmp" "$REPO_DIR/backup-config/system/enabled-services.txt"

packages=(alsa-utils avahi-daemon libasound2t64 mosquitto nodejs raspotify)
versions_tmp="$(mktemp "$REPO_DIR/backup-config/system/software-versions.txt.tmp.XXXXXX")"
{
  echo "# Gerado por scripts/sync_backup_configs.sh"
  sed -n 's/^PRETTY_NAME=//p' /etc/os-release | sed 's/^/os=/'
  printf 'debian_version=' && cat /etc/debian_version
  printf 'architecture=' && dpkg --print-architecture
  for package in "${packages[@]}"; do
    dpkg-query -W -f="${package}=\${Version}\n" "$package"
  done
  if command -v node-red >/dev/null 2>&1; then
    node -p "'node-red=' + require('/usr/lib/node_modules/node-red/package.json').version"
  fi
  if command -v camilladsp >/dev/null 2>&1; then
    camilladsp --version 2>&1 | sed -n '1s/^/camilladsp_raw=/p'
    sha256sum "$(command -v camilladsp)" | awk '{print "camilladsp_sha256=" $1}'
  fi
  if command -v librespot >/dev/null 2>&1; then
    librespot --version 2>&1 | sed -n '1s/^/librespot_raw=/p'
    sha256sum "$(command -v librespot)" | awk '{print "librespot_sha256=" $1}'
  fi
} > "$versions_tmp"
mv -f "$versions_tmp" "$REPO_DIR/backup-config/system/software-versions.txt"

echo "Sincronizacao concluida."
echo "ATENCAO: copie $PRIVATE_DIR para armazenamento externo criptografado."
