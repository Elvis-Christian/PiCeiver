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
- [ ] identificar modelo e gpiochips do Raspberry Pi
- [ ] montar buffer 74AHCT125, enable seguro e divisores de leitura
- [ ] gerar DATA por SPI e BUSY/TX_EN por GPIO
- [ ] implementar `kenwood-sl16d` e `kenwoodctl`
- [ ] integrar Node-RED com mute/ramp do CamillaDSP

### Entregaveis

- firmware Arduino e protocolo documentados
- projeto eletrico e pinagem do Pi documentados
- helper do Pi com logs e exclusao mutua
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
2. controle SL16 direto pelo Pi
3. integracao HA/HACS para funcoes exclusivas
4. calibracao e filtros avancados

### Backlog por etapa

- controle: mapear comandos BT e IR, testar latencia
- SL16: montar circuito do Pi, implementar helper e validar
- HA/HACS: configurar e testar comandos
- DSP/REW: medir, aplicar filtros, validar

### Riscos

- latencia excessiva no caminho HA/HACS
- conflito eletrico se C-AX7 e Pi dirigirem o barramento ao mesmo tempo
- comando espurio durante boot se TX_EN nao tiver fail-safe por hardware
- necessidade de varias iteracoes finas no DSP
