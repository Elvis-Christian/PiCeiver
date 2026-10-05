# Session Boot

Use esta sequencia para retomar o PiCeiver com pouco contexto:

1. ler [CURRENT_STATE.md](CURRENT_STATE.md);
2. executar `git status -sb` em `/home/elvis/PiCeiver`;
3. abrir apenas uma pagina tematica indicada em [README.md](README.md);
4. confirmar no runtime qualquer estado que possa ter mudado;
5. antes de editar uma configuracao viva, preservar o arquivo e sincronizar
   `backup-config/`.

## Verificacao rapida

```bash
systemctl is-active camilladsp camillagui nodered mosquitto raspotify piceiver-g20s tvbox-status.timer
curl -fsS http://127.0.0.1:5005/api/automations
./scripts/verify_backup_configs.sh
```

## Regras

- `docs/CURRENT_STATE.md` resume o ultimo estado confirmado.
- `backup-config/` prova a configuracao capturada do host.
- `apps/camilla-visual-control/` e a fonte da interface instalada em
  `/opt/camillagui`.
- `docs/archive/` e historico e nao deve orientar operacao atual.
- Nunca publicar `backup-private/`, chaves, tokens ou senhas.
