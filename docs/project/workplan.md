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
