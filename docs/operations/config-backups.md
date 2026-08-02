# Backup Config

Snapshot versionado das configuracoes essenciais do ambiente.

## Estrutura

- `camilladsp/`: arquivo ativo do DSP e statefile.
- `nodered/`: flows e configuracao nao secreta do Node-RED.
- `systemd/`: units dos servicos principais.
- `systemd/piceiver-g20s.service`: listener persistente do controle Bluetooth
  G20S PRO.
- `systemd/logind.conf.d/90-piceiver-ignore-power-key.conf`: impede que
  `KEY_POWER` curto ou longo desligue o Raspberry Pi.
- `systemd/tvbox-status.service` e `systemd/tvbox-status.timer`: monitor
  persistente do estado da TV Box para consumo pelo Node-RED.
- `raspotify/`: configuracao do servico.
- `alsa/`: estado de mixer e configuracao global ALSA (`asound.state`, `asound.conf`).
- `mosquitto/`: broker MQTT e includes locais.
- `boot/`: configuracao de boot relevante; nao inclui `cmdline.txt` dependente
  do disco.
- `system/`: modulos, inventario, servicos habilitados e configs auxiliares.

## Cobertura do baseline

Em `2026-07-21`, os arquivos ativos de CamillaDSP, ALSA, Node-RED, systemd e
Raspotify ja presentes no snapshot foram comparados por SHA-256 e estavam
identicos. O baseline foi ampliado com:

- override efetivo do Raspotify para `plughw:Loopback,0,0`;
- Mosquitto;
- carregamento de `snd-aloop` e `i2c-dev`;
- configuracao de boot;
- servicos habilitados;
- versoes e hashes dos binarios principais.

O inventario detalhado esta em
[`software-baseline.md`](software-baseline.md).

## Segredos

Este repositorio e publico. `flows_cred.json`, `config.runtime.json`, tokens,
senhas e chaves nao podem permanecer em `backup-config/`.

A rotina de sincronizacao grava os dois arquivos secretos do Node-RED em
`backup-private/nodered/`, ignorado pelo Git. Depois da sincronizacao, copiar
`backup-private/` para armazenamento externo criptografado. No baseline de
`2026-07-21`, a credencial criptografada foi auditada localmente e nao continha
campos de usuario, senha ou token.

Uma chave gerada anteriormente permanece no historico publico do Git. Ela deve
ser considerada conhecida. Antes de adicionar qualquer credencial real ao
Node-RED, gerar uma nova chave e confirmar que os novos arquivos privados nao
estao rastreados. Remover a chave antiga de todo o historico exigiria reescrita
destrutiva do repositorio e nao faz parte deste baseline.

## Restauracao (referencia)

Exemplo para restaurar unit do CamillaDSP:

```bash
sudo cp backup-config/systemd/camilladsp.service /etc/systemd/system/camilladsp.service
sudo systemctl daemon-reload
sudo systemctl restart camilladsp
```

Para uma recuperacao completa, usar primeiro o modo de simulacao:

```bash
./scripts/restore_backup_configs.sh
```

O script nao escreve nada sem `--apply`, cria uma copia dos arquivos atuais
antes de sobrescrever e nao reinicia servicos automaticamente. Procedimento
completo: [`disaster-recovery.md`](disaster-recovery.md).

Para confirmar se o runtime ainda corresponde ao baseline:

```bash
./scripts/verify_backup_configs.sh
```

## Observacao

Alguns arquivos de sistema podem exigir permissao de root para leitura e copia.
Execute a sincronizacao no proprio Pi e resolva qualquer `FAIL` antes de
considerar o snapshot completo.
