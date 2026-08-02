# Documentacao do PiCeiver

Esta pasta e a fonte canonica unica da documentacao do projeto. Configuracoes
reais ficam em `../backup-config/`; codigo e firmware ficam em suas pastas de
execucao, mas seus guias vivem aqui.

## Retomar o projeto

1. Ler [`SESSION_BOOT.md`](SESSION_BOOT.md).
2. Ler apenas a pagina tematica necessaria.
3. Confirmar qualquer estado operacional em `../backup-config/`.

## Mapa por tema

- objetivo e escopo: [`project/goal-and-scope.md`](project/goal-and-scope.md)
- plano de trabalho: [`project/workplan.md`](project/workplan.md)
- arquitetura de controle: [`architecture/control-flows.md`](architecture/control-flows.md)
- estado atual do audio: [`architecture/audio-stack-current-state.md`](architecture/audio-stack-current-state.md)
- Linux e drivers: [`platform/linux-drivers.md`](platform/linux-drivers.md)
- inventario do host `piht`: [`platform/host-piht-inventory.md`](platform/host-piht-inventory.md)
- CamillaDSP: [`audio/camilladsp.md`](audio/camilladsp.md)
- calibracao REW: [`audio/rew-calibration.md`](audio/rew-calibration.md)
- Node-RED: [`integrations/node-red.md`](integrations/node-red.md)
- backups e restauracao: [`operations/config-backups.md`](operations/config-backups.md) e [`operations/disaster-recovery.md`](operations/disaster-recovery.md)
- baseline de software: [`operations/software-baseline.md`](operations/software-baseline.md)
- historico operacional: [`history/piceiver-operational-history.md`](history/piceiver-operational-history.md)
- hardware: [`hardware/`](hardware/)
- interface Camilla Visual Control: [`development/camilla-visual-control/overview.md`](development/camilla-visual-control/overview.md)

## Fontes de verdade

- `docs/`: contexto, decisoes, procedimentos e historico.
- `backup-config/`: evidencia versionada da configuracao real.
- `scripts/`: automacao operacional.
- `docs/archive/`: material historico ou superado; nao usar como estado atual.

## Localizacoes externas retiradas

Em 2026-08-02, a documentacao exclusiva do PiCeiver foi recolhida de projetos
temporarios em `C:\Users\User1\.codex\visualizations` e do inventario do host
em `Z:\INVENTARIO_VMS`. Copias redundantes do changelog geral do homelab nao
foram mantidas neste repositorio publico; suas fontes compartilhadas continuam
no inventario em `Z:\INVENTARIO_VMS`.
