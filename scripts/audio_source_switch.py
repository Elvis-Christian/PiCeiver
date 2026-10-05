#!/opt/camillagui/.venv/bin/python
"""Switch CamillaDSP between independent TV and Spotify capture paths."""

import json
import os
from pathlib import Path
import subprocess
import sys
import time

import camilladsp


CONFIGS = {
    "tv": Path("/opt/dspstack/camilladsp/camilladsp-tv.yml"),
    "spotify": Path("/opt/dspstack/camilladsp/camilladsp-spotify.yml"),
}
STATE_FILE = Path("/home/elvis/PiCeiver/runtime/audio-source.json")


def connect() -> camilladsp.CamillaClient:
    client = camilladsp.CamillaClient("127.0.0.1", 1234)
    client.connect()
    for _ in range(50):
        if client.is_connected():
            return client
        time.sleep(0.1)
    raise RuntimeError("CamillaDSP API unavailable")


def record_state(source: str) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    temporary = STATE_FILE.with_suffix(".tmp")
    temporary.write_text(
        json.dumps({"source": source, "updated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z")}) + "\n",
        encoding="utf-8",
    )
    os.replace(temporary, STATE_FILE)


def main() -> int:
    if len(sys.argv) != 2 or sys.argv[1] not in ("tv", "spotify", "off"):
        print("usage: audio_source_switch.py {tv|spotify|off}", file=sys.stderr)
        return 2

    source = sys.argv[1]
    client = connect()
    try:
        if source == "off":
            client.volume.set_main_mute(True)
            record_state(source)
            print(json.dumps({"source": source, "state": "muted"}))
            return 0

        # The legacy TOSLINK-to-Loopback process must never hold the USB
        # capture endpoint when CamillaDSP uses the direct TV path.
        subprocess.run(
            ["sudo", "-n", "systemctl", "stop", "toslink-to-loopback.service"],
            check=True,
        )

        config_path = CONFIGS[source]
        config = client.config.read_and_parse_file(str(config_path))
        client.config.validate(config)

        client.volume.set_main_mute(True)
        client.config.set_active(config)
        client.config.set_file_path(str(config_path))
        time.sleep(0.8)
        client.volume.set_main_mute(False)

        record_state(source)
        print(
            json.dumps(
                {
                    "source": source,
                    "state": str(client.general.state()),
                    "config": str(config_path),
                }
            )
        )
        return 0
    finally:
        client.disconnect()


if __name__ == "__main__":
    raise SystemExit(main())
