# Inventario Externo - Raspberry Pi `piht`

## Identificacao

- Hostname: `piht`
- IP principal: `192.168.178.117`
- Usuario de acesso validado nesta rodada: `elvis`
- Data da revisao: 2026-03-30
- Tipo: Raspberry Pi
- Papel operacional: central de audio e controle do projeto `PiCeiver`

## Sistema

- SO: Debian GNU/Linux 13 `trixie`
- Kernel: `6.12.62+rpt-rpi-v8`
- Arquitetura: `arm64`

## Recursos observados

- RAM total: `905 MiB`
- Swap total: `904 MiB`
- Disco raiz: `58G`
- Uso do disco raiz: `7.6G` usados, `49G` livres (`14%`)

## Rede

- Interface principal: `eth0`
- IPv4 principal: `192.168.178.117/24`
- Interface adicional observada: `docker0` em `172.17.0.1/16`, atualmente `DOWN`

## Projeto encontrado

Documentacao principal localizada em:

- `/home/elvis/PiCeiver/README.md`
- `/home/elvis/PiCeiver/OBJETIVO_PROJETO.md`
- `/home/elvis/PiCeiver/ARQUITETURA_CONTROLE.md`
- `/home/elvis/PiCeiver/docs/project/workplan.md`
- `/home/elvis/PiCeiver/docs/operations/config-backups.md`

Leitura funcional resumida:

- o Pi atua como centralizador/orquestrador de audio e controle domestico
- foco em audio multicanal, automacao e controle de TV/fontes
- integracoes citadas:
  - CamillaDSP
  - CamillaGUI
  - Node-RED
  - MQTT
  - IR via `lircd`
  - Spotify Connect
  - Home Assistant

## Servicos ativos relevantes

- `camilladsp.service`
- `camillagui.service`
- `nodered.service`
- `mosquitto.service`
- `lircd.service`
- `raspotify.service`
- `toslink-to-loopback.service`
- `ssh.service`

## Portas observadas

- `22/tcp` SSH
- `1880/tcp` Node-RED
- `5005/tcp` CamillaGUI; interface web do CamillaDSP acessivel pela LAN em `http://192.168.178.117:5005/gui/index.html`
- `1883/tcp` Mosquitto em loopback
- `1234/tcp` API do CamillaDSP em loopback (`127.0.0.1`); nao acessivel diretamente pela LAN

## Node-RED

Estado observado:

- diretoria: `/home/elvis/.node-red`
- arquivos principais:
  - `flows.json`
  - `flows_cred.json`
  - `settings.js`
- unit file ajustado para rodar como `elvis`

Leitura funcional dos fluxos:

- os fluxos observados trabalham principalmente com:
  - comandos de IR
  - selecao de fonte de audio
  - macros para TV Box, PC, satelite e Switch
  - publicacao/assinatura MQTT local

## Relacao com a VM 110 `gpt-gateway`

Nesta rodada, foi feita busca por referencias a:

- `gpt-gateway`
- `192.168.178.55`
- `/gpt-note`
- `repository_dispatch`
- `github`
- `8080`

Resultado:

- nenhuma referencia encontrada em `~/PiCeiver`
- nenhuma referencia encontrada em `~/.node-red`
- nao apareceu evidencia de integracao do Pi com a VM `110`

Conclusao operacional atual:

- o Raspberry Pi `piht` parece ser um projeto separado, focado em audio/controle
- nesta rodada nao ha indicio documental nem funcional de dependencia do `110 gpt-gateway`

## Pendencias

- se necessario, aprofundar leitura dos fluxos completos do Node-RED
- mapear se o Pi usa Docker de forma relevante ou se `docker0` e apenas resquicio
- decidir se este host deve entrar em rotina propria de inventario continuo

## Atualizacao 2026-07-18 - CamillaDSP

