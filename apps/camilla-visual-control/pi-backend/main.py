from aiohttp import web
import argparse
import ssl
import logging

import camilladsp
from camilladsp_plot.validate_config import CamillaValidator
from camilladsp_plot import VERSION as plot_version

from backend.version import VERSION
from backend.routes import setup_routes, setup_static_routes
from backend.settings import get_config, CONFIG_PATH
from backend.views import version_string
from backend.spectrum import setup_spectrum
from backend.automations import setup_automations

LOG_LEVELS = ["CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG", "NOTSET"]


def build_app(backend_config):
    app = web.Application(client_max_size=1024 ** 3)
    app["config_dir"] = backend_config["config_dir"]
    app["coeff_dir"] = backend_config["coeff_dir"]
    app["default_config"] = backend_config["default_config"]
    app["statefile_path"] = backend_config["statefile_path"]
    app["log_file"] = backend_config["log_file"]
    app["on_set_active_config"] = backend_config["on_set_active_config"]
    app["on_get_active_config"] = backend_config["on_get_active_config"]
    app["supported_capture_types"] = backend_config["supported_capture_types"]
    app["supported_playback_types"] = backend_config["supported_playback_types"]
    app["can_update_active_config"] = backend_config["can_update_active_config"]
    app["gui_config_file"] = backend_config["gui_config_file"]
    setup_routes(app)
    setup_spectrum(app)
    setup_automations(app)
    setup_static_routes(app)

    app["CAMILLA"] = camilladsp.CamillaClient(backend_config["camilla_host"], backend_config["camilla_port"])
    app["STATUSCACHE"] = {
        "backend_version": version_string(VERSION),
        "py_cdsp_version": version_string(app["CAMILLA"].versions.library()),
        "py_cdsp_plot_version": plot_version,
        "backends": [],
        "playback_devices": {},
        "capture_devices": {},
    }
    app["STORE"] = {"reconnect_thread": None, "cache_time": 0}

    validator = CamillaValidator()
    if backend_config["supported_capture_types"] is not None:
        validator.set_supported_capture_types(backend_config["supported_capture_types"])
    if backend_config["supported_playback_types"] is not None:
        validator.set_supported_playback_types(backend_config["supported_playback_types"])
    app["VALIDATOR"] = validator
    return app


def main():
    parser = argparse.ArgumentParser(prog="python main.py", description="Backend for the CamillaDSP web GUI")
    parser.add_argument("-c", "--config", default=CONFIG_PATH)
    parser.add_argument("-l", "--log-level", choices=LOG_LEVELS, default="WARNING")
    parser.add_argument("-a", "--aiohttp-log-level", choices=LOG_LEVELS, default="WARNING")
    args = parser.parse_args()

    logging.getLogger("aiohttp").setLevel(getattr(logging, args.aiohttp_log_level))
    logging.getLogger("root").setLevel(getattr(logging, args.log_level))
    config = get_config(args.config)
    app = build_app(config)
    if config.get("ssl_certificate"):
        ssl_context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
        ssl_context.load_cert_chain(config["ssl_certificate"], keyfile=config.get("ssl_private_key"))
    else:
        ssl_context = None
    web.run_app(app, host=config["bind_address"], port=config["port"], ssl_context=ssl_context)


if __name__ == "__main__":
    main()
