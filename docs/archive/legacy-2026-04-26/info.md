# Relatorio do projeto (atualizado)

## Regra obrigatoria antes de qualquer edicao
Antes de qualquer alteracao em arquivo, executar um metodo de retrograde da versao anterior e manter versoes rastreaveis em backup em um sistema inteligente.

## Resumo
Projeto de DSP com CamillaDSP, interface de som externa, Home Assistant via MQTT e Node-RED como orquestrador. Pipeline de audio funcional para SPDIF com separacao e roteamento multicanal.

## Arquitetura de audio (estado atual)
- Entrada SPDIF via interface USB ICUSBAUDIO7D (ALSA card 3).
- Servico `toslink-to-loopback` faz ponte `plughw:3,0 -> plughw:0,0` (ALSA Loopback).
- CamillaDSP captura `hw:0,1` (Loopback) e sai por `hw:3,0` (USB 6ch).

## Dispositivos ALSA (capturados anteriormente)
- Playback: card0 Loopback, card1 bcm2835 Headphones, card2 vc4hdmi, card3 ICUSBAUDIO7D.
- Capture: card0 Loopback, card3 ICUSBAUDIO7D.

## CamillaDSP
- Config ativa: `/opt/dspstack/camilladsp/camilladsp.yml`.
- Entrada: ALSA `hw:0,1`, 2ch, S32LE, 48000.
- Saida: ALSA `hw:3,0`, 6ch, S16LE, 48000.
- Pipeline:
  - delay (av_delay ~6.5 ms)
  - route 2 -> 6 (somatorios/ganhos para L/R, center, LFE, L/R low)
  - stereo widen apenas L/R
  - filtros front/center/sub
- Compressor definido, mas nao aplicado no pipeline.
- Servico: `/etc/systemd/system/camilladsp.service` (usuario elvis, group audio).

## Servicos systemd (ultimo estado conhecido)
- `camilladsp`: ativo desde 2026-02-09.
- `toslink-to-loopback`: inativo desde 2026-02-12 16:42:08 CET.
- `raspotify`: inativo desde 2026-02-12 16:35:49 CET.

## Raspotify
- Override em `/etc/systemd/system/raspotify.service.d/override.conf`.
- `librespot` com `--device plughw:CARD=Loopback,DEV=0`.
- `/etc/default/raspotify` existe mas diverge do override (define hw:2,1).

## MQTT / Mosquitto
- Config padrao em `/etc/mosquitto/mosquitto.conf`.
- Sem configs adicionais em `/etc/mosquitto/conf.d/`.
- Brokers no Node-RED: `127.0.0.1:1883`.

## Node-RED
- Diretorio: `/home/elvis/.node-red/`.
- Fluxo ativo: **Audio Source Switch (TV vs Spotify)**.
- Topicos principais:
  - entrada: `audio/system/*`, `audio/source/set`, `ir/*`
  - saida: `audio/source/state`, `audio/source/error`
- Exec nodes controlam `systemctl` para `toslink-to-loopback` e `raspotify`.
- Ajustes feitos no fluxo ativo:
  - change nodes agora setam `msg.payload` (nao `msg.command`) para exec.
  - handler de erro publica em `audio/source/error`.
  - debug nodes redundantes removidos.
- Arquivo alterado: `/home/elvis/.node-red/flows.json`.

## CamillaGUI
- `docker-compose.yml` existe em `/opt/dspstack/`.
- `camillagui.service` aponta para `/opt/camillagui`, mas a pasta esta vazia.

## Pendencias sugeridas
- Confirmar estado atual dos servicos (`systemctl is-active` e `systemctl status`).
- Revisar se `toslink-to-loopback` deve estar ativo permanentemente.
- Validar filtros/roteamento e aplicar compressor se necessario.
- Resolver inconsistencia do CamillaGUI (docker vs systemd).
- Revisar integracao com Home Assistant (URL/token no fluxo “HA Config”).

## Atualizacao 2026-02-22 (diagnostico e plano)
- Problema observado: Spotify tocava no dispositivo "Sala", mas o Camilla nao recebia audio.
- Causa: Loopback subdevice mismatch. O librespot gravava no subdevice 1 e o Camilla capturava o subdevice 0. No loopback, subN conecta com subN.
- Correcao aplicada e confirmada: ajustar o raspotify para `plughw:Loopback,0,0` (audio passou a chegar no Camilla).
- Tentativa descartada: `softvol`/PCM "spotify" nao criou mixer separado no ALSA; alem disso, o Spotify ficou travado em pause.
- Limitacao atual: Camilla captura apenas 1 entrada (2 canais). Nao e possivel mutar Spotify/TV separadamente sem mudar a topologia.

### Plano B1 (duas fontes simultaneas com mute no Camilla)
- Objetivo: manter TV e Spotify tocando simultaneamente e selecionar/mutar no Camilla.
- Ajustes:
  - `toslink-to-loopback` passa a escrever em `plughw:Loopback,0,1` (TV em subdevice 1).
  - `raspotify` escreve em `plughw:Loopback,0,0` (Spotify em subdevice 0).
  - Criar PCM ALSA `mixin` (multi) com 4 canais: [Spotify L/R, TV L/R].
  - Camilla captura `mixin` com 4 canais e usa um mixer `select_source` (4->2) para mutar/selecionar a fonte.

## Atualizacao 2026-02-23 (Node-RED exec fix)
- Erro: `SyntaxError: unterminated f-string` nos 3 execs (TV/Spotify/OFF) ao injetar.
- Causa: quebras CR literais dentro de `f"GET / HTTP/1.1` no script Python embutido no `exec`.
- Correcao: reconstruir o request usando `\r\n` explicito via `"\r\n".join([...])`.
- Resultado: execs voltaram a executar sem erro e o `SetConfigJson` responde `Ok`.
- Arquivo atualizado: `/home/elvis/.node-red/flows.json`.

## Backup master (estado atual 2026-02-23)
- Pasta unica com os modelos atuais:
  - `/home/elvis/backup_master/camilladsp.yml`
  - `/home/elvis/backup_master/asound.conf`
  - `/home/elvis/backup_master/flows.json`
  - `/home/elvis/backup_master/settings.js`
  - `/home/elvis/backup_master/toslink-to-loopback.service`
  - `/home/elvis/backup_master/raspotify.override.conf`
- Backups antigos foram descartados para manter apenas o backup mae.

## Estado atual (2026-02-23)
- Servicos ativos: `camilladsp`, `nodered`, `raspotify`, `toslink-to-loopback`.
- Execs Node-RED (TV/Spotify/OFF) testados via inject: sem erro de sintaxe.
