#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PRIVATE_DIR="${PICEIVER_PRIVATE_BACKUP_DIR:-$REPO_DIR/backup-private}"
APPLY=false
INCLUDE_BOOT=false

usage() {
  cat <<'EOF'
Uso:
  ./scripts/restore_backup_configs.sh [--apply] [--include-boot]

Sem --apply, apenas mostra o que seria restaurado.
--apply exige root, preserva os arquivos atuais e nao reinicia servicos.
--include-boot inclui /boot/firmware/config.txt e exige revisao manual previa.
EOF
}

for arg in "$@"; do
  case "$arg" in
    --apply) APPLY=true ;;
    --include-boot) INCLUDE_BOOT=true ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Argumento desconhecido: $arg" >&2; usage >&2; exit 2 ;;
  esac
done

if "$APPLY" && [[ "$EUID" -ne 0 ]]; then
  echo "Use sudo somente depois de revisar o dry-run." >&2
  exit 1
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
safety_dir="/var/backups/piceiver-restore/$timestamp"

restore_source() {
  local source="$1"
  local destination="$2"
  local mode="$3"
  local owner="$4"
  local group="$5"

  if [[ ! -f "$source" ]]; then
    echo "SKIP  $source (snapshot ausente)"
    return
  fi

  if ! "$APPLY"; then
    echo "DRY   $source -> $destination ($owner:$group $mode)"
    return
  fi

  if [[ -e "$destination" ]]; then
    mkdir -p "$safety_dir$(dirname "$destination")"
    cp -a "$destination" "$safety_dir$destination"
  fi

  install -D -m "$mode" -o "$owner" -g "$group" "$source" "$destination"
  echo "OK    $destination"
}

restore_file() {
  local relative="$1"
  shift
  restore_source "$REPO_DIR/$relative" "$@"
}

echo "PiCeiver restore"
echo "Repositorio: $REPO_DIR"
if "$APPLY"; then
  echo "Backup preventivo: $safety_dir"
else
  echo "Modo: simulacao; nenhum arquivo sera alterado"
fi

restore_file backup-config/camilladsp/camilladsp.yml /opt/dspstack/camilladsp/camilladsp.yml 0644 elvis audio
restore_file backup-config/camilladsp/statefile.yml /home/elvis/camilladsp/statefile.yml 0644 elvis audio

restore_file backup-config/nodered/flows.json /home/elvis/.node-red/flows.json 0644 elvis elvis
restore_file backup-config/nodered/settings.js /home/elvis/.node-red/settings.js 0644 elvis elvis
restore_file backup-config/nodered/package.json /home/elvis/.node-red/package.json 0644 elvis elvis
restore_file backup-config/nodered/environment /home/elvis/.node-red/environment 0600 elvis elvis
restore_file backup-config/nodered/config.nodes.json /home/elvis/.node-red/.config.nodes.json 0600 elvis elvis

if [[ -f "$PRIVATE_DIR/nodered/flows_cred.json" && -f "$PRIVATE_DIR/nodered/config.runtime.json" ]]; then
  restore_source "$PRIVATE_DIR/nodered/flows_cred.json" /home/elvis/.node-red/flows_cred.json 0600 elvis elvis
  restore_source "$PRIVATE_DIR/nodered/config.runtime.json" /home/elvis/.node-red/.config.runtime.json 0600 elvis elvis
else
  echo "WARN  backup privado do Node-RED ausente; credenciais nao serao restauradas"
fi

restore_file backup-config/alsa/asound.conf /etc/asound.conf 0644 root root
restore_file backup-config/alsa/asound.state /var/lib/alsa/asound.state 0644 root root
restore_file backup-config/alsa/icusb_spdif.state /var/lib/alsa/icusb_spdif.state 0644 root root

restore_file backup-config/systemd/camilladsp.service /etc/systemd/system/camilladsp.service 0644 root root
restore_file backup-config/systemd/toslink-to-loopback.service /etc/systemd/system/toslink-to-loopback.service 0644 root root
restore_file backup-config/systemd/nodered.service /lib/systemd/system/nodered.service 0644 root root

restore_file backup-config/raspotify/default.raspotify /etc/default/raspotify 0644 root root
restore_file backup-config/raspotify/override.conf /etc/systemd/system/raspotify.service.d/override.conf 0644 root root
restore_file backup-config/mosquitto/mosquitto.conf /etc/mosquitto/mosquitto.conf 0644 root root

restore_file backup-config/system/modules /etc/modules 0644 root root
restore_file backup-config/system/modules-load.d/modules.conf /etc/modules-load.d/modules.conf 0644 root root
restore_file backup-config/system/logrotate.nodered /etc/logrotate.d/nodered 0644 root root

sudoers_snapshot="$REPO_DIR/backup-config/system/sudoers.nodered-audio"
if [[ -f "$sudoers_snapshot" ]]; then
  if command -v visudo >/dev/null 2>&1 && ! visudo -cf "$sudoers_snapshot"; then
    echo "FAIL  sudoers invalido; nada sera instalado nesse destino" >&2
    exit 1
  fi
  restore_file backup-config/system/sudoers.nodered-audio /etc/sudoers.d/nodered-audio 0440 root root
else
  echo "WARN  sudoers.nodered-audio nao esta no snapshot"
fi

if "$INCLUDE_BOOT"; then
  restore_file backup-config/boot/config.txt /boot/firmware/config.txt 0644 root root
else
  echo "SKIP  /boot/firmware/config.txt (use --include-boot depois de revisar)"
fi

if "$APPLY"; then
  systemctl daemon-reload
  echo
  echo "Arquivos aplicados. Nenhum servico foi reiniciado ou habilitado."
  echo "Execute scripts/verify_backup_configs.sh e siga o runbook antes do reboot."
else
  echo
  echo "Dry-run concluido. Para aplicar: sudo $0 --apply"
fi
