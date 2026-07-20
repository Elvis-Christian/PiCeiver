# Kenwood M-AX7 SL16 Controller

Firmware validado em um Arduino Uno compativel para controlar o M-AX7 sem o
C-AX7 conectado ao barramento.

## Ligacao de bancada validada

```text
M-AX7 TIP   (BUSY) -> 10 kohm -> Arduino D2
M-AX7 RING  (DATA) -> 10 kohm -> Arduino D3
M-AX7 SLEEVE       -----------> Arduino GND
```

O firmware deixa D2 e D3 como entrada no boot e depois de cada quadro. Nao
ligue o C-AX7 ao mesmo barramento enquanto o Arduino puder transmitir.

## Comandos seriais

115200 baud, um caractere por operacao:

```text
o  ligar; termina em 4 canais
t  ligar e terminar em 2 canais
f  desligar/standby
2  selecionar 2 canais
4  selecionar 4 canais
s  ler estado logico de BUSY e DATA
h  ajuda
```

## Compilar e gravar

```text
pio run --target upload --upload-port COM8
```

O nome da porta deve ser ajustado ao computador usado.
