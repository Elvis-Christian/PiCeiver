"""On-demand, read-only post-DSP spectrum tap for the PiCeiver control surface."""

import asyncio
import contextlib
import time
from pathlib import Path

import numpy as np
from aiohttp import web


SAMPLE_RATE = 48_000
CHANNELS = 6
FFT_SIZE = 4096
BIN_COUNT = 96
UPDATE_HZ = 15
HOP_FRAMES = round(SAMPLE_RATE / UPDATE_HZ)
TAP_HELPER = "/usr/local/libexec/piceiver/usb-spectrum-tap"
IDLE_SECONDS = 4.0
RETRY_SECONDS = 5.0


class SpectrumTap:
    def __init__(self):
        self.channel = 0
        self.bins = [-96.0] * BIN_COUNT
        self.updated = 0.0
        self.error = None
        self.process = None
        self.task = None
        self.watchdog = None
        self.last_request = 0.0
        self.retry_after = 0.0
        self.lock = asyncio.Lock()
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
        self.watchdog = asyncio.create_task(self._watch_idle())

    async def request(self):
        self.last_request = time.monotonic()
        if self.process is not None or self.last_request < self.retry_after:
            return
        async with self.lock:
            if self.process is not None:
                return
            self.bins = [-96.0] * BIN_COUNT
            self.updated = 0.0
            try:
                self.process = await asyncio.create_subprocess_exec(
                    "sudo", "-n", TAP_HELPER,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                self.error = None
                self.task = asyncio.create_task(self._run())
            except OSError as exc:
                self.error = str(exc)
                self.retry_after = time.monotonic() + RETRY_SECONDS

    async def _watch_idle(self):
        while True:
            await asyncio.sleep(1)
            if self.process is not None and time.monotonic() - self.last_request > IDLE_SECONDS:
                await self._stop_capture()

    async def stop(self):
        if self.watchdog:
            self.watchdog.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self.watchdog
        await self._stop_capture()

    async def _stop_capture(self):
        process, task = self.process, self.task
        self.process, self.task = None, None
        if task:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task
        if process and process.returncode is None:
            process.terminate()
            try:
                await asyncio.wait_for(process.wait(), timeout=1)
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()
        self.updated = 0.0
        self.bins = [-96.0] * BIN_COUNT

    async def _run(self):
        process = self.process
        frame_bytes = CHANNELS * 2
        chunk_bytes = HOP_FRAMES * frame_bytes
        try:
            while True:
                raw = await process.stdout.readexactly(chunk_bytes)
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
            detail = await process.stderr.read() if process.stderr else b""
            self.error = detail.decode(errors="replace").strip() or "captura USB encerrada"
            self.retry_after = time.monotonic() + RETRY_SECONDS
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # keep the GUI alive if the tap fails
            self.error = str(exc)
            self.retry_after = time.monotonic() + RETRY_SECONDS
        finally:
            if self.process is process:
                self.process, self.task = None, None
                if process.returncode is None:
                    process.terminate()
                with contextlib.suppress(asyncio.TimeoutError):
                    await asyncio.wait_for(process.wait(), timeout=1)
                self.updated = 0.0


async def spectrum_handler(request):
    tap = request.app["SPECTRUM_TAP"]
    await tap.request()
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
        "source": "post-dsp-usb-monitor",
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
