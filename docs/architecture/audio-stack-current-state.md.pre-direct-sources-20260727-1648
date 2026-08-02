# Audio Stack Current State

## Leitura operacional

Projeto de DSP com CamillaDSP, interface de som externa, MQTT e Node-RED
como orquestrador. O estado descrito aqui combina documentacao existente
com o ultimo runtime documentado; para validar configuracao ativa, comparar
sempre com `backup-config/`.

## Regra antes de editar

Antes de qualquer alteracao relevante:

- preservar a versao anterior
- manter backup rastreavel
- sincronizar `backup-config/` apos validacao

## Arquitetura de audio

- entrada SPDIF via interface USB `ICUSBAUDIO7D` (`card 3`)
- `toslink-to-loopback` faz ponte `plughw:3,0 -> plughw:0,0`
- CamillaDSP captura `hw:0,1` e sai por `hw:3,0`

## Dispositivos ALSA vistos anteriormente

- playback: `card0 Loopback`, `card1 bcm2835 Headphones`, `card2 vc4hdmi`, `card3 ICUSBAUDIO7D`
- capture: `card0 Loopback`, `card3 ICUSBAUDIO7D`

## CamillaDSP

- config ativa documentada: `/opt/dspstack/camilladsp/camilladsp.yml`
- entrada ALSA: `hw:0,1`, `2ch`, `S32LE`, `48000`
- saida ALSA: `hw:3,0`, `6ch`, `S16LE`, `48000`
- pipeline:
  - delay (`av_delay` ~ `6.5 ms`)
  - route `2 -> 6` para L/R, center, LFE e L/R low
  - stereo widen apenas em L/R
  - filtros front/center/sub
- compressor definido, mas nao aplicado no pipeline
- unit: `/etc/systemd/system/camilladsp.service`

## Estado conhecido dos servicos

- `camilladsp`: ativo desde `2026-02-09`
- `toslink-to-loopback`: inativo no registro de `2026-02-12 16:42:08 CET`
- `raspotify`: inativo no registro de `2026-02-12 16:35:49 CET`
- estado posterior documentado em `2026-02-23`: `camilladsp`, `nodered`, `raspotify` e `toslink-to-loopback` ativos

## Raspotify

- override em `/etc/systemd/system/raspotify.service.d/override.conf`
- `librespot` configurado com `--device plughw:CARD=Loopback,DEV=0`
- `/etc/default/raspotify` divergia do override e apontava `hw:2,1`

## MQTT / Mosquitto

- config padrao em `/etc/mosquitto/mosquitto.conf`
- sem configs adicionais em `/etc/mosquitto/conf.d/`
- broker usado no Node-RED: `127.0.0.1:1883`

## Node-RED

- diretorio: `/home/elvis/.node-red/`
- fluxo ativo documentado: `Audio Source Switch (TV vs Spotify)`
- topicos principais:
  - entrada: `audio/system/*`, `audio/source/set`, `ir/*`
  - saida: `audio/source/state`, `audio/source/error`
- exec nodes controlam `systemctl` para `toslink-to-loopback` e `raspotify`
- ajustes registrados:
  - `change nodes` agora setam `msg.payload`
  - handler de erro publica em `audio/source/error`
  - debug nodes redundantes removidos

## CamillaGUI

- `docker-compose.yml` existe em `/opt/dspstack/`
- `camillagui.service` apontava para `/opt/camillagui`, mas a pasta estava vazia

## Pendencias sugeridas

- confirmar estado atual dos servicos
- revisar se `toslink-to-loopback` deve ficar ativo permanentemente
- validar filtros e roteamento
- decidir o caminho final do CamillaGUI
- revisar integracao com Home Assistant

## Historico tecnico preservado

### Atualizacao 2026-02-22

- problema: Spotify tocava, mas o Camilla nao recebia audio
- causa: mismatch de subdevice no Loopback
- correcao aplicada: `raspotify` passou a usar `plughw:Loopback,0,0`
- tentativa descartada: `softvol`/PCM `spotify`
- limitacao registrada: Camilla capturava apenas 1 entrada estereo

### Plano B1 documentado

Objetivo: manter TV e Spotify simultaneos e selecionar/mutar no Camilla.

Ajustes propostos:

- `toslink-to-loopback` em `plughw:Loopback,0,1`
- `raspotify` em `plughw:Loopback,0,0`
- criar PCM ALSA `mixin` com 4 canais
- Camilla capturar `mixin` e selecionar fonte por mixer

### Atualizacao 2026-02-23

- erro: `SyntaxError: unterminated f-string` nos execs TV/Spotify/OFF
- causa: quebras CR literais no Python embutido
- correcao: reconstruir o request com `\r\n`.join(...)
- resultado: execs voltaram a funcionar e `SetConfigJson` respondeu `Ok`

## Backup master historico

Estado documentado em `2026-02-23`:

- `/home/elvis/backup_master/camilladsp.yml`
- `/home/elvis/backup_master/asound.conf`
- `/home/elvis/backup_master/flows.json`
- `/home/elvis/backup_master/settings.js`
- `/home/elvis/backup_master/toslink-to-loopback.service`
- `/home/elvis/backup_master/raspotify.override.conf`
