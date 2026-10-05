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
- TV: CamillaDSP captura diretamente `plughw:3,0`, sem `alsaloop` ou `mixin`
- Spotify: Raspotify escreve em `plughw:Loopback,0,0` e CamillaDSP captura diretamente `plughw:Loopback,1,0`
- Node-RED troca entre dois arquivos de configuracao independentes
- CamillaDSP sai por `hw:3,0`, `6ch`, em ambas as fontes
- `toslink-to-loopback.service` permanece desabilitado e inativo; foi retirado do caminho por underruns recorrentes

## Dispositivos ALSA vistos anteriormente

- playback: `card0 Loopback`, `card1 bcm2835 Headphones`, `card2 vc4hdmi`, `card3 ICUSBAUDIO7D`
- capture: `card0 Loopback`, `card3 ICUSBAUDIO7D`

## CamillaDSP

- config de boot: `/opt/dspstack/camilladsp/camilladsp.yml`, symlink para `camilladsp-tv.yml`
- config TV: `/opt/dspstack/camilladsp/camilladsp-tv.yml`
- config Spotify: `/opt/dspstack/camilladsp/camilladsp-spotify.yml`
- entrada TV: `plughw:3,0`, `2ch`, `S16LE`, `48000`, chunksize/target `1200`
- entrada Spotify: `plughw:Loopback,1,0`, `2ch`, `S32LE`, `48000`, chunksize/target `1024`
- saida ALSA: `hw:ICUSBAUDIO7D,0`, `6ch`, `S16LE`, `48000`
- pipeline:
  - delay (`av_delay` ~ `6.5 ms`)
  - route `2 -> 6` para L/R, center, LFE e L/R low
  - stereo widen apenas em L/R
  - filtros front/center/sub
- headroom global de `-12 dB` em todos os canais exceto LFE
- LFE fora do headroom global e protegido por limiter dedicado em `-1 dBFS`
- compressor definido, mas nao aplicado no pipeline
- unit: `/etc/systemd/system/camilladsp.service`

## Estado conhecido dos servicos

- `camilladsp`, `camillagui`, `nodered` e `raspotify`: ativos em `2026-07-27`
- `toslink-to-loopback`: desabilitado e inativo por decisao arquitetural
- boot validado com TV direta, estado `RUNNING`, sem clipping, underrun ou leitura curta

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
- exec nodes chamam `/home/elvis/PiCeiver/scripts/audio_source_switch.py`
- comandos aceitos: `tv`, `spotify` e `off`
- TV e Spotify carregam configs de captura independentes; `off` aplica mute global
- estado local atomico: `/home/elvis/PiCeiver/runtime/audio-source.json`
- ajustes registrados:
  - `change nodes` agora setam `msg.payload`
  - handler de erro publica em `audio/source/error`
  - debug nodes redundantes removidos

## CamillaGUI

- `docker-compose.yml` existe em `/opt/dspstack/`
- `camillagui.service` apontava para `/opt/camillagui`, mas a pasta estava vazia

## Pendencias sugeridas

- validar reproducao real do Spotify por periodo prolongado
- calibrar ganhos relativos de CENTER e LFE com REW
- revisar integracao com Home Assistant

## Historico tecnico preservado

### Atualizacao 2026-10-05 - recuperacao do audio e do monitor da TV Box

- o CamillaDSP estava parado desde 2026-08-10 apos desistir da saida ALSA com
  `Playback error: Aborting playback after too many write attempts`;
- como o processo terminou com status de sucesso, `Restart=on-failure` nao o
  iniciou novamente;
- apos o reboot, os perfis ainda exigiam `camilla_tee`, mas o `~/.asoundrc`
  que definia esse PCM nao existia, causando `Unknown PCM camilla_tee`;
- os perfis TV e Spotify voltaram a usar a saida direta e estavel
  `hw:ICUSBAUDIO7D,0`, retirando o Loopback do caminho critico do audio;
- um drop-in define `Restart=always` e `RestartSec=2s` para recuperar tambem
  encerramentos internos que o CamillaDSP reporta ao systemd como sucesso;
- o timer da TV Box passou de `OnBootSec=15s` para `OnActiveSec=15s`, evitando
  o estado `elapsed` quando a unit e carregada mais de 15 segundos apos o boot;
- validacao ao vivo: CamillaDSP `RUNNING`, API em `127.0.0.1:1234`, seis canais
  com sinal, zero clipping, CamillaGUI conectado e monitor da TV Box executando
  novamente a cada 20 segundos;
- backup anterior preservado em
  `/home/elvis/PiCeiver/runtime/repair-20261005-104533`.

### Atualizacao 2026-07-27 - fontes diretas independentes

- o caminho B1 com `mixin` de quatro canais apresentou underruns recorrentes e pipocos
- captura TV direta em `plughw:3,0` ficou limpa em teste continuo
- criadas configs independentes para TV e Spotify, sem agregacao ALSA `multi`
- Node-RED passou a carregar a config da fonte solicitada
- troca `TV -> Spotify -> OFF -> TV` validada por script e por MQTT `audio/source/set`
- boot padrao permanece em TV direta
- LFE recuperou nivel ao sair do headroom global e recebeu limiter proprio em `-1 dBFS`

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
