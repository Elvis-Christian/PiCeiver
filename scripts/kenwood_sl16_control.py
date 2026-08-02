#!/usr/bin/python3
"""Control the Kenwood M-AX7 through the dedicated SL16 USB controller."""

from __future__ import annotations

import argparse
from datetime import datetime
import fcntl
import glob
import json
import os
from pathlib import Path
import sys
import time

import serial


DEFAULT_STATE_FILE = Path("/home/elvis/PiCeiver/runtime/kenwood-state.json")
DEFAULT_LOCK_FILE = Path("/home/elvis/PiCeiver/runtime/kenwood.lock")
DEFAULT_PORT_PATTERNS = ("/dev/serial/by-id/*", "/dev/serial/by-path/*")
BAUD_RATE = 115200

SERIAL_COMMANDS = {
    "on": (b"o", "SEQUENCE_END POWER_ON"),
    "off": (b"f", "SEQUENCE_END POWER_OFF"),
    "2ch": (b"2", "SENT 0xBF70"),
    "4ch": (b"4", "SENT 0xBFF0"),
    "status": (b"s", "STATUS busy="),
}


def utc_timestamp() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def read_state(path: Path) -> dict[str, object]:
    try:
        with path.open(encoding="utf-8") as source:
            value = json.load(source)
        return value if isinstance(value, dict) else {}
    except (OSError, ValueError, json.JSONDecodeError):
        return {}


def write_state(path: Path, state: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    with temporary.open("w", encoding="utf-8") as destination:
        json.dump(state, destination, ensure_ascii=True, separators=(",", ":"))
        destination.write("\n")
    os.replace(temporary, path)


def find_serial_port(explicit: str | None) -> str:
    configured = explicit or os.environ.get("PICEIVER_KENWOOD_SERIAL")
    if configured:
        path = Path(configured)
        if not path.exists():
            raise RuntimeError(f"configured serial port does not exist: {path}")
        return str(path)

    candidates: list[str] = []
    resolved_devices: set[str] = set()
    for pattern in DEFAULT_PORT_PATTERNS:
        for candidate in sorted(glob.glob(pattern)):
            resolved = os.path.realpath(candidate)
            if resolved in resolved_devices:
                continue
            resolved_devices.add(resolved)
            candidates.append(candidate)
    if not candidates:
        raise RuntimeError("Kenwood SL16 serial controller not found")
    if len(candidates) > 1:
        raise RuntimeError(
            "multiple serial devices found; set PICEIVER_KENWOOD_SERIAL: "
            + ", ".join(candidates)
        )
    return candidates[0]


def read_until(connection: serial.Serial, expected: str, timeout: float) -> list[str]:
    deadline = time.monotonic() + timeout
    lines: list[str] = []
    while time.monotonic() < deadline:
        raw = connection.readline()
        if not raw:
            continue
        line = raw.decode("utf-8", errors="replace").strip()
        if not line:
            continue
        lines.append(line)
        if "ABORT" in line:
            raise RuntimeError("controller rejected command: " + " | ".join(lines))
        if expected in line:
            return lines
    raise RuntimeError(
        f"timeout waiting for {expected!r}; controller output: "
        + (" | ".join(lines) if lines else "<none>")
    )


def wait_until_ready(connection: serial.Serial) -> list[str]:
    try:
        return read_until(connection, "KENWOOD_SL16_CONTROLLER_READY", 3.5)
    except RuntimeError:
        connection.write(b"s")
        connection.flush()
        return read_until(connection, "STATUS busy=", 1.5)


def send_serial_command(port: str, operation: str) -> list[str]:
    command, expected = SERIAL_COMMANDS[operation]
    with serial.Serial(
        port=port,
        baudrate=BAUD_RATE,
        timeout=0.1,
        write_timeout=1.0,
        exclusive=True,
    ) as connection:
        wait_until_ready(connection)
        connection.write(command)
        connection.flush()
        return read_until(connection, expected, 4.0)


def resolve_operation(requested: str, state: dict[str, object]) -> str:
    if requested != "toggle":
        return requested
    return "off" if state.get("power") == "on" else "on"


def execute(
    requested: str,
    state_file: Path,
    port: str | None,
    dry_run: bool,
) -> dict[str, object]:
    previous = read_state(state_file)
    operation = resolve_operation(requested, previous)
    selected_port = port or os.environ.get("PICEIVER_KENWOOD_SERIAL")

    if dry_run:
        return {
            "status": "dry-run",
            "requested": requested,
            "operation": operation,
            "previous_power": previous.get("power", "unknown"),
            "port": selected_port or "auto",
        }

    selected_port = find_serial_port(port)
    output = send_serial_command(selected_port, operation)
    result: dict[str, object] = {
        "status": "executed",
        "requested": requested,
        "operation": operation,
        "previous_power": previous.get("power", "unknown"),
        "port": selected_port,
        "controller_output": output,
    }
    if operation in {"on", "off"}:
        updated = {
            **previous,
            "power": operation,
            "mode": "4ch" if operation == "on" else previous.get("mode", "4ch"),
            "confidence": "serial_command_confirmed",
            "updated_at": utc_timestamp(),
            "port": selected_port,
        }
        write_state(state_file, updated)
        result["power"] = operation
        result["mode"] = updated["mode"]
    elif operation in {"2ch", "4ch"}:
        updated = {
            **previous,
            "mode": operation,
            "confidence": "serial_command_confirmed",
            "updated_at": utc_timestamp(),
            "port": selected_port,
        }
        write_state(state_file, updated)
        result["power"] = updated.get("power", "unknown")
        result["mode"] = operation
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("operation", choices=("toggle", *SERIAL_COMMANDS))
    parser.add_argument("--port")
    parser.add_argument("--state-file", type=Path, default=DEFAULT_STATE_FILE)
    parser.add_argument("--lock-file", type=Path, default=DEFAULT_LOCK_FILE)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    args.lock_file.parent.mkdir(parents=True, exist_ok=True)
    with args.lock_file.open("w", encoding="utf-8") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        try:
            result = execute(args.operation, args.state_file, args.port, args.dry_run)
        except Exception as exc:
            print(
                json.dumps(
                    {"operation": args.operation, "status": "error", "error": str(exc)},
                    ensure_ascii=True,
                ),
                file=sys.stderr,
            )
            return 1

    print(json.dumps(result, ensure_ascii=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
