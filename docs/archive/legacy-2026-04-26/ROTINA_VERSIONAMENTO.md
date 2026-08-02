# Rotina De Versionamento

## Objetivo

Manter no GitHub uma copia dos arquivos validos e essenciais para leitura, auditoria e restauracao.

## Processo Padrao

1. Atualizar documentacao (`*.md`) no repositorio.
2. Sincronizar os configs atuais:

```bash
./scripts/sync_backup_configs.sh
```

3. Revisar alteracoes:

```bash
git status -sb
```

4. Commitar:

```bash
git add .
git commit -m "Atualiza documentacao e backup de configuracoes"
```

5. Publicar:

```bash
git push origin main
```

## Escopo Minimo Obrigatorio

- CamillaDSP: configuracao ativa e statefile.
- Node-RED: flows, flows_cred, settings e package.
- Systemd: units dos servicos principais.
- Config de servicos auxiliares (ex.: raspotify).
