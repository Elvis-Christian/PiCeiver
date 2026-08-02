# Linux e drivers

## Baseline confirmado

- Debian GNU/Linux 13 (trixie), arm64.
- Kernels documentados: `6.12.47+rpt-rpi-v8` e `6.12.62+rpt-rpi-v8`, alem das variantes `rpt-rpi-2712`.
- Modulos carregados de forma persistente: `i2c-dev` e `snd-aloop`.
- Audio onboard habilitado por `dtparam=audio=on`.
- Bluetooth onboard habilitado; Wi-Fi desabilitado por overlay.
- USB em modo host por `dtoverlay=dwc2,dr_mode=host`.
- `systemd-logind` ignora `KEY_POWER` curto e longo; a tecla POWER do controle
  Bluetooth pertence exclusivamente ao PiCeiver e nunca desliga o host.

## ALSA

O snapshot `../../backup-config/alsa/asound.conf` define:

- `pcm.spotify` em `plughw:Loopback,0,0`;
- `pcm.tv` em `plughw:Loopback,0,1`;
- `pcm.mixin_raw` como captura de quatro canais;
- `pcm.mixin` como camada `plug` sobre o dispositivo multicanal.

O estado atual do fluxo direto e as diferencas em relacao ao caminho legado
com `alsaloop` estao em
[`../architecture/audio-stack-current-state.md`](../architecture/audio-stack-current-state.md).

## Evidencia e alteracao segura

- modulos: `../../backup-config/system/modules-load.d/modules.conf`;
- boot: `../../backup-config/boot/config.txt`;
- ALSA: `../../backup-config/alsa/`;
- servicos: `../../backup-config/systemd/`.

Antes de alterar drivers, overlays ou ALSA, sincronizar o snapshot e manter
rollback do arquivo ativo. Nao inferir a numeracao atual das placas apenas a
partir de nomes historicos; confirmar com `aplay -l`, `arecord -l` e o runtime.