- `camilladsp.service` encontrado `inactive (dead)` desde `2026-05-17 07:37:52 CEST`
- encerramento anterior registrado como limpo: `status=0/SUCCESS`; causa exata indisponivel por rotacao dos logs
- reboot descartado: boot continuo do Pi desde `2026-02-09 22:39`
- configuracao viva validada como identica a `PiCeiver/backup-config/camilladsp/camilladsp.yml`
- servico iniciado por solicitacao do usuario em `2026-07-18 19:32:21 CEST`
- validacao pos-inicio:
  - `active (running)` com `NRestarts=0`
  - API local em `127.0.0.1:1234`
  - estado CamillaDSP `ProcessingState.RUNNING`
  - `StopReason.NONE`
  - nenhum warning ou erro no journal da nova execucao
  - `camillagui`, `nodered`, `mosquitto`, `raspotify` e `toslink-to-loopback` permaneceram ativos
- rollback operacional: `sudo systemctl stop camilladsp`

## Atualizacao 2026-07-26 - Acesso web ao CamillaDSP

- URL correto da interface: `http://192.168.178.117:5005/gui/index.html`.
- Confirmado HTTP `200`, titulo `CamillaDSP`, servido por `camillagui.service` (aiohttp).
- Motivo: o processo CamillaDSP usa a porta `1234` somente em `127.0.0.1`; a interface LAN e fornecida pelo CamillaGUI na porta `5005`.

## Atualizacao 2026-07-26 - Candidatos IR HDMI da TV Samsung

- TV alvo: Samsung Q60B `GQ55Q60BAUXZG` em `192.168.178.35`.
- Candidatos de TVs Samsung antigas para teste pelo emissor IR do GPIO:
  - HDMI 1: `0xE0E09768` (LIRC com `pre_data 0xE0E0`: `0x9768`)
  - HDMI 2: `0xE0E07D82` (LIRC: `0x7D82`)
  - HDMI 3: `0xE0E043BC` (LIRC: `0x43BC`)
- Nenhum codigo foi testado ou validado nesta Q60B; ficam fora de macros/Node-RED ate validacao manual repetivel.
- Catalogo completo, parametros de portadora e procedimento de bancada: `PiCeiver/docs/hardware/samsung-gq55q60bau-ir.md`.

## Atualizacao 2026-07-26 - Bluetooth onboard reativado

- Hardware confirmado: Raspberry Pi 3 Model B Rev 1.2, com adaptador Bluetooth onboard.
- Causa do estado inativo: `/boot/firmware/config.txt` continha `dtoverlay=disable-bt`.
- Protecao: copia anterior em `/boot/firmware/config.txt.pre-enable-bt-20260726` e em `PiCeiver/backup-config/boot/config.txt.pre-enable-bt-20260726`.
- Execucao: a diretiva foi comentada; reboot do Pi concluido.
- Validacao: `hci0` presente; controlador `B8:27:EB:81:71:B1` com `Powered: yes`; `bluetooth.service` `active` e `enabled`.
- Pos-reboot: `camilladsp`, `camillagui`, `nodered`, `mosquitto`, `raspotify` e `toslink-to-loopback` ativos.
- Seguranca: adaptador permanece `Pairable: no` e `Discoverable: no` ate um pareamento solicitado.
- Rollback: restaurar `config.txt.pre-enable-bt-20260726` como `/boot/firmware/config.txt` e reiniciar.

## Atualizacao 2026-07-27 - Controle Bluetooth G20S PRO

- Controle remoto/air mouse pareado via Bluetooth no `piht`.
- Dispositivo: `G20S PRO`, MAC `69:98:98:22:F7:43`.
- Perfil confirmado: `Human Interface Device` (`00001812-0000-1000-8000-00805f9b34fb`), com bateria exposta via `Battery Service`.
- Estado validado durante o pareamento:
  - `Paired: yes`
  - `Bonded: yes`
  - `Connected: yes`
  - bateria observada em `73%`
- Entradas criadas pelo kernel:
  - `G20S PRO Keyboard` em `event3`
  - `G20S PRO Mouse` em `event4`
  - `G20S PRO` em `event5`
- Acao recomendada apos pareamento: manter o dispositivo como trusted (`bluetoothctl trust 69:98:98:22:F7:43`) e deixar `discoverable off` / `pairable off` fora de janelas de pareamento.
- Observacao: comandos de teclado/mouse estao expostos como HID; recursos de voz/microfone dependem de servico vendor-specific e ainda nao foram validados.
- Rollback: `bluetoothctl remove 69:98:98:22:F7:43`.

