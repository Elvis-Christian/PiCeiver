# Backend da interface no Pi

## Fonte restauravel

- base CamillaGUI 3.0.3:
  `apps/camilla-visual-control/vendor/camillagui-3.0.3/`;
- extensoes do PiCeiver: `apps/camilla-visual-control/pi-backend/`;
- dependencias observadas no venv:
  `apps/camilla-visual-control/pi-backend/requirements-lock.txt`;
- instalacao ativa: `/opt/camillagui/`;
- unit: `backup-config/systemd/camillagui.service`.

A base preservada foi extraida do arquivo usado na instalacao, cujo SHA-256 e:

```text
83447ae9fdefc0cbb9dafe07737aca25402ec64308873faa7cbe753cb5ae1fe2
```

## Sobreposicoes

`pi-backend/main.py` registra:

- rotas originais do CamillaGUI;
- espectro em `pi-backend/spectrum.py`;
- central allowlisted em `pi-backend/automations.py`;
- arquivos estaticos.

`pi-backend/camillagui.yml` aponta para os perfis em
`/opt/dspstack/camilladsp`. O backend nunca aceita uma linha de shell enviada
pelo navegador; cada acao precisa existir na allowlist.

## Espectro sob demanda

O frontend consulta `/api/spectrum` somente com a pagina visivel. A primeira
consulta inicia `usb-spectrum-tap`, que observa em modo leitura os pacotes de
playback da placa `ICUSBAUDIO7D` (`0d8c:0102`, endpoint 6) por `usbmon`. O
processo para apos 4 segundos sem consultas. Ele nao abre ALSA nem modifica
o caminho de audio; o CamillaDSP continua usando `hw:ICUSBAUDIO7D,0`.
Nos pacotes isocronos, `usbmon` antepoe um descritor de 16 bytes por quadro
USB. O helper valida esses descritores e entrega ao FFT somente PCM; sem essa
separacao, o espectro perde amostras e mostra frequencias incorretas.

O helper e instalado com dono root em
`/usr/local/libexec/piceiver/usb-spectrum-tap`; o backend usa apenas o
comando permitido em `usb-spectrum-tap.sudoers`. O helper abandona privilegios
assim que abre `/dev/usbmonN` e entrega apenas PCM da saida selecionada. O
modulo `usbmon` e carregado no boot por `usbmon.conf`, mas nao captura audio
ate a pagina requisitar o espectro. Se o tap falhar, apenas o grafico fica
indisponivel; a reproducao continua intacta. Nao reintroduzir `camilla_tee`.

## Restauracao

1. copiar a base 3.0.3 para `/opt/camillagui`;
2. criar o venv e instalar as dependencias registradas;
3. compilar `usb-spectrum-tap.c` com `gcc -O2 -Wall -Wextra -Werror` e instalar
   o binario em `/usr/local/libexec/piceiver/usb-spectrum-tap`, dono root e
   modo 0755; instalar `usb-spectrum-tap.sudoers` em
   `/etc/sudoers.d/piceiver-spectrum` (root, 0440) e conferir com
   `visudo -cf /etc/sudoers`; instalar `usbmon.conf` em
   `/etc/modules-load.d/piceiver-usbmon.conf` e carregar `usbmon`;
4. sobrepor `main.py`, `spectrum.py`, `automations.py` e a configuracao;
5. gerar o frontend com `npm ci && npm run build:pi`;
6. publicar `pi-dist/` em `/opt/camillagui/build/control/`;
7. instalar a unit versionada, habilitar e iniciar `camillagui`;
8. validar as duas paginas, `/api/automations`, `/api/spectrum` com sinal, o
   desligamento automatico do helper e os logs.

Preservar a instalacao anterior antes de qualquer substituicao.
