# Historico operacional do PiCeiver

Resumo consolidado das entradas exclusivas do PiCeiver que antes estavam
misturadas ao changelog geral do homelab em `Z:\INVENTARIO_VMS`.

## 2026-07-18

- CamillaDSP restaurado no host `piht` (`192.168.178.117`).

## 2026-07-26

- Bluetooth onboard reativado.
- Monitor persistente do estado da TV Box preparado para consumo pelo Node-RED.

## 2026-07-27

- Headroom do CamillaDSP revisado para evitar clipping.
- Buffer, rate adjust e blocos TOSLINK/CamillaDSP alinhados.
- Nivel percebido do LFE diagnosticado.
- Arquitetura permanente de fontes TV/Spotify migrada para capturas diretas.
- Controle Bluetooth G20S PRO pareado e programado.

Para detalhes tecnicos, usar o
[`inventario do host`](../platform/host-piht-inventory.md), o
[`estado atual do audio`](../architecture/audio-stack-current-state.md) e os
snapshots em `../../backup-config/`.
