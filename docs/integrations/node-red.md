# Node-RED

## Baseline confirmado

- Node-RED `4.1.3`, executado como usuario `elvis` por systemd.
- Diretorio de trabalho: `/home/elvis`; configuracao do usuario em `/home/elvis/.node-red`.
- Limite de heap configurado: `512 MiB`.
- Reinicio automatico em falha, com espera de 20 segundos.
- O snapshot atual possui tres abas: `IR Macros Audio System`, `Audio Switch (TV vs Spotify)` e `Audio Switch (simple)`.
- A automacao usa funcoes, MQTT, comandos `exec`, delays, switches e nos de debug.

## Arquivos de referencia

- fluxo: `../../backup-config/nodered/flows.json`;
- settings: `../../backup-config/nodered/settings.js`;
- ambiente nao secreto: `../../backup-config/nodered/environment`;
- unit: `../../backup-config/systemd/nodered.service`;
- sudoers: `../../backup-config/system/sudoers.nodered-audio`;
- logrotate: `../../backup-config/system/logrotate.nodered`.

Credenciais e estado secreto pertencem a `backup-private/` e nunca devem ser
incluidos em documentacao, logs ou Git. Consultar
[`../operations/private-backups.md`](../operations/private-backups.md).

## Alteracao segura

Sincronizar `flows.json`, preservar a versao anterior e conferir se o fluxo
ativo ainda corresponde ao snapshot. Mudancas de fonte precisam ser validadas
em conjunto com os perfis CamillaDSP e o estado real dos servicos.
