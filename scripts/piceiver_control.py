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
KENWOOD_HELPER = Path("/home/elvis/PiCeiver/scripts/kenwood_sl16_control.py")
KENWOOD_RELAY_SETTLE_SECONDS = 1.5
VOLUME_STEP_DB = 2.0
MIN_VOLUME_DB = -80.0
MAX_VOLUME_DB = 0.0
LFE_FADER = 1  # Aux1; dedicated Volume filter on output channel 3.
LFE_FILTER = "lfe_remote_trim"
LFE_LEVELS_DB = (-5.0, 0.0, 5.0)

ALLOWED_ACTIONS = {
    "volume_up",
    "volume_down",
    "toggle_mute",
    "cycle_lfe",
    "select_tv",
    "select_spotify",
    "power_off",
    "toggle_amplifier_power",
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


def require_lfe_filter(config: dict) -> None:
    filters = config.get("filters", {})
    trim = filters.get(LFE_FILTER, {})
    parameters = trim.get("parameters", {})
    if (trim.get("type") != "Volume" or parameters.get("fader") != "Aux1"
            or parameters.get("limit") != 5.0):
        raise RuntimeError("LFE Aux1 filter is not active")
    pipeline = config.get("pipeline", [])
    assignments = [
        (index, step) for index, step in enumerate(pipeline)
        if step.get("type") == "Filter" and LFE_FILTER in step.get("names", [])
        and step.get("bypassed") is not True
    ]
    if len(assignments) != 1 or assignments[0][1].get("channels") != [3]:
        raise RuntimeError("LFE Aux1 filter is not exclusive to output 3")
    limiter = filters.get("lfe_limiter", {})
    limit_steps = [
        index for index, step in enumerate(pipeline)
        if step.get("type") == "Filter" and "lfe_limiter" in step.get("names", [])
        and step.get("channels") == [3] and step.get("bypassed") is not True
    ]
    if (limiter.get("type") != "Limiter" or limiter.get("parameters", {}).get("clip_limit", 0) > -1.0
            or len(limit_steps) != 1 or limit_steps[0] <= assignments[0][0]):
        raise RuntimeError("LFE peak limiter must follow Aux1 trim")
    for name, definition in filters.items():
        if name != LFE_FILTER and definition.get("type") == "Volume" and definition.get("parameters", {}).get("fader") == "Aux1":
            raise RuntimeError("Aux1 is also used by another filter")


def cycle_lfe() -> dict[str, object]:
    client = connect()
    try:
        require_lfe_filter(client.config.active() or {})
        previous_mute = bool(client.volume.mute(LFE_FADER))
        previous_db = float(client.volume.volume(LFE_FADER))
        if previous_mute:
            level_db = LFE_LEVELS_DB[0]
            client.volume.set_volume(LFE_FADER, level_db)
            client.volume.set_mute(LFE_FADER, False)
            state = "-5 dB"
        elif abs(previous_db - LFE_LEVELS_DB[0]) < 0.1:
            level_db = LFE_LEVELS_DB[1]
            client.volume.set_volume(LFE_FADER, level_db)
            state = "0 dB"
        elif abs(previous_db - LFE_LEVELS_DB[1]) < 0.1:
            level_db = LFE_LEVELS_DB[2]
            client.volume.set_volume(LFE_FADER, level_db)
            state = "+5 dB"
        else:
            client.volume.set_mute(LFE_FADER, True)
            level_db = previous_db
            state = "mudo"
        actual_mute = bool(client.volume.mute(LFE_FADER))
        actual_db = float(client.volume.volume(LFE_FADER))
        if actual_mute != (state == "mudo") or (not actual_mute and abs(actual_db - level_db) > 0.1):
            raise RuntimeError("LFE did not reach the requested state")
        return {"status": "executed", "lfe_state": state, "lfe_volume_db": actual_db, "lfe_muted": actual_mute}
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


def set_main_mute(muted: bool) -> None:
    client = connect()
    try:
        client.volume.set_main_mute(muted)
    finally:
        client.disconnect()


def toggle_amplifier_power() -> dict[str, object]:
    set_main_mute(True)

    completed = subprocess.run(
        ["/usr/bin/python3", str(KENWOOD_HELPER), "toggle"],
        capture_output=True,
        text=True,
        timeout=15,
    )
    if completed.returncode != 0:
        raise RuntimeError(completed.stderr.strip() or "Kenwood helper failed")
    result = json.loads(completed.stdout)
    power = str(result.get("power", "unknown"))

    if power == "on":
        time.sleep(KENWOOD_RELAY_SETTLE_SECONDS)
        set_main_mute(False)
        camilladsp_muted = False
    elif power != "off":
        raise RuntimeError(f"unexpected Kenwood power state: {power}")
    else:
        camilladsp_muted = True

    result["camilladsp_muted"] = camilladsp_muted
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
    if action == "cycle_lfe":
        return cycle_lfe()
    if action == "select_tv":
        return select_source("tv")
    if action == "select_spotify":
        return select_source("spotify")
    if action == "power_off":
        return select_source("off")
    if action == "toggle_amplifier_power":
        return toggle_amplifier_power()
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
