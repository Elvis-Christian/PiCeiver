# Kenwood M-AX7 SL16 Controller

Firmware ATmega328P para controlar o M-AX7 sem o C-AX7 conectado ao
barramento. Na arquitetura do PiCeiver, o alvo final e o AZ-Nano V3 USB-C. Ele
permanece conectado ao Raspberry Pi por USB e funciona como controlador SL16
dedicado.

Arquitetura e extensao planejada para a ventoinha:

- [`../../docs/hardware/kenwood-sl16-pi-arduino.md`](../../docs/hardware/kenwood-sl16-pi-arduino.md)

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

## Possivel expansao futura: ventoinha do gabinete

Se a ventilacao adicional for necessaria, o pino planejado e `D4`, ligado
somente a entrada logica de um modulo MOSFET. A ventoinha tera fonte DC
externa; nunca sera alimentada pelo pino. O firmware atual nao aciona D4.
