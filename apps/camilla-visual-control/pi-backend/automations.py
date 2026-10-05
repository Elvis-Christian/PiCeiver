"""Allowlisted PiCeiver controls for the local automation panel."""

import asyncio
import contextlib
import json
from datetime import datetime
from pathlib import Path

import camilladsp
from aiohttp import web


CONTROL_SCRIPT = "/home/elvis/PiCeiver/scripts/piceiver_control.py"
SOURCE_SCRIPT = "/home/elvis/PiCeiver/scripts/audio_source_switch.py"
AMPLIFIER_SCRIPT = "/home/elvis/PiCeiver/scripts/kenwood_sl16_control.py"
STATE_FILES = {
    "source": Path("/home/elvis/PiCeiver/runtime/audio-source.json"),
    "amplifier": Path("/home/elvis/PiCeiver/runtime/kenwood-state.json"),
    "tvbox": Path("/home/elvis/PiCeiver/runtime/tvbox-status.json"),
}
SERVICES = (
    "camilladsp",
    "camillagui",
    "nodered",
    "mosquitto",
    "raspotify",
    "piceiver-g20s",
    "tvbox-status.timer",
)

ACTIONS = (
    {"id": "source_tv", "label": "TV", "detail": "Entrada TOSLINK direta", "group": "source", "available": True},
    {"id": "source_spotify", "label": "Spotify", "detail": "Spotify Connect via Loopback", "group": "source", "available": True},
    {"id": "source_off", "label": "OFF", "detail": "Silencia o CamillaDSP", "group": "source", "available": True, "confirm": "Silenciar todas as saídas do CamillaDSP?"},
    {"id": "amp_power_toggle", "label": "POWER · Receiver", "detail": "Standby mantém mute; ligar em 4ch desmuta", "group": "amplifier", "available": True},
    {"id": "amp_on", "label": "Ligar · 4ch", "detail": "POWER_ON e término em quatro canais", "group": "amplifier", "available": True},
    {"id": "amp_off", "label": "Standby", "detail": "Desliga somente o Kenwood M-AX7", "group": "amplifier", "available": True, "confirm": "Colocar o amplificador Kenwood em standby?"},
    {"id": "amp_2ch", "label": "2 canais", "detail": "Envia o quadro SL16 0xBF70", "group": "amplifier", "available": True},
    {"id": "amp_4ch", "label": "4 canais", "detail": "Envia o quadro SL16 0xBFF0", "group": "amplifier", "available": True},
    {"id": "amp_status", "label": "Controlador", "detail": "Consulta BUSY e DATA no Arduino", "group": "amplifier", "available": True},
    {"id": "volume_down", "label": "−2 dB", "detail": "Reduz o volume principal", "group": "volume", "available": True},
    {"id": "toggle_mute", "label": "Mute", "detail": "Alterna mute do DSP", "group": "volume", "available": True},
    {"id": "volume_up", "label": "+2 dB", "detail": "Aumenta até o limite de 0 dB", "group": "volume", "available": True},
    {"id": "macro_pc", "label": "PC", "detail": "HDMI1 e preset PC", "group": "planned", "available": False},
    {"id": "macro_tvbox", "label": "TV Box", "detail": "HDMI2 e preset cinema", "group": "planned", "available": False},
    {"id": "macro_satellite", "label": "Satélite", "detail": "Tuner e preset satélite", "group": "planned", "available": False},
    {"id": "macro_switch", "label": "Nintendo Switch", "detail": "HDMI3 e preset jogo", "group": "planned", "available": False},
    {"id": "navigation", "label": "Navegação", "detail": "Setas, OK, voltar e home", "group": "planned", "available": False},
    {"id": "media", "label": "Mídia", "detail": "Play, próxima e anterior", "group": "planned", "available": False},
)

ACTION_MAP = {action["id"]: action for action in ACTIONS}
COMMANDS = {
    "source_tv": (SOURCE_SCRIPT, "tv"),
    "source_spotify": (SOURCE_SCRIPT, "spotify"),
    "source_off": (SOURCE_SCRIPT, "off"),
    "volume_down": (CONTROL_SCRIPT, "volume_down"),
    "toggle_mute": (CONTROL_SCRIPT, "toggle_mute"),
    "volume_up": (CONTROL_SCRIPT, "volume_up"),
    "amp_power_toggle": (CONTROL_SCRIPT, "toggle_amplifier_power"),
    "amp_on": ("/usr/bin/python3", AMPLIFIER_SCRIPT, "on"),
    "amp_off": ("/usr/bin/python3", AMPLIFIER_SCRIPT, "off"),
    "amp_2ch": ("/usr/bin/python3", AMPLIFIER_SCRIPT, "2ch"),
    "amp_4ch": ("/usr/bin/python3", AMPLIFIER_SCRIPT, "4ch"),
    "amp_status": ("/usr/bin/python3", AMPLIFIER_SCRIPT, "status"),
}