## Atualizacao 2026-07-27 - Controle G20S PRO programado

- Servico instalado e habilitado: `piceiver-g20s.service`.
- Codigo fonte no projeto:
  - `/home/elvis/PiCeiver/scripts/g20s_control.py`
  - `/home/elvis/PiCeiver/scripts/piceiver_control.py`
  - `/home/elvis/PiCeiver/config/g20s-buttons.json`
- Unit versionada em `/home/elvis/PiCeiver/backup-config/systemd/piceiver-g20s.service`.
- O listener detecta o HID `G20S PRO Keyboard` por nome e MAC, sem depender do numero instavel `eventN`.
- Topico MQTT publicado: `piceiver/control/action`, com JSON contendo acao semantica, origem Bluetooth, MAC, codigo da tecla, nome da tecla e evento.
- Acoes locais validadas:
  - volume e mute via API local do CamillaDSP;
  - TV, Spotify e OFF via `/home/elvis/PiCeiver/scripts/audio_source_switch.py`;
  - navegacao, midia curta e voz ainda apenas encaminhadas como acoes semanticas.
- Mapeamento principal:
  - `VOL+`/`VOL-`: `volume_up`/`volume_down`, passo `2 dB`, limite `0 dB`;
  - `MUTE`: `toggle_mute`;
  - `HOME` longo (`1.0 s`): `select_tv`;
  - `PLAY/PAUSE` longo (`1.0 s`): `select_spotify`;
  - `POWER` longo (`1.5 s`): `power_off`;
  - `MIC`: `voice_button_pressed`.
- Protecao contra fila atrasada: eventos HID com mais de `2 s` sao descartados antes de executar acao.
- Observacao do MIC: `KEY_VOICECOMMAND` (`582`) gerou press/release em cerca de `22 ms`; via EV_KEY, nao serve como push-to-talk classico sem logica de captura temporizada/toggle ou investigacao vendor-specific.
- Validacao:
  - servico `active` e escutando `/dev/input/event3`;
  - botoes fisicos de volume responderam e respeitaram limite superior `0 dB`;
  - executor local validado para `select_spotify`, `select_tv`, volume e mute;
  - estado final: CamillaDSP `RUNNING`, fonte TV, volume `0.0 dB`, mute `False`;
  - `camilladsp`, `nodered`, `mosquitto`, `raspotify` e `bluetooth` permaneceram ativos.
- Acesso SSH para esta sessao: criada chave publica em `/home/elvis/.ssh/authorized_keys`, fingerprint `SHA256:/G48FKXRfcK+7eFqbyEHfXavocvfxMiI8Fdfl9W8+zA`.
- Rollback do controle: `sudo systemctl disable --now piceiver-g20s.service`; remover `/etc/systemd/system/piceiver-g20s.service`; `sudo systemctl daemon-reload`.
- Rollback de acesso SSH desta sessao: remover a chave publica com fingerprint `SHA256:/G48FKXRfcK+7eFqbyEHfXavocvfxMiI8Fdfl9W8+zA` de `/home/elvis/.ssh/authorized_keys`.

## Atualizacao 2026-08-02 - POWER do G20S controla o Kenwood

- POWER, curto ou longo, executa somente `toggle_amplifier_power` no M-AX7; nenhuma duracao envia `power_off` ao PiCeiver.
- Helper instalado no projeto: `/home/elvis/PiCeiver/scripts/kenwood_sl16_control.py`.
- Controlador localizado por `/dev/serial/by-id/usb-FTDI_FT232R_USB_UART_A50285BI-if00-port0` e validado com `STATUS busy=0 data=0` sem acionar energia.
- O executor aplica mute somente durante o SL16; depois de ligar ou desligar com sucesso, sempre define `CamillaDSP mute=false`, preservando os demais amplificadores ativos.
- Estado persistente: `/home/elvis/PiCeiver/runtime/kenwood-state.json`, atualizado somente depois da confirmacao serial.
- Limitacao: o SL16 nao informa o estado fisico de energia. Com estado desconhecido, o primeiro comando e sempre `on`; mudancas manuais ou perda externa de energia podem exigir resincronizacao.
- Protecao do Pi: listener com `EVIOCGRAB` e `systemd-logind` configurado com `HandlePowerKey=ignore` e `HandlePowerKeyLongPress=ignore`.
- O Raspberry Pi deve permanecer sempre ligado; o POWER Bluetooth nunca pode acionar shutdown, reboot ou suspend.

