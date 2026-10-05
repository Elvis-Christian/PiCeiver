"""Low-rate post-DSP spectrum tap for the PiCeiver control surface."""

import asyncio
import contextlib
from pathlib import Path
import time

import numpy as np
from aiohttp import web


SAMPLE_RATE = 48_000
CHANNELS = 6
FFT_SIZE = 4096
BIN_COUNT = 96
UPDATE_HZ = 15
HOP_FRAMES = round(SAMPLE_RATE / UPDATE_HZ)
CAPTURE_DEVICE = "hw:Loopback,1,2"


class SpectrumTap:
    def __init__(self):
        self.channel = 0
        self.bins = [-96.0] * BIN_COUNT
        self.updated = 0.0
        self.error = None
        self.process = None
        self.task = None
        self.window = np.hanning(FFT_SIZE).astype(np.float32)
        self.history = np.zeros((FFT_SIZE, CHANNELS), dtype=np.float32)
        self.frequencies = np.fft.rfftfreq(FFT_SIZE, 1 / SAMPLE_RATE)
        self.edges = np.geomspace(20, 20_000, BIN_COUNT + 1)
        self.bin_ranges = []
        for low, high in zip(self.edges[:-1], self.edges[1:]):
            start = int(np.searchsorted(self.frequencies, low, side="left"))
            end = int(np.searchsorted(self.frequencies, high, side="left"))
            self.bin_ranges.append((start, max(start + 1, end)))

    async def start(self):
        self.process = await asyncio.create_subprocess_exec(
            "arecord",
            "-q",
            "-D",
            CAPTURE_DEVICE,
            "-t",
            "raw",
            "-f",
            "S16_LE",
            "-r",
            str(SAMPLE_RATE),
            "-c",
            str(CHANNELS),
            "--period-size=1024",
            "--buffer-size=4096",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        self.task = asyncio.create_task(self._run())

    async def stop(self):
        if self.task:
            self.task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self.task
        if self.process and self.process.returncode is None:
            self.process.terminate()
            with contextlib.suppress(asyncio.TimeoutError):
                await asyncio.wait_for(self.process.wait(), timeout=1)
            if self.process.returncode is None:
                self.process.kill()

    async def _run(self):
        frame_bytes = CHANNELS * 2
        chunk_bytes = HOP_FRAMES * frame_bytes
        try:
            while True:
                raw = await self.process.stdout.readexactly(chunk_bytes)
                samples = np.frombuffer(raw, dtype="<i2").reshape(-1, CHANNELS).astype(np.float32) / 32768.0
                self.history[:-HOP_FRAMES] = self.history[HOP_FRAMES:]
                self.history[-HOP_FRAMES:] = samples
                signal = self.history[:, self.channel]
                spectrum = np.abs(np.fft.rfft(signal * self.window)) / (self.window.sum() / 2)
                db = 20 * np.log10(np.maximum(spectrum, 1e-7))
                result = [max(-96.0, min(6.0, float(np.max(db[start:end])))) for start, end in self.bin_ranges]
                if self.updated:
                    self.bins = [old * 0.62 + new * 0.38 for old, new in zip(self.bins, result)]
                else:
                    self.bins = result
                self.updated = time.time()
                self.error = None
        except asyncio.IncompleteReadError:
            detail = await self.process.stderr.read() if self.process.stderr else b""
            self.error = detail.decode(errors="replace").strip() or "captura ALSA encerrada"
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # keep the GUI alive if the tap fails
            self.error = str(exc)


async def spectrum_handler(request):
    tap = request.app["SPECTRUM_TAP"]
    try:
        requested = int(request.query.get("channel", tap.channel))
    except ValueError:
        requested = tap.channel
    selected = max(0, min(CHANNELS - 1, requested))
    if selected != tap.channel:
        tap.channel = selected
        tap.bins = [-96.0] * BIN_COUNT
        tap.updated = 0.0
    payload = {
        "channel": tap.channel,
        "bins": tap.bins,
        "min_hz": 20,
        "max_hz": 20_000,
        "rate_hz": UPDATE_HZ,
        "updated": tap.updated,
        "source": "post-dsp-alsa-tap",
        "error": tap.error,
    }
    return web.json_response(payload, headers={"Cache-Control": "no-store"})


async def profile_aliases_handler(request):
    config_dir = Path(request.app["config_dir"]).expanduser()
    profiles = []
    for path in sorted(config_dir.glob("*.yml")):
        profiles.append({"name": path.name, "aliasOf": path.resolve().name if path.is_symlink() else None})
    return web.json_response(profiles, headers={"Cache-Control": "no-store"})


async def spectrum_context(app):
    tap = SpectrumTap()
    app["SPECTRUM_TAP"] = tap
    await tap.start()
    yield
    await tap.stop()


def setup_spectrum(app):
    app.cleanup_ctx.append(spectrum_context)
    app.router.add_get("/api/spectrum", spectrum_handler)
    app.router.add_get("/api/profilealiases", profile_aliases_handler)
