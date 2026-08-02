# Session Boot

## Objetivo

Este e o ponto de entrada de baixo custo para retomar o projeto sem abrir
documentos longos desnecessariamente.

## Estado atual em uma leitura

- o Raspberry Pi e o centro do audio e do controle
- a TV segue como hub de video
- o audio passa por ALSA Loopback, CamillaDSP e interface USB multicanal
- Node-RED faz orquestracao de fontes e integracoes
- `backup-config/` e a fonte mais confiavel para configuracao ativa
- `docs/archive/legacy-2026-04-26/` guarda os documentos antigos completos

## Ordem recomendada de leitura

1. `docs/README.md`
2. `AGENTS.md`
3. escolher um unico documento abaixo conforme a tarefa

## Abrir por tema

- controle e automacao:
  - `docs/architecture/control-flows.md`
- stack atual de audio:
  - `docs/architecture/audio-stack-current-state.md`
- objetivo e prioridades:
  - `docs/project/goal-and-scope.md`
  - `docs/project/workplan.md`
- calibracao:
  - `docs/audio/rew-calibration.md`
- trigger eletrico:
  - `docs/hardware/trigger-3v.md`
- rotina operacional:
  - `docs/operations/versioning.md`

## Regras que nao podem ser esquecidas

- nao tratar documentacao como prova de estado se `backup-config/` disser outra coisa
- antes de editar configuracao real, preservar os arquivos relevantes
- evitar abrir `docs/archive/` salvo quando houver necessidade historica
- depois de atualizacao valida, sincronizar `backup-config/` e versionar
