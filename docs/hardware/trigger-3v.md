# Controle Kenwood AX-7

## Estado confirmado

O conector antes tratado como `trigger 3V` e na verdade um barramento Kenwood
`SL16` de tres fios em plugue TRS de 3,5 mm:

```text
tip     BUSY
ring    DATA
sleeve  GND
```

As linhas trabalham em aproximadamente `0/5 V` e sao controladas pelo Arduino
Nano dedicado.

Captura, temporizacao, palavras SL16, sequencias validadas e firmware Arduino:

- [`kenwood-ax7-system-control.md`](kenwood-ax7-system-control.md)
- [`kenwood-sl16-pi-arduino.md`](kenwood-sl16-pi-arduino.md)
- [`../../firmware/kenwood-sl16-controller/`](../../firmware/kenwood-sl16-controller/)

## Operacoes validadas

```text
0xBF70  selecionar 2 canais
0xBFF0  selecionar 4 canais

power-on/4ch: BFB8 BFFF BF74 BFF0 BF78
power-off:    BF7F BF38 BFB8
```

Todas essas operacoes foram reproduzidas com sucesso no M-AX7 real usando um
ATmega328P. Para ligar terminando em dois canais, a sequencia de power-on e
seguida por `0xBF70`.

## Caminho final

No projeto final, o Raspberry Pi envia comandos por USB serial ao Arduino Nano.
O Nano e o unico controlador do barramento e gera DATA/BUSY para o M-AX7.
