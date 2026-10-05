# Estado atual confirmado

Atualizado em 2026-10-05 a partir do runtime do host `piht`.

Este documento responde apenas “o que esta funcionando agora”. Detalhes,
historico e planos ficam nas paginas tematicas ligadas no final.

## Acesso

- host: `piht.local` / `192.168.178.117`
- audio: `http://piht.local:5005/gui/control/index.html`
- automacoes: `http://piht.local:5005/gui/control/automations/index.html`
- Node-RED: `http://piht.local:1880/`
- repositorio canonico: `/home/elvis/PiCeiver`
- codigo da interface: `apps/camilla-visual-control/`
- instalacao ativa da interface: `/opt/camillagui/`

## Servicos confirmados

Em 2026-10-05 estavam ativos:

- `camilladsp`
- `camillagui`
- `nodered`
- `mosquitto`
- `raspotify`
- `piceiver-g20s`
- `tvbox-status.timer`

`toslink-to-loopback.service` permanece desabilitado por decisao
arquitetural.

## Caminho do audio

- TV: captura `plughw:3,0`, perfil `camilladsp-tv.yml`, blocos de 1200.
- Spotify: captura `plughw:Loopback,1,0`, perfil
  `camilladsp-spotify.yml`, blocos de 1024.
- Saida comum: `hw:ICUSBAUDIO7D,0`, seis canais, 48 kHz.
- O link de boot `camilladsp.yml` aponta para `camilladsp-tv.yml`.
- Node-RED chama `scripts/audio_source_switch.py` para TV, Spotify e OFF.
- CamillaDSP usa `Restart=always` para recuperar encerramentos internos.

O espectro pos-DSP continua sem sinal porque a saida estavel usa diretamente a
interface USB e nao o PCM `camilla_tee`. VUs, volume, mute e edicao de
filtros continuam funcionando.

## Controle e automacao

- O G20S e lido exclusivamente por `scripts/g20s_control.py`.
- `KEY_POWER` chama `toggle_amplifier_power`.
- Ao desligar o Kenwood M-AX7, o CamillaDSP permanece mutado.
- Ao religar, o M-AX7 termina em quatro canais e o DSP e desmutado depois da
  estabilizacao dos reles.
- O painel oferece a mesma acao em `POWER · Receiver`.
- O estado eletrico do M-AX7 e inferido pelo ultimo comando serial confirmado;
  o SL16 nao fornece leitura fisica de energia.
- Macros PC, TV Box, satelite, Switch, navegacao e midia ainda aparecem como
  planejadas.

## Backup e restauracao

- `backup-config/`: snapshot publico e restauravel das configuracoes vivas.
- `backup-private/`: credenciais do Node-RED; ignorado pelo Git e deve ter
  copia externa criptografada.
- `apps/camilla-visual-control/`: fonte completa da interface e backend.
- `firmware/`: fonte do controlador Arduino.
- `scripts/`: instalacao, operacao, sincronizacao e verificacao.
- `runtime/`: estados e backups locais; ignorado pelo Git.

Depois de qualquer mudanca valida:

```bash
./scripts/sync_backup_configs.sh
./scripts/verify_backup_configs.sh
git status -sb
```

## Proximos trabalhos

1. validar restauracao completa da interface em uma instalacao limpa;
2. concluir macros de dispositivos e navegacao;
3. validar Spotify por periodo prolongado;
4. medir e calibrar CENTER/LFE com REW;
5. restaurar espectro sem recolocar um PCM instavel no caminho critico.

## Detalhes por tema

- audio: [architecture/audio-stack-current-state.md](architecture/audio-stack-current-state.md)
- controle: [architecture/control-flows.md](architecture/control-flows.md)
- interface: [development/camilla-visual-control/overview.md](development/camilla-visual-control/overview.md)
- Node-RED: [integrations/node-red.md](integrations/node-red.md)
- restauracao: [operations/disaster-recovery.md](operations/disaster-recovery.md)
- trabalho futuro: [project/workplan.md](project/workplan.md)
