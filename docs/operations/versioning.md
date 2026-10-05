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

3. validar o snapshot:

```bash
./scripts/verify_backup_configs.sh
```

4. revisar alteracoes e procurar credenciais:

```bash
git status -sb
```

5. commitar:

```bash
git add .
git commit -m "Atualiza documentacao e backup de configuracoes"
```

6. publicar:

```bash
git push origin main
```

## Escopo minimo obrigatorio

- CamillaDSP: configuracao ativa e statefile
- Node-RED: flows, flows_cred, settings e package
- systemd: units dos servicos principais
- configs auxiliares relevantes, como raspotify
- codigo-fonte da interface em `apps/camilla-visual-control/`
- scripts operacionais, units systemd e firmware

Nao versionar `runtime/`, builds, caches, dependencias, backups datados ou
`backup-private/`.

## Fontes confiaveis

- `backup-config/` para configuracoes rastreaveis
- `docs/` para diretriz e contexto
- `docs/archive/` apenas para consulta historica
