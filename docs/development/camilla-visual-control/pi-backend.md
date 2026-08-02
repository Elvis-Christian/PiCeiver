# Pi backend requirements

The live spectrum and profile manager depend on three persistent pieces:

- Every independent CamillaDSP profile uses `devices.playback.device: camilla_tee`, six playback channels, and a compatible sample rate.
- `~/.asoundrc` contains the `camilla_tee` route that mirrors the six post-DSP outputs to the USB interface and ALSA loopback tap.
- CamillaDSP starts with `--statefile /home/elvis/camilladsp/statefile.yml`, allowing the active YAML, main volume, and mute state to survive restarts.

`camilladsp-stateful.conf` is the systemd drop-in for the statefile-enabled service. `statefile.example.yml` is deliberately muted at −60 dB; create the runtime statefile with values appropriate for the installation. CamillaDSP updates it automatically after startup.

`camillagui.yml` uses the canonical configuration directory instead of its symlink. This is required for CamillaGUI to identify the real active profile. The `/api/profilealiases` endpoint reports symbolic-link aliases so the control surface does not present one underlying YAML as multiple independent profiles.

Before any profile transfer, the UI creates a timestamped backup, validates the candidate through CamillaDSP, preserves the destination capture/source settings, and reasserts the spectrum playback infrastructure.
