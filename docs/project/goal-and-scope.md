# Goal And Scope

## Objetivo principal

Transformar o Raspberry Pi com placa de som em um centralizador de audio
e controle que substitui um receiver tradicional, integrando automacao e
processamento de audio multicanal.

## Escopo atual

- o Pi e o coracao do sistema de controle e audio
- a TV e o hub de video
- o Pi nao gerencia video; integra controle e audio

## Fontes de video

- TV Box Android
- notebook
- Nintendo Switch
- receptor de satelite
- TV Samsung como concentradora de video

## Saida de audio multicanal

- amp 1: frontais L/R medio-agudo
- amp 2: frontais L/R sub e mediograves
- amp 3: central frontal
- amp 4: subwoofer

## Energia e acionamento

- amplificadores ligados por tomadas smart
- M-AX7 controlado pelo protocolo Kenwood SL16 em duas linhas de 5 V
- Arduino por USB e o primeiro coprocessador recomendado para o barramento
- ligar, desligar e selecionar `4 x 25 W` ou `2 x 50 W` ja foram reproduzidos

## Processamento de audio

Objetivos do CamillaDSP:

- ampliar stereo
- criar canal central
- aplicar filtros avancados
- sustentar melhorias continuas no pipeline

## Calibracao

- calibracao via REW ou software equivalente
- medicoes e ajustes finos de equalizacao

## Integracoes e automacao

- Home Assistant
- Node-RED
- macros de IR
- controle remoto Bluetooth
- CEC com TV Samsung

## Premissas operacionais

- se existir caminho IR, ele deve ter prioridade por latencia
- HA/HACS apenas para funcoes exclusivas da TV sem equivalente IR
- CamillaDSP e o unico controlador de volume
- o volume da TV deve ficar em zero ou mudo
- GPIO direto no Pi exige buffer/level shifter para duas linhas; a integracao
  inicial usa o Arduino ja validado e deixa o barramento em alta impedancia

## Pontos criticos de integracao

- a TV Samsung nao expõe todas as funcoes por IR/Bluetooth
- HA/HACS pode adicionar latencia
- a estrategia recomendada e mista: IR local para navegacao, HA apenas para o que o IR nao cobre

## Milestones planejados

- M1: centralizacao funcional de audio multicanal
- M2: integracao completa com Home Assistant e Node-RED
- M3: controle Bluetooth com macros IR/CEC
- M4: gerenciamento inteligente de energia dos amplificadores
- M5: filtros avancados e ajuste fino no CamillaDSP
- M6: calibracao com REW e equalizacao final

## Checklist de progresso

- [ ] pipeline DSP multicanal completo e estavel
- [ ] acionamento inteligente das tomadas smart
- [x] protocolo e controle Kenwood funcionais em Arduino de bancada
- [ ] helper USB/serial Kenwood integrado ao Node-RED e CamillaDSP
- [ ] macros IR funcionando
- [ ] controle remoto Bluetooth operante com macros
- [ ] CEC integrado e validado com TV Samsung
- [ ] filtros avancados no CamillaDSP
- [ ] calibracao com REW concluida
