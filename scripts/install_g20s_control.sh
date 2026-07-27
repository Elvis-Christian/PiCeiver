#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UNIT_SOURCE="$REPO_DIR/backup-config/systemd/piceiver-g20s.service"
UNIT_TARGET="/etc/systemd/system/piceiver-g20s.service"

if [[ -e "$UNIT_TARGET" ]]; then
  stamp="$(date +%Y%m%d-%H%M%S)"
  sudo cp -a "$UNIT_TARGET" "$UNIT_TARGET.pre-g20s-$stamp"
  echo "Backup: $UNIT_TARGET.pre-g20s-$stamp"
fi

sudo install -o root -g root -m 0644 "$UNIT_SOURCE" "$UNIT_TARGET"
chmod 0755 "$REPO_DIR/scripts/g20s_control.py" "$REPO_DIR/scripts/piceiver_control.py"
sudo systemctl daemon-reload
sudo systemctl enable piceiver-g20s.service

echo "Instalado sem iniciar. Use o modo dry-run antes de ativar acoes:"
echo "  /usr/bin/python3 $REPO_DIR/scripts/g20s_control.py --dry-run"
