# AGENTS.md - PiCeiver

## Diretriz de execucao neste ambiente

- Neste host, evitar tentativa inicial no sandbox quando a tarefa depende de terminal.
- Executar comandos de terminal diretamente com elevacao (`require_escalated`) para evitar falha por `LandlockRestrict`.
- Evitar pedidos duplicados de autorizacao para a mesma acao.
- Agrupar comandos por etapa para reduzir prompts.

## Diretriz de versionamento

- Sempre que houver atualizacao de documentacao ou configuracao valida do projeto:
1. sincronizar snapshot de configs;
2. commitar no Git;
3. publicar no `origin/main`.

Script de sincronizacao: `scripts/sync_backup_configs.sh`.