def _read_json(path):
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except (OSError, ValueError):
        return {}


def _camilla_snapshot():
    client = camilladsp.CamillaClient("127.0.0.1", 1234)
    try:
        client.connect()
        for _ in range(30):
            if client.is_connected():
                break
            import time
            time.sleep(0.1)
        if not client.is_connected():
            raise RuntimeError("API indisponível")
        state = client.general.state().name
        return {
            "state": state,
            "volume": client.volume.main_volume(),
            "mute": client.volume.main_mute(),
            "clipped": client.status.clipped_samples(),
            "load": client.status.processing_load(),
        }
    except Exception as exc:
        return {"state": "OFFLINE", "error": str(exc)}
    finally:
        with contextlib.suppress(Exception):
            client.disconnect()


def _set_camilla_mute(muted):
    client = camilladsp.CamillaClient("127.0.0.1", 1234)
    try:
        client.connect()
        import time
        for _ in range(30):
            if client.is_connected():
                break
            time.sleep(0.1)
        if not client.is_connected():
            raise RuntimeError("CamillaDSP API indisponível")
        previous = bool(client.volume.main_mute())
        client.volume.set_main_mute(bool(muted))
        return previous
    finally:
        with contextlib.suppress(Exception):
            client.disconnect()


async def _service_snapshot():
    process = await asyncio.create_subprocess_exec(
        "/usr/bin/systemctl", "is-active", *SERVICES,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
    )
    stdout, _ = await process.communicate()
    values = stdout.decode(errors="replace").splitlines()
    return {service: values[index] if index < len(values) else "unknown" for index, service in enumerate(SERVICES)}


async def _run(command):
    process = await asyncio.create_subprocess_exec(
        *command,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=25)
    except asyncio.TimeoutError:
        process.kill()
        await process.wait()
        raise RuntimeError("tempo limite de 25 segundos excedido")
    output = stdout.decode(errors="replace").strip()
    error = stderr.decode(errors="replace").strip()
    if process.returncode != 0:
        raise RuntimeError(error or output or f"comando terminou com código {process.returncode}")
    try:
        return json.loads(output)
    except ValueError:
        return {"output": output}


async def automation_snapshot(request):
    camilla, services = await asyncio.gather(asyncio.to_thread(_camilla_snapshot), _service_snapshot())
    payload = {
        "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "status": {
            "camilladsp": camilla,
            "source": await asyncio.to_thread(_read_json, STATE_FILES["source"]),
            "amplifier": await asyncio.to_thread(_read_json, STATE_FILES["amplifier"]),
            "tvbox": await asyncio.to_thread(_read_json, STATE_FILES["tvbox"]),
            "services": services,
        },
        "actions": ACTIONS,
    }
    return web.json_response(payload, headers={"Cache-Control": "no-store"})


async def execute_automation(request):
    action_id = request.match_info["action"]
    action = ACTION_MAP.get(action_id)
    if not action or not action["available"] or action_id not in COMMANDS:
        raise web.HTTPNotFound(text="Ação indisponível")

    lock = request.app["AUTOMATION_LOCK"]
    if lock.locked():
        raise web.HTTPConflict(text="Outra ação ainda está em execução")

    async with lock:
        previous_mute = None
        try:
            if action_id.startswith("amp_") and action_id not in {"amp_status", "amp_power_toggle"}:
                previous_mute = await asyncio.to_thread(_set_camilla_mute, True)
            result = await _run(COMMANDS[action_id])
            if action_id == "amp_on":
                await asyncio.sleep(1.5)
        except Exception as exc:
            return web.json_response({"ok": False, "action": action_id, "error": str(exc)}, status=502)
        finally:
            if previous_mute is not None:
                with contextlib.suppress(Exception):
                    await asyncio.to_thread(_set_camilla_mute, previous_mute)

    return web.json_response({"ok": True, "action": action_id, "result": result})


async def automation_page(request):
    raise web.HTTPFound("/gui/control/automations/index.html")


def setup_automations(app):
    app["AUTOMATION_LOCK"] = asyncio.Lock()
    app.router.add_get("/api/automations", automation_snapshot)
    app.router.add_post("/api/automations/{action}", execute_automation)
    app.router.add_get("/gui/control/automations", automation_page)
    app.router.add_get("/gui/control/automations/", automation_page)
