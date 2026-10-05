#!/bin/sh
# Instala e habilita o monitor de estado da TV Box no systemd.

set -eu

PROJECT_DIR="/home/elvis/PiCeiver"
UNIT_DIR="$PROJECT_DIR/backup-config/systemd"

chmod 0755 "$PROJECT_DIR/scripts/tvbox_status_probe.sh"
sudo install -D -m 0644 "$UNIT_DIR/tvbox-status.service" \
    /etc/systemd/system/tvbox-status.service
sudo install -D -m 0644 "$UNIT_DIR/tvbox-status.timer" \
    /etc/systemd/system/tvbox-status.timer
sudo systemctl daemon-reload
sudo systemctl enable --now tvbox-status.timer