## Atualizacao 2026-07-26 - Estado seguro da TV Box para Node-RED

- Instalado `tvbox-status.timer`, habilitado para iniciar apos reboot e executar a cada `20 s`.
- O servico `tvbox-status.service` executa como `elvis` e atualiza atomica e localmente:
  - `/home/elvis/PiCeiver/runtime/tvbox-status.json`
- Contrato para Node-RED: JSON somente com `status` (`active` ou `inactive`) e `checked_at` em ISO-8601.
- Decisao de seguranca: tres pings curtos para `192.168.178.29`; qualquer resposta resulta em `active`; somente ausencia completa resulta em `inactive`. Isso evita falso desligado e um toggle de energia invertido.
- Fonte do script e das units: `PiCeiver/scripts/tvbox_status_probe.sh`, `PiCeiver/backup-config/systemd/tvbox-status.service` e `tvbox-status.timer`.
- Validacao: timer `enabled` e `active`; arquivo atualizado apos `20 s` com status `active`.
- Rollback: `sudo systemctl disable --now tvbox-status.timer` e remover as units de `/etc/systemd/system/`.

## Atualizacao 2026-07-27 - Headroom do CamillaDSP

- Contador acumulado encontrado em `703598` clipped samples; nenhuma nova ocorrencia em duas janelas de 20 s.
- Causa provavel confirmada na configuracao: CENTER somava L/R com `+5 dB` por entrada e nao havia atenuacao global antes da saida S16LE.
- Adicionado filtro `output_headroom_12db` de `-12 dB` nos seis canais, depois de `route_inputs` e `stereo_widen`.
- Configuracao validada e carregada ao vivo; CamillaDSP permaneceu `RUNNING`, sem warnings.
- Configuracao ativa e snapshot `PiCeiver/backup-config/camilladsp/camilladsp.yml` sincronizados, SHA-256 `27d9b6bdeaf37ca9a029b554cac0767f6c0161c1be98a78588eedb520963e500`.
- Protecao e rollback: arquivos `camilladsp.yml.pre-headroom-20260727-155743` em `/opt/dspstack/camilladsp/` e no snapshot do projeto.

## Atualizacao 2026-07-27 - Buffer e rate adjust do CamillaDSP

- Confirmadas rajadas de leituras ALSA curtas na captura: CamillaDSP solicitava `1024` frames e recebia apenas `64-192`.
- Causa configuracional: `target_level: 0` com `enable_rate_adjust: true`; o ajuste ficava saturado em `1.005` e reduzia excessivamente a margem do buffer.
- Alterado somente `target_level` para `1024`, igual ao `chunksize`; `queuelimit` permaneceu em `3`.
- Em 30 s de validacao, buffer convergiu para aproximadamente `924-926`, `rate_adjust` ficou proximo de `1.00005` e nao houve novo warning, clip ou parada.
- Pi sem throttling, carga DSP baixa e nenhum reset/erro USB observado.
- Protecao: `camilladsp.yml.pre-target1024-20260727-160457` no diretorio ativo e no snapshot do projeto.

## Atualizacao 2026-07-27 - Blocos de 1200 frames no CamillaDSP

