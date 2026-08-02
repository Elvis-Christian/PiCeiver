# Backup Config

Snapshot versionado das configuracoes essenciais do ambiente.

## Estrutura

- `camilladsp/`: arquivo ativo do DSP e statefile.
- `nodered/`: flows e configuracao principal do Node-RED.
- `systemd/`: units dos servicos principais.
- `raspotify/`: configuracao do servico.
- `alsa/`: estado de mixer e configuracao global ALSA (`asound.state`, `asound.conf`).
- `system/`: configs auxiliares (logrotate etc.).

## Restauracao (referencia)

Exemplo para restaurar unit do CamillaDSP:

```bash
sudo cp backup-config/systemd/camilladsp.service /etc/systemd/system/camilladsp.service
sudo systemctl daemon-reload
sudo systemctl restart camilladsp
```

## Observacao

Alguns arquivos de sistema podem exigir permissao de root para leitura e copia.
