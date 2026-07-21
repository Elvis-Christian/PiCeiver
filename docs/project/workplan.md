# Workplan

## Objetivo

Organizar os itens de implementacao em entregaveis claros e ordem de
prioridade.

## 1. Arquitetura de controle

### Fluxo rapido

Bluetooth -> Pi -> IR -> TV -> Dispositivo

### Fluxo estendido

Bluetooth -> Pi -> Node-RED -> Home Assistant (HACS) -> TV

### Entregaveis

- diagrama em texto ou Mermaid
- regra de roteamento validada
- medicao basica de latencia por caminho

### Interface externa

A interface geral sera uma aplicacao web local, inicialmente aberta em um
tablet Android e futuramente reutilizada em uma tela touch dedicada ao Pi.
Touch e controle Bluetooth devem produzir as mesmas acoes no nucleo de
controle.

Documento de arquitetura:

- [`../architecture/external-control-interface.md`](../architecture/external-control-interface.md)

Entregaveis iniciais:

- painel somente leitura com fonte, volume, mute e saude do sistema
- seletor touch de TV, Spotify e OFF
- reconexao segura depois de suspensao ou perda de Wi-Fi
- teste de compatibilidade no iPad antigo
- operacao independente da disponibilidade da tela

### Voz e IA

O botao de microfone do controle Bluetooth iniciara uma rotina push-to-talk.
O Pi reduzira o audio do programa, capturara a voz, usara a API para entender a
intencao e oferecera ao modelo apenas ferramentas tipadas. O PiCeiver Core
validara cada chamada antes de encaminhar a acao aos componentes existentes.

Comandos cotidianos devem usar transcricao e ferramentas com confirmacao curta.
Perguntas e conversas podem usar uma sessao de voz Realtime, com o audio de
resposta entrando no pipeline CamillaDSP. Controles locais permanecem
independentes da Internet e da IA.

Documento de arquitetura:

- [`../architecture/voice-ai-control.md`](../architecture/voice-ai-control.md)

Entregaveis incrementais:

- validar microfone e eventos de pressionar, soltar e cancelar;
- mostrar estados de voz no tablet sem executar comandos na primeira bancada;
- definir ferramentas, schemas, confirmacoes e limites locais;
- integrar volume, mute, fontes e Spotify;
- adicionar TTS e depois conversa Realtime;
- medir precisao multilingue, latencia, disponibilidade e custo mensal.

## 2. Controle Kenwood M-AX7 por SL16

### Trabalho tecnico

- [x] identificar pinout TRS, niveis e protocolo SL16
- [x] capturar e reproduzir ligar, desligar, 2 canais e 4 canais
- [x] definir Pi -> USB serial -> Arduino Nano -> SL16
- [ ] gravar e validar o firmware no AZ-Nano V3 USB-C
- [ ] implementar o helper serial do Nano no Pi
- [ ] integrar Node-RED com mute/ramp do CamillaDSP
- [ ] avaliar futuramente a necessidade de controle da ventoinha pelo Nano

### Entregaveis

- firmware Arduino e protocolo documentados
- ligacao Nano-M-AX7 e comandos USB documentados
- helper serial do Pi com logs e exclusao mutua
- 100 ciclos de validacao sem comando espurio

## 3. Calibracao com REW

### Trabalho tecnico

- medir cada canal
- definir curva alvo
- gerar filtros PEQ/FIR
- alinhar atrasos
- repetir medicao para validacao

### Entregaveis

- filtros aplicados no CamillaDSP
- parametros e curvas antes/depois

## 4. Plano de implementacao

### Prioridades

1. responsividade do controle por IR local
2. controle SL16 pelo Nano comandado por USB pelo Pi
3. integracao HA/HACS para funcoes exclusivas
4. calibracao e filtros avancados

### Backlog por etapa

- controle: mapear comandos BT e IR, testar latencia
- SL16: instalar o Nano, implementar helper serial e validar
- HA/HACS: configurar e testar comandos
- DSP/REW: medir, aplicar filtros, validar

### Riscos

- latencia excessiva no caminho HA/HACS
- conflito eletrico se C-AX7 e Nano dirigirem o barramento ao mesmo tempo
- comando espurio se o firmware transmitir durante boot ou reset
- necessidade de varias iteracoes finas no DSP
