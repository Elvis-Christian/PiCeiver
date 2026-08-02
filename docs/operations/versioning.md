# Versioning

## Objetivo

Manter no Git uma copia util dos arquivos validos e essenciais para leitura,
auditoria e restauracao.

## Processo padrao

1. atualizar a documentacao relevante
2. sincronizar os configs atuais:

```bash
./scripts/sync_backup_configs.sh
```

3. revisar alteracoes:

```bash
git status -sb
```

4. commitar:

```bash
git add .
git commit -m "Atualiza documentacao e backup de configuracoes"
```

5. publicar:

```bash
git push origin main
```

## Escopo minimo obrigatorio

- CamillaDSP: configuracao ativa e statefile
- Node-RED: flows, flows_cred, settings e package
- systemd: units dos servicos principais
- configs auxiliares relevantes, como raspotify

## Fontes confiaveis

- `backup-config/` para configuracoes rastreaveis
- `docs/` para diretriz e contexto
- `docs/archive/` apenas para consulta historica