- O pipoco reapareceu com nova rajada de leituras curtas, apesar de `target_level: 1024`.
- Reinicio controlado do CamillaDSP zerou o contador acumulado; ainda foram observadas leituras de `960/1024` frames.
- Confirmado que o `alsaloop` TOSLINK negocia naturalmente `period_size: 1200` a `48000 Hz`.
- Teste de forcar periodo `1024` no `alsaloop` causou underruns e foi revertido integralmente.
- Solucao ativa: CamillaDSP com `chunksize: 1200` e `target_level: 1200` (`25 ms`), mantendo `queuelimit: 3` e `48 kHz`.
- A janela imediatamente posterior ao transitorio ficou limpa; estado observado: buffer `981`, rate adjust `0.9999684`, carga `3.64%`, clipped samples `0`.
- Novos underruns do `toslink-to-loopback.service` reapareceram entre `16:29:43` e `16:31:31`; a instabilidade do caminho TOSLINK/Loopback permanece em investigacao.
- Protecao: `camilladsp.yml.pre-chunk1200-20260727`; rollback por restauracao e restart de `camilladsp.service`.

## Atualizacao 2026-07-27 - Diagnostico do LFE

- ALSA: canal Woofer em `100%`, `0.00 dB`, ligado; mapa USB correto para LFE no indice `3`.
- LFE filtrado entre `20-80 Hz` por Linkwitz-Riley de quarta ordem.
- Runtime observado: LFE `+5 dB` por entrada L/R e CENTER `+10 dB` por entrada; arquivo persistido mantem respectivamente `+2 dB` e `+5 dB`.
- Em 20 s, LFE atingiu aproximadamente `-35 dBFS`, sem evidencia de atenuacao digital anormal; CENTER ficou cerca de `15 dB` acima nos picos observados.
- Diagnostico: CENTER excessivamente dominante e banda estreita do sub explicam o LFE percebido como baixo; falha ALSA nao confirmada.
- Nenhuma alteracao de ganho aplicada nesta etapa.

## Atualizacao 2026-07-27 - Arquitetura permanente TV/Spotify sem alsaloop

- O caminho instavel `TOSLINK -> alsaloop -> Loopback -> CamillaDSP` foi retirado da operacao normal; `toslink-to-loopback.service` esta `disabled` e `inactive`.
- O CamillaDSP agora troca entre duas configuracoes de captura direta:
  - TV/TOSLINK: `/opt/dspstack/camilladsp/camilladsp-tv.yml`, captura `plughw:3,0`, `S16LE`, 2 canais, `48 kHz`, blocos/alvo `1200`;
  - Spotify: `/opt/dspstack/camilladsp/camilladsp-spotify.yml`, captura `plughw:Loopback,1,0`, `S32LE`, 2 canais, `48 kHz`, blocos/alvo `1024`.
- `/opt/dspstack/camilladsp/camilladsp.yml` e link simbolico para `camilladsp-tv.yml`, portanto TV e a fonte padrao apos reboot ou restart.
- `raspotify.service` permanece ativo e escreve em `plughw:Loopback,0,0`; Spotify nao depende do `toslink-to-loopback.service`.
- Troca de fonte: `/home/elvis/PiCeiver/scripts/audio_source_switch.py {tv|spotify|off}`; integrado ao fluxo Node-RED `Audio Switch (simple)` e ao topico MQTT `audio/source/set`.
- Estado persistido/observavel: `/home/elvis/PiCeiver/runtime/audio-source.json`.
- Headroom final: `-12 dB` em `FL,FR,FC,RL,RR`; LFE sem essa atenuacao e com limiter dedicado em `-1 dBFS` apos os filtros `20-80 Hz`.
- Testes aprovados: troca local e MQTT entre TV/Spotify, OFF, retorno a TV e restart do CamillaDSP. Estado final `RUNNING`, TV direta, sem novos clips ou leituras curtas na janela final.
- Validacao pendente nao bloqueante: reproducao real prolongada via Spotify para confirmar estabilidade sonora durante uma faixa completa.
- Projeto sincronizado: configs em `PiCeiver/backup-config/camilladsp/`, fluxo atual em `PiCeiver/backup-config/nodered/flows.json` e arquitetura em `PiCeiver/docs/architecture/audio-stack-current-state.md`.
- Backups de rollback com sufixo `.pre-direct-sources-20260727-1648` em CamillaDSP, Node-RED e documento de arquitetura.
