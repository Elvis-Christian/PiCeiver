"""Safety and state-machine checks for the G20S LFE action."""

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import piceiver_control as control


def lfe_config():
    return {
        "filters": {
            "lfe_remote_trim": {"type": "Volume", "parameters": {"fader": "Aux1", "limit": 5.0}},
            "lfe_limiter": {"type": "Limiter", "parameters": {"clip_limit": -1.0}},
        },
        "pipeline": [
            {"type": "Filter", "channels": [3], "names": ["lfe_remote_trim"], "bypassed": False},
            {"type": "Filter", "channels": [3], "names": ["lfe_limiter"], "bypassed": False},
        ],
    }


class FakeVolume:
    def __init__(self, volume=0.0, mute=False):
        self.value = volume
        self.muted = mute

    def volume(self, fader):
        assert fader == 1
        return self.value

    def mute(self, fader):
        assert fader == 1
        return self.muted

    def set_volume(self, fader, value):
        assert fader == 1
        self.value = value

    def set_mute(self, fader, value):
        assert fader == 1
        self.muted = value


class FakeClient:
    def __init__(self, config=None, volume=None):
        self.config = type("Config", (), {"active": lambda self: config or lfe_config()})()
        self.volume = volume or FakeVolume()

    def disconnect(self):
        pass


class LfeCycleTests(unittest.TestCase):
    def test_four_states_wrap_in_order(self):
        client = FakeClient(volume=FakeVolume(volume=5.0, mute=True))
        with patch.object(control, "connect", return_value=client):
            self.assertEqual([control.cycle_lfe()["lfe_state"] for _ in range(4)],
                             ["-5 dB", "0 dB", "+5 dB", "mudo"])
        self.assertTrue(client.volume.muted)

    def test_wrong_output_rejected_without_touching_fader(self):
        config = lfe_config()
        config["pipeline"][0]["channels"] = [0]
        client = FakeClient(config=config)
        with patch.object(control, "connect", return_value=client):
            with self.assertRaisesRegex(RuntimeError, "exclusive to output 3"):
                control.cycle_lfe()
        self.assertEqual(client.volume.value, 0.0)
        self.assertFalse(client.volume.muted)

    def test_other_aux1_filter_rejected(self):
        config = lfe_config()
        config["filters"]["other"] = {"type": "Volume", "parameters": {"fader": "Aux1"}}
        with self.assertRaisesRegex(RuntimeError, "another filter"):
            control.require_lfe_filter(config)

    def test_missing_peak_limiter_rejected(self):
        config = lfe_config()
        config["pipeline"][1]["bypassed"] = True
        with self.assertRaisesRegex(RuntimeError, "peak limiter"):
            control.require_lfe_filter(config)


if __name__ == "__main__":
    unittest.main()
