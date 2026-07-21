#!/usr/bin/env bash
set -uo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PRIVATE_DIR="${PICEIVER_PRIVATE_BACKUP_DIR:-$REPO_DIR/backup-private}"
FAILURES=0
WARNINGS=0

ok() {
  printf 'OK    %s\n' "$1"
}

warn() {
  printf 'WARN  %s\n' "$1" >&2
  WARNINGS=$((WARNINGS + 1))
}

fail() {
  printf 'FAIL  %s\n' "$1" >&2
  FAILURES=$((FAILURES + 1))
}

check_pair() {
  local label="$1"
  local live="$2"
  local backup="$3"
  local required="${4:-required}"

  if [[ ! -e "$backup" ]]; then
    if [[ "$required" == "required" ]]; then
      fail "$label: snapshot ausente ($backup)"
    else
      warn "$label: snapshot opcional ausente ($backup)"
    fi
    return
  fi

  if [[ ! -e "$live" ]]; then
    if [[ "$required" == "required" ]]; then
      fail "$label: arquivo ativo ausente ($live)"
    else
      warn "$label: arquivo ativo opcional ausente ($live)"
    fi
    return
  fi

  if ! [[ -r "$live" ]]; then
    warn "$label: sem permissao para comparar ($live); execute com sudo"
    return
  fi

  if cmp -s "$live" "$backup"; then
    ok "$label"
  else
    fail "$label: ativo e snapshot divergem"
  fi
}

normalized_dropin() {
  sed '/^###Edits below this comment will be discarded/,$d' "$1" |
    awk 'NF { last=NR } { line[NR]=$0 } END { for (i=1; i<=last; i++) print line[i] }'
}

check_dropin() {
  local label="$1"
  local live="$2"
  local backup="$3"

  if [[ ! -r "$live" || ! -r "$backup" ]]; then
    fail "$label: arquivo ausente ou sem leitura"
  elif diff -q <(normalized_dropin "$live") <(normalized_dropin "$backup") >/dev/null; then
    ok "$label (conteudo efetivo)"
  else
    fail "$label: conteudo efetivo diverge"
  fi
}

check_json_pair() {
  local label="$1"
  local live="$2"
  local backup="$3"

  if [[ ! -r "$backup" ]]; then
    warn "$label: backup privado ausente"
  elif [[ ! -r "$live" ]]; then
    warn "$label: arquivo ativo ausente ou sem leitura"
  elif command -v python3 >/dev/null 2>&1; then
    if python3 - "$live" "$backup" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as live_file:
    live = json.load(live_file)
with open(sys.argv[2], encoding="utf-8") as backup_file:
    backup = json.load(backup_file)
raise SystemExit(0 if live == backup else 1)
PY
    then
      ok "$label"
    else
      fail "$label: ativo e backup privado divergem"
    fi
  elif cmp -s "$live" "$backup"; then
    ok "$label"
  else
    fail "$label: divergente; instale python3 para comparacao JSON"
  fi
}

pairs=(
  "CamillaDSP config|/opt/dspstack/camilladsp/camilladsp.yml|backup-config/camilladsp/camilladsp.yml|required"
  "CamillaDSP statefile|/home/elvis/camilladsp/statefile.yml|backup-config/camilladsp/statefile.yml|optional"
  "Node-RED flows|/home/elvis/.node-red/flows.json|backup-config/nodered/flows.json|required"
  "Node-RED settings|/home/elvis/.node-red/settings.js|backup-config/nodered/settings.js|required"
  "Node-RED package|/home/elvis/.node-red/package.json|backup-config/nodered/package.json|required"
  "ALSA config|/etc/asound.conf|backup-config/alsa/asound.conf|required"
  "ALSA mixer state|/var/lib/alsa/asound.state|backup-config/alsa/asound.state|optional"
  "ALSA USB state|/var/lib/alsa/icusb_spdif.state|backup-config/alsa/icusb_spdif.state|optional"
  "CamillaDSP unit|/etc/systemd/system/camilladsp.service|backup-config/systemd/camilladsp.service|required"
  "TOSLINK loopback unit|/etc/systemd/system/toslink-to-loopback.service|backup-config/systemd/toslink-to-loopback.service|required"
  "Node-RED unit|/lib/systemd/system/nodered.service|backup-config/systemd/nodered.service|required"
  "Raspotify unit|/lib/systemd/system/raspotify.service|backup-config/systemd/raspotify.service|required"
  "Raspotify defaults|/etc/default/raspotify|backup-config/raspotify/default.raspotify|optional"
  "Mosquitto config|/etc/mosquitto/mosquitto.conf|backup-config/mosquitto/mosquitto.conf|required"
  "Kernel modules legacy|/etc/modules|backup-config/system/modules|required"
  "Kernel modules load|/etc/modules-load.d/modules.conf|backup-config/system/modules-load.d/modules.conf|required"
  "Boot config|/boot/firmware/config.txt|backup-config/boot/config.txt|required"
  "Node-RED logrotate|/etc/logrotate.d/nodered|backup-config/system/logrotate.nodered|optional"
  "Node-RED sudoers|/etc/sudoers.d/nodered-audio|backup-config/system/sudoers.nodered-audio|optional"
)

