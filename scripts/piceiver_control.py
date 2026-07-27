#!/opt/camillagui/.venv/bin/python
"""Execute the small, typed set of local PiCeiver control actions."""

from __future__ import annotations

import fcntl
import json
from pathlib import Path
import subprocess
import sys
import time

import camilladsp


CAMILLADSP_HOST = "127.0.0.1"
CAMILLADSP_PORT = 1234
LOCK_FILE = Path("/home/elvis/PiCeiver/runtime/control.lock")
SOURCE_SWITCH = Path("/home/elvis/PiCeiver/scripts/audio_source_switch.py")
VOLUME_STEP_DB = 2.0
MIN_VOLUME_DB = -80.0
MAX_VOLUME_DB = 0.0

ALLOWED_ACTIONS = {
    "volume_up",
    "volume_down",
    "toggle_mute",
    "select_tv",
    "select_spotify",
    "power_off",
    "open_home",
    "navigate_back",
    "navigate_up",
    "navigate_down",
    "navigate_left",
    "navigate_right",
    "confirm",
    "voice_button_pressed",
    "toggle_playback",
    "next_track",
    "previous_track",
}


def connect() -> camilladsp.CamillaClient:
    client = camilladsp.CamillaClient(CAMILLADSP_HOST, CAMILLADSP_PORT)
    client.connect()
    for _ in range(50):
        if client.is_connected():
            return client
        time.sleep(0.1)
    raise RuntimeError("CamillaDSP API unavailable")


def adjust_volume(delta_db: float) -> dict[str, object]:
    client = connect()
    try:
        previous = float(client.volume.main_volume())
        current = max(MIN_VOLUME_DB, min(MAX_VOLUME_DB, previous + delta_db))
        client.volume.set_main_volume(current)
        return {
            "status": "executed",
            "volume_db": current,
            "previous_volume_db": previous,
            "muted": bool(client.volume.main_mute()),
        }
    finally:
        client.disconnect()


def toggle_mute() -> dict[str, object]:
    client = connect()
    try:
        muted = not bool(client.volume.main_mute())
        client.volume.set_main_mute(muted)
        return {
            "status": "executed",
            "muted": muted,
            "volume_db": float(client.volume.main_volume()),
        }
    finally:
        client.disconnect()


def select_source(source: str) -> dict[str, object]:
    completed = subprocess.run(
        [str(SOURCE_SWITCH), source],
        check=True,
        capture_output=True,
        text=True,
        timeout=20,
    )
    result = json.loads(completed.stdout)
    result["status"] = "executed"
    return result


def execute(action: str) -> dict[str, object]:
    if action not in ALLOWED_ACTIONS:
        raise ValueError(f"unsupported action: {action}")
    if action == "volume_up":
        return adjust_volume(VOLUME_STEP_DB)
    if action == "volume_down":
        return adjust_volume(-VOLUME_STEP_DB)
    if action == "toggle_mute":
        return toggle_mute()
    if action == "select_tv":
        return select_source("tv")
    if action == "select_spotify":
        return select_source("spotify")
    if action == "power_off":
        return select_source("off")
    return {"status": "forwarded", "detail": "no local executor"}


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: piceiver_control.py ACTION", file=sys.stderr)
        return 2

    action = sys.argv[1]
    LOCK_FILE.parent.mkdir(parents=True, exist_ok=True)
    with LOCK_FILE.open("w", encoding="utf-8") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        try:
            result = execute(action)
        except Exception as exc:
            print(
                json.dumps(
                    {"action": action, "status": "error", "error": str(exc)},
                    ensure_ascii=True,
                ),
                file=sys.stderr,
            )
            return 1

    print(json.dumps({"action": action, **result}, ensure_ascii=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
