# Plano de trabalho

Use [`../CURRENT_STATE.md`](../CURRENT_STATE.md) para o estado confirmado. Este
arquivo contem somente trabalho futuro e criterios de conclusao.

## Prioridade 1 - Restauracao reproduzivel

- [x] manter configs, scripts, firmware, documentacao e interface no GitHub;
- [x] separar credenciais em `backup-private/`;
- [x] sincronizar e verificar o snapshot ativo;
- [ ] testar restauracao da interface e do backend em instalacao limpa;
- [ ] manter copia externa criptografada de `backup-private/`.

Concluido quando uma nova instalacao reproduzir os servicos e as duas paginas
web somente com o repositorio, os pacotes documentados e o backup privado.

## Prioridade 2 - Controle cotidiano

- [x] volume, mute, TV, Spotify e OFF;
- [x] POWER do G20S com mute durante standby e religacao em quatro canais;
- [x] painel web com allowlist e estado dos servicos;
- [ ] implementar macros PC, TV Box, satelite e Nintendo Switch;
- [ ] implementar navegacao e midia;
- [ ] medir latencia e executar teste prolongado do Spotify.

## Prioridade 3 - Audio e medicao

- [ ] medir cada canal com REW;
- [ ] definir curva alvo;
- [ ] alinhar ganhos e atrasos de CENTER e LFE;
- [ ] gerar e validar filtros;
- [ ] recuperar o espectro sem recolocar `camilla_tee` no caminho critico.

## Prioridade 4 - Integracoes futuras

- [ ] Home Assistant/CEC apenas onde IR ou controle local nao bastarem;
- [ ] captura do microfone e voz em bancada sem executar comandos;
- [ ] ferramentas de voz tipadas com confirmacao e limites locais;
- [ ] avaliar TTS e conversa Realtime depois dos controles locais.

## Regras de aceite

- toda mudanca de hardware ou audio deve ter rollback;
- estado de arquivo nao substitui validacao do servico e do comportamento real;
- configuracoes validas devem ser sincronizadas e publicadas no Git;
- itens concluidos devem ser removidos das listas futuras e refletidos em
  `docs/CURRENT_STATE.md`.
