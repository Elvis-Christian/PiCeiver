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
- arquitetura unica: Pi alimenta e controla o Arduino Nano por USB serial
- Nano gera DATA/BUSY e permanece como controlador dedicado do M-AX7
- ligar, desligar e selecionar `4 x 25 W` ou `2 x 50 W` ja foram reproduzidos
- futuramente, se necessario, o Nano podera acionar por D4 um modulo MOSFET e
  uma ventoinha com fonte externa para refrigerar o gabinete

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
- interface web externa para estado e controle geral
- tablet Android como primeira tela touch
- iPad antigo como cliente opcional apos teste de compatibilidade
- tela touch dedicada ao Pi como evolucao futura

Diretriz completa da interface:

- [`../architecture/external-control-interface.md`](../architecture/external-control-interface.md)

## Premissas operacionais

- se existir caminho IR, ele deve ter prioridade por latencia
- HA/HACS apenas para funcoes exclusivas da TV sem equivalente IR
- CamillaDSP e o unico controlador de volume
- o volume da TV deve ficar em zero ou mudo
- Nano deve garantir alta impedancia no SL16 durante boot, shutdown e
  falhas; o Pi nunca se conecta diretamente ao barramento de 5 V

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
- [x] arquitetura Pi -> USB -> Nano -> M-AX7 definida para o sistema final
- [ ] helper serial Kenwood do Pi integrado ao Node-RED e CamillaDSP
- [ ] avaliar futuramente a necessidade de ventilacao adicional do gabinete
- [ ] macros IR funcionando
- [ ] controle remoto Bluetooth operante com macros
- [ ] CEC integrado e validado com TV Samsung
- [ ] painel externo somente leitura validado em tablet Android
- [ ] volume, mute e selecao de fonte operantes pela interface touch
- [ ] compatibilidade do iPad antigo testada
- [ ] decisao sobre tela dedicada tomada apos validar o tablet
- [ ] filtros avancados no CamillaDSP
- [ ] calibracao com REW concluida
