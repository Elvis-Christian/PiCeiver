# Samsung Q60B: IR e selecao de HDMI

## Equipamento alvo

- TV: Samsung QLED Q60B 55 pol.
- Modelo completo: `GQ55Q60BAUXZG`.
- IP LAN observado: `192.168.178.35`.
- Papel no PiCeiver: hub de video; o Pi deve enviar IR pelo emissor ligado ao GPIO.
- Familia de firmware: `T-NKLBDEUC` (confirmada na pagina oficial de suporte do modelo).

## Regra operacional

- Preferir IR para comandos que possuam equivalente local e forem validados.
- Nao publicar uma macro de entrada HDMI como deterministica antes de ela ser
  testada nesta TV com o emissor fisicamente posicionado.
- `POWER` e toggle; nao usar em automacao sem estado confiavel da TV.

## Transporte Bluetooth do PiCeiver

- Hardware: Raspberry Pi 3 Model B Rev 1.2, com Bluetooth onboard.
- Estado confirmado em `2026-07-26`: controlador `hci0` ativo, energizado e
  servido por `bluetooth.service` habilitado para boot.
- O Bluetooth onboard substitui a necessidade de dongle USB para parear o
  controle; os dongles devem permanecer desconectados durante a validacao para
  evitar a selecao de um adaptador diferente.
- Estado seguro inicial: `Discoverable: no` e `Pairable: no`. Antes de
  cadastrar um controle, habilitar pareamento somente durante a janela de
  cadastro e desabilita-lo ao terminar.
- A reativacao removeu a desativacao de boot `dtoverlay=disable-bt`; a copia
  de rollback esta em `backup-config/boot/config.txt.pre-enable-bt-20260726`.

## Codigos IR localizados

O conjunto Samsung abaixo e uma **referencia candidata**, nao uma captura
deste aparelho. A configuracao LIRC publicada para um controle Samsung UHD
usa portadora de `38 kHz`, prefixo `0xE0E0`, `POWER=0x40BF` e
`SOURCE=0x807F`. Outra referencia LIRC para controles Samsung registra
`HDMI=0xD12E`. Esses codigos permitem construir e testar o emissor, mas ainda
nao comprovam selecao de entrada na Q60B.

| Acao | Codigo candidato LIRC | Estado para GQ55Q60BAUXZG | Uso permitido agora |
| --- | --- | --- | --- |
| Energia | `KEY_POWER` / `0x40BF` | nao validado; comportamento toggle esperado | somente teste manual |
| Lista de fontes | `KEY_SOURCE` / `0x807F` | nao validado | primeiro teste de IR |
| HDMI / ciclo | `KEY_HDMI` / `0xD12E` | nao validado; pode ciclar fontes | teste manual, nunca macro |
| HDMI 1 direto | `0xE0E09768` / LIRC `0x9768` | candidato de TV Samsung antiga | teste manual isolado |
| HDMI 2 direto | `0xE0E07D82` / LIRC `0x7D82` | candidato de TV Samsung antiga | teste manual isolado |
| HDMI 3 direto | `0xE0E043BC` / LIRC `0x43BC` | candidato de TV Samsung antiga | teste manual isolado |

## Candidatos discretos de TVs Samsung antigas

Uma configuracao SmartIR para `UE55F8000` e uma captura independente de uma
TV Samsung antiga concordam nesta familia de codigos. Eles sao os melhores
candidatos disponiveis para teste direto na Q60B; **nao** sao confirmados pela
Samsung nem pela Q60B.

| Entrada | Codigo Samsung 32-bit | Codigo LIRC (com `pre_data 0xE0E0`) | Prioridade de teste | Observacao |
| --- | --- | --- | --- | --- |
| HDMI 1 | `0xE0E09768` | `0x9768` | 1 | candidato principal |
| HDMI 2 | `0xE0E07D82` | `0x7D82` | 2 | candidato principal |
| HDMI 3 | `0xE0E043BC` | `0x43BC` | 3 | candidato principal |
| HDMI 4 | `0xE0E0A35C` | `0xA35C` | 4 | preservar somente para teste; a Q60B tem tres HDMI |
| TV | `0xE0E0BE41` | `0xBE41` | opcional | pode recuperar a fonte de antena/TV |
| PC | `0xE0E09669` | `0x9669` | baixa | entrada legada; pode ser ignorada |
| Component | `0xE0E0619E` | `0x619E` | baixa | entrada legada; pode ser ignorada |

Para LIRC, os codigos de 16 bits da tabela dependem dos mesmos parametros
Samsung da referencia: `frequency 38000`, `header 4480 4480`,
`one 678 1680`, `zero 678 436`, `ptrail 678`, `pre_data_bits 16` e
`pre_data 0xE0E0`. Para uma biblioteca que aceite Samsung 32-bit, enviar o
valor completo da segunda coluna, sem inverter os bits por conta propria.

Esses codigos podem falhar, ser ignorados ou abrir uma funcao diferente na
Q60B. Algumas bibliotecas de rede relatam exatamente essa inconsistência com
`KEY_HDMI1` a `KEY_HDMI4`; por isso, a lista e um catalogo de bancada e nao
uma configuracao de producao.

## Caminho seguro para HDMI especifico

1. Confirmar que o GPIO e o LED IR transmitem `KEY_SOURCE` e verificar a
   resposta da TV.
2. Com a TV ligada em uma fonte conhecida, testar uma unica vez, nesta ordem:
   HDMI 1 (`0xE0E09768`), HDMI 2 (`0xE0E07D82`) e HDMI 3 (`0xE0E043BC`).
3. Para cada envio, anotar `aceito`, `ignorado` ou a acao inesperada. Nao
   encadear codigos nem repetir automaticamente.
4. Se um candidato selecionar a entrada correta, repetir pelo menos cinco
   vezes a partir de cada HDMI e do Smart Hub. So promover para Node-RED se o
   resultado for identico em todas as rodadas.
5. Se todos falharem, validar uma macro navegacional somente a partir de um
   estado conhecido: `SOURCE` -> espera curta -> setas -> `ENTER`.
6. Guardar o codigo medido em uma configuracao LIRC versionada e registrar a
   data, firmware e cabos HDMI ligados. Nunca substituir um codigo medido por
   codigo encontrado na Internet.

Enquanto os discretos nao forem medidos, a selecao de fonte deve usar
Home Assistant/controle pela rede quando ele conseguir reportar e selecionar
a fonte correta; IR fica limitado aos comandos confirmados.

## Fontes

- Suporte oficial do modelo e manuais: <https://www.samsung.com/be_fr/support/model/GQ55Q60BAUXZG/>.
- Referencia de formato/codigos Samsung em LIRC: <https://sourceforge.net/p/lirc/mailman/lirc-list/thread/52DEB0CB.20407%40bengt-martensson.de/>.
- Referencia adicional de controle Samsung (modelo UHD diferente): <https://gist.github.com/d03n3rfr1tz3/4c7560ecd042078455e55bee874e84bd>.
- Candidatos discretos HDMI de Samsung antiga: <https://iot.stackexchange.com/questions/5318/how-to-configure-home-assistant-to-get-working-smartir-integration-with-tasmota-ir-over-mqtt> e <https://forum.arduino.cc/t/samsung-and-lg-tv-ir-codes/1145086>.
- Limitacao observada para `KEY_HDMI1` a `KEY_HDMI4`: <https://pub.dev/documentation/samsung/latest/samsung/>.
