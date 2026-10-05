#!/bin/sh
# Atualiza um unico estado consumivel pelo Node-RED.
# "active" e escolhido quando pelo menos um dos tres ICMP replies chega;
# isso privilegia evitar um falso "inactive" que poderia inverter o toggle
# de energia da TV Box.

set -eu

TVBOX_IP="192.168.178.29"
STATUS_DIR="/home/elvis/PiCeiver/runtime"
STATUS_FILE="$STATUS_DIR/tvbox-status.json"

umask 022
mkdir -p "$STATUS_DIR"

# Tres sondas curtas: confirma ausencia sem manter um ping permanente.
# O ping retorna sucesso se recebeu ao menos uma resposta.
if ping -n -q -c 3 -i 0.2 -W 1 "$TVBOX_IP" >/dev/null 2>&1; then
    status="active"
else
    status="inactive"
fi

checked_at="$(date --iso-8601=seconds)"
tmp_file="$(mktemp "$STATUS_DIR/.tvbox-status.XXXXXX")"

trap 'rm -f "$tmp_file"' EXIT HUP INT TERM
printf '{"status":"%s","checked_at":"%s"}\n' "$status" "$checked_at" > "$tmp_file"
mv -f "$tmp_file" "$STATUS_FILE"
trap - EXIT HUP INT TERM
