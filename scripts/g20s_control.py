#!/usr/bin/env python3
"""Translate G20S PRO Linux input events into PiCeiver semantic actions."""

from __future__ import annotations

import argparse
import glob
import json
import logging
import os
from pathlib import Path
import select
import struct
import subprocess
import time


DEFAULT_CONFIG = Path("/home/elvis/PiCeiver/config/g20s-buttons.json")
CONTROL_SCRIPT = Path("/home/elvis/PiCeiver/scripts/piceiver_control.py")
MQTT_TOPIC = "piceiver/control/action"
DEFAULT_STALE_EVENT_MAX_AGE_SECONDS = 2.0
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
EV_KEY = 1
KEY_RELEASE = 0
KEY_PRESS = 1
KEY_REPEAT = 2
INPUT_EVENT = struct.Struct("@llHHi")


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8").strip()
    except OSError:
        return ""


def find_keyboard(device_name: str, device_uniq: str) -> Path | None:
    for candidate in sorted(glob.glob("/dev/input/event*")):
        event = Path(candidate).name
        base = Path("/sys/class/input") / event / "device"
        if read_text(base / "name") != device_name:
            continue
        uniq = read_text(base / "uniq").lower()
        if device_uniq and uniq != device_uniq.lower():
            continue
        return Path(candidate)
    return None


def publish_event(payload: dict[str, object]) -> None:
    subprocess.run(
        [
            "/usr/bin/mosquitto_pub",
            "-h",
            "127.0.0.1",
            "-q",
            "1",
            "-t",
            MQTT_TOPIC,
            "-m",
            json.dumps(payload, ensure_ascii=True, separators=(",", ":")),
        ],
        check=True,
        timeout=3,
    )


def dispatch(action: str, key_code: int, key_name: str, event: str) -> None:
    if action not in ALLOWED_ACTIONS:
        raise ValueError(f"unsupported action: {action}")
    payload: dict[str, object] = {
        "action": action,
        "origin": "bluetooth",
        "device": "G20S PRO",
        "device_mac": "69:98:98:22:F7:43",
        "key_code": key_code,
        "key_name": key_name,
        "event": event,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
    }
    publish_event(payload)

    completed = subprocess.run(
        [str(CONTROL_SCRIPT), action],
        capture_output=True,
        text=True,
        timeout=25,
    )
    output = (completed.stdout if completed.returncode == 0 else completed.stderr).strip()
    if completed.returncode != 0:
        raise RuntimeError(output or f"control action failed with rc={completed.returncode}")
    logging.info("action=%s result=%s", action, output)


def load_config(path: Path) -> dict[str, object]:
    with path.open(encoding="utf-8") as source:
        config = json.load(source)
    if not isinstance(config.get("buttons"), dict):
        raise ValueError("config.buttons must be an object")
    return config


def listen(config: dict[str, object], dry_run: bool) -> None:
    device_name = str(config.get("device_name", "G20S PRO Keyboard"))
    device_uniq = str(config.get("device_uniq", "69:98:98:22:f7:43"))
    buttons = config["buttons"]
    repeat_interval = float(config.get("repeat_interval_ms", 150)) / 1000.0
    stale_event_max_age = (
        float(config.get("stale_event_max_age_ms", DEFAULT_STALE_EVENT_MAX_AGE_SECONDS * 1000))
        / 1000.0
    )
    pressed_at: dict[int, float] = {}
    repeated_at: dict[int, float] = {}

    while True:
        device = find_keyboard(device_name, device_uniq)
        if device is None:
            logging.warning("G20S keyboard not present; retrying")
            time.sleep(2)
            continue

        logging.info("listening device=%s dry_run=%s", device, dry_run)
        try:
            fd = os.open(device, os.O_RDONLY | os.O_NONBLOCK)
        except OSError as exc:
            logging.error("cannot open %s: %s", device, exc)
            time.sleep(2)
            continue

        try:
            while True:
                ready, _, _ = select.select([fd], [], [], 5)
                if not ready:
                    continue
                data = os.read(fd, INPUT_EVENT.size * 32)
                if not data:
                    raise OSError("input device closed")
                usable = len(data) - (len(data) % INPUT_EVENT.size)
                for offset in range(0, usable, INPUT_EVENT.size):
                    event_sec, event_usec, event_type, code, value = INPUT_EVENT.unpack_from(data, offset)
                    if event_type != EV_KEY:
                        continue

                    binding = buttons.get(str(code))
                    key_name = str(binding.get("key_name", f"KEY_{code}")) if binding else f"KEY_{code}"
                    logging.info("key code=%d name=%s value=%d", code, key_name, value)
                    if binding is None:
                        continue

                    event_time = event_sec + (event_usec / 1_000_000)
                    event_age = time.monotonic() - event_time
                    if event_age > stale_event_max_age:
                        logging.warning(
                            "dropping stale key code=%d name=%s value=%d age=%.3fs",
                            code,
                            key_name,
                            value,
                            event_age,
                        )
                        continue

                    action = str(binding["action"])
                    long_press_seconds = float(binding.get("long_press_seconds", 0))

                    if value == KEY_PRESS:
                        pressed_at[code] = event_time
                        repeated_at[code] = event_time
                        if long_press_seconds:
                            continue
                        event = "press"
                    elif value == KEY_REPEAT:
                        if not binding.get("repeat", False):
                            continue
                        if event_time - repeated_at.get(code, 0) < repeat_interval:
                            continue
                        repeated_at[code] = event_time
                        event = "repeat"
                    elif value == KEY_RELEASE:
                        started = pressed_at.pop(code, event_time)
                        repeated_at.pop(code, None)
                        if long_press_seconds and event_time - started >= long_press_seconds:
                            action = str(binding.get("long_action", action))
                            event = "long_release"
                        elif long_press_seconds and binding.get("short_action"):
                            action = str(binding["short_action"])
                            event = "short_release"
                        elif binding.get("release_action"):
                            action = str(binding["release_action"])
                            event = "release"
                        else:
                            continue
                    else:
                        continue

                    if dry_run:
                        logging.info("dry-run action=%s event=%s", action, event)
                    else:
                        try:
                            dispatch(action, code, key_name, event)
                        except Exception:
                            logging.exception("action failed action=%s", action)
        except OSError as exc:
            logging.warning("input disconnected: %s", exc)
        finally:
            os.close(fd)
        time.sleep(1)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    listen(load_config(args.config), args.dry_run)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
