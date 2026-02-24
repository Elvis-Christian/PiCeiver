#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

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

mkdir -p \
  "$REPO_DIR/backup-config/camilladsp" \
  "$REPO_DIR/backup-config/nodered" \
  "$REPO_DIR/backup-config/systemd" \
  "$REPO_DIR/backup-config/raspotify" \
  "$REPO_DIR/backup-config/alsa" \
  "$REPO_DIR/backup-config/system"

copy_if_readable /opt/dspstack/camilladsp/camilladsp.yml "$REPO_DIR/backup-config/camilladsp/camilladsp.yml"
copy_if_readable /home/elvis/camilladsp/statefile.yml "$REPO_DIR/backup-config/camilladsp/statefile.yml"

copy_if_readable /home/elvis/.node-red/flows.json "$REPO_DIR/backup-config/nodered/flows.json"
copy_if_readable /home/elvis/.node-red/flows_cred.json "$REPO_DIR/backup-config/nodered/flows_cred.json"
copy_if_readable /home/elvis/.node-red/settings.js "$REPO_DIR/backup-config/nodered/settings.js"
copy_if_readable /home/elvis/.node-red/package.json "$REPO_DIR/backup-config/nodered/package.json"
copy_if_readable /home/elvis/.node-red/environment "$REPO_DIR/backup-config/nodered/environment"
copy_if_readable /home/elvis/.node-red/.config.nodes.json "$REPO_DIR/backup-config/nodered/config.nodes.json"
copy_if_readable /home/elvis/.node-red/.config.runtime.json "$REPO_DIR/backup-config/nodered/config.runtime.json"

copy_if_readable /etc/systemd/system/camilladsp.service "$REPO_DIR/backup-config/systemd/camilladsp.service"
copy_if_readable /etc/systemd/system/camillagui.service "$REPO_DIR/backup-config/systemd/camillagui.service"
copy_if_readable /etc/systemd/system/toslink-to-loopback.service "$REPO_DIR/backup-config/systemd/toslink-to-loopback.service"
copy_if_readable /lib/systemd/system/nodered.service "$REPO_DIR/backup-config/systemd/nodered.service"
copy_if_readable /lib/systemd/system/raspotify.service "$REPO_DIR/backup-config/systemd/raspotify.service"

copy_if_readable /etc/default/raspotify "$REPO_DIR/backup-config/raspotify/default.raspotify"
copy_if_readable /etc/logrotate.d/nodered "$REPO_DIR/backup-config/system/logrotate.nodered"
copy_if_readable /etc/sudoers.d/nodered-audio "$REPO_DIR/backup-config/system/sudoers.nodered-audio"
copy_if_readable /var/lib/alsa/icusb_spdif.state "$REPO_DIR/backup-config/alsa/icusb_spdif.state"
copy_if_readable /var/lib/alsa/asound.state "$REPO_DIR/backup-config/alsa/asound.state"
copy_if_readable /etc/asound.conf "$REPO_DIR/backup-config/alsa/asound.conf"

echo "Sincronizacao concluida."
