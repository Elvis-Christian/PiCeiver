# Controle Kenwood dos Amplificadores Frontais

O sinal inicialmente tratado como trigger de 3 V foi identificado como o
barramento Kenwood SL16 de 5 V. O Raspberry Pi nao gera esse sinal: ele
alimenta e controla um Arduino Nano por USB serial, e o Nano controla o M-AX7.

## Interface

```text
M-AX7 TIP    / BUSY -- 10 kohm -- Nano D2
M-AX7 RING   / DATA -- 10 kohm -- Nano D3
M-AX7 SLEEVE / GND  ----------- Nano GND
```

## Regras

- manter o C-AX7 desconectado quando o Nano puder transmitir;
- deixar D2/D3 em alta impedancia no boot e no repouso;
- o Pi envia apenas comandos seriais USB ao Nano;
- a possivel ventoinha adicional sera uma expansao futura controlada pelo
  Nano, se os testes termicos demonstrarem necessidade.

## Entregaveis

- firmware ATmega328P versionado;
- helper serial do Pi;
- integracao com Node-RED e mute/ramp do CamillaDSP;
- validacao de ligar, desligar e selecionar dois ou quatro canais.