for entry in "${pairs[@]}"; do
  IFS='|' read -r label live relative required <<< "$entry"
  check_pair "$label" "$live" "$REPO_DIR/$relative" "$required"
done

check_dropin \
  "Raspotify override" \
  /etc/systemd/system/raspotify.service.d/override.conf \
  "$REPO_DIR/backup-config/raspotify/override.conf"

check_json_pair \
  "Node-RED credentials privadas" \
  /home/elvis/.node-red/flows_cred.json \
  "$PRIVATE_DIR/nodered/flows_cred.json"
check_json_pair \
  "Node-RED segredo de runtime privado" \
  /home/elvis/.node-red/.config.runtime.json \
  "$PRIVATE_DIR/nodered/config.runtime.json"

if command -v python3 >/dev/null 2>&1; then
  if python3 -m json.tool "$REPO_DIR/backup-config/nodered/flows.json" >/dev/null; then
    ok "JSON do Node-RED valido"
  else
    fail "JSON do Node-RED invalido"
  fi

  if [[ -f "$PRIVATE_DIR/nodered/flows_cred.json" && -f "$PRIVATE_DIR/nodered/config.runtime.json" ]]; then
    if python3 -m json.tool "$PRIVATE_DIR/nodered/flows_cred.json" >/dev/null &&
       python3 -m json.tool "$PRIVATE_DIR/nodered/config.runtime.json" >/dev/null; then
      ok "JSON privado do Node-RED valido"
    else
      fail "JSON privado do Node-RED invalido"
    fi
  fi
else
  warn "python3 ausente; JSON do Node-RED nao foi validado"
fi

if command -v systemctl >/dev/null 2>&1; then
  while IFS= read -r service; do
    [[ -z "$service" || "$service" == \#* ]] && continue
    if systemctl is-enabled --quiet "$service"; then
      ok "$service habilitado"
    elif [[ "$service" == "camillagui.service" ]]; then
      warn "$service desabilitado; aceitavel enquanto /opt/camillagui estiver ausente"
    else
      fail "$service nao esta habilitado"
    fi
  done < "$REPO_DIR/backup-config/system/enabled-services.txt"
fi

if command -v sha256sum >/dev/null 2>&1; then
  expected_camilla="$(sed -n 's/^camilladsp_sha256=//p' "$REPO_DIR/backup-config/system/software-versions.txt")"
  expected_librespot="$(sed -n 's/^librespot_sha256=//p' "$REPO_DIR/backup-config/system/software-versions.txt")"
  actual_camilla="$(sha256sum /usr/local/bin/camilladsp 2>/dev/null | awk '{print $1}')"
  actual_librespot="$(sha256sum /usr/bin/librespot 2>/dev/null | awk '{print $1}')"

  [[ -n "$actual_camilla" && "$actual_camilla" == "$expected_camilla" ]] && ok "hash CamillaDSP" || fail "hash CamillaDSP divergente ou binario ausente"
  [[ -n "$actual_librespot" && "$actual_librespot" == "$expected_librespot" ]] && ok "hash librespot" || fail "hash librespot divergente ou binario ausente"
fi

printf '\nResumo: %d falha(s), %d aviso(s).\n' "$FAILURES" "$WARNINGS"
[[ "$FAILURES" -eq 0 ]]
