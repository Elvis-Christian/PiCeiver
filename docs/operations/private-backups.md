# Backup privado

Este diretorio recebe arquivos necessarios para restaurar credenciais do
Node-RED, mas seu conteudo e ignorado pelo Git.

Depois de executar `scripts/sync_backup_configs.sh`, copiar este diretorio para
um armazenamento externo criptografado. O GitHub nao e o backup destes itens.

Arquivos esperados quando existirem:

- `nodered/settings.js`;
- `nodered/flows_cred.json`;
- `nodered/config.runtime.json`.

O snapshot publico de `settings.js` contem apenas um marcador no campo de
senha. Sem os arquivos privados do mesmo snapshot, a autenticacao e as
credenciais criptografadas podem nao ser recuperaveis. Nunca commitar esses
arquivos nem enviar seus valores em logs, mensagens ou documentacao.
