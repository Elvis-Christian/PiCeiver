# AGENTS.md - PiCeiver

## Objetivo

Manter o projeto enxuto em contexto: ler primeiro o minimo necessario,
agir sobre o arquivo certo e evitar abrir documentos longos por habito.

## Leitura minima por tipo de tarefa

### Boot de sessao

Ler nesta ordem:

1. `docs/CURRENT_STATE.md`
2. `docs/SESSION_BOOT.md`
3. apenas o documento tematico necessario

### Tarefas de arquitetura e controle

- `docs/architecture/control-flows.md`
- `docs/project/goal-and-scope.md`

### Tarefas de audio e runtime

- `docs/architecture/audio-stack-current-state.md`
- `backup-config/camilladsp/camilladsp.yml`
- `backup-config/nodered/flows.json`

### Tarefas operacionais

- `docs/operations/versioning.md`
- `docs/operations/config-backups.md`
- `scripts/sync_backup_configs.sh`

### Tarefas eletricas e calibracao

- `docs/hardware/trigger-3v.md`
- `docs/audio/rew-calibration.md`

## Regras de contexto

- Nao abrir `docs/archive/` salvo quando precisar consultar historico.
- Preferir arquivos em `docs/` antes dos backups brutos.
- Para a interface, editar `apps/camilla-visual-control/`; nunca usar uma
  copia em pasta temporaria como fonte canonica.
- Se a tarefa for pontual, abrir um unico documento tematico e so depois
  escalar para os demais.
- Ao resumir estado atual, distinguir claramente entre estado confirmado
  em `backup-config/` e diretriz/proposta presente na documentacao.

## Regras de execucao neste ambiente

- Se a tarefa depende de terminal, preferir executar comandos diretamente
  em vez de planejar passos longos sem validacao.
- Agrupar comandos por etapa para reduzir idas e voltas.
- Nao alterar configuracoes vivas sem antes preservar ou sincronizar os
  arquivos relevantes em `backup-config/`.

## Regra de versionamento

Sempre que houver atualizacao valida de documentacao ou configuracao:

1. sincronizar snapshot de configs;
2. revisar alteracoes;
3. commitar no Git;
4. publicar no `origin/main`.
