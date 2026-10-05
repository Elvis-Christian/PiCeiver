# Passagem de desenvolvimento — 28 de julho de 2026

## Ponto de retomada

O sistema está implantado e operacional no Raspberry Pi `piht`.

- Interface: `http://piht.local:5005/gui/control/index.html`
- CamillaDSP: `RUNNING`
- CamillaGUI: `active`
- Perfil ativo no encerramento: `teste.yml`
- Perfis independentes visíveis: `camilladsp.yml`, `camilladsp-tv.yml`, `camilladsp-spotify.yml` e `teste.yml`
- Arquitetura do Pi: `aarch64`
- Branch: `main`
- Último commit funcional antes desta documentação: `1759004`

O usuario decidiu continuar o desenvolvimento em uma nova task. A nova task deve comecar lendo este documento, `overview.md`, `pi-backend.md` e o estado atual do Git antes de alterar codigo.

> Atualização de 2 de agosto de 2026: o Patchbay ganhou uma primeira camada somente de leitura após este handoff. A especificação funcional, regras de segurança, arquitetura e plano de implementação estão em [patchbay.md](../development/camilla-visual-control/patchbay.md). Esse documento deve ser lido antes de qualquer alteração em mixers ou no pipeline.

## O que foi concluído

### Interface e layout

- Visual analógico escuro e compacto, voltado para uma tela Full HD sem rolagem na tela principal.
- Cabeçalho compacto com volume mestre, mute, dim, pico da saída e estado de persistência YAML.
- Coluna estreita com seis saídas, mini-VU, ganho individual e LED de mute.
- Área de espectro reduzida para reservar altura aos editores de filtro.
- Cartões de filtros responsivos: botão de inserção pequeno na primeira posição e até cinco filtros na primeira linha.
- Modal de perfis compactado para caber integralmente em Full HD.

### Medição e espectro

- VUs de duas entradas e seis saídas via `/api/status`.
- Volume mestre sincronizado continuamente via `/api/getparamjson/faders`.
- Espectro real pós-DSP somente do canal selecionado.
- Atualização nominal do espectro: 15 Hz.
- Backend usa ALSA loopback e `camilla_tee` para obter as seis saídas sem FFT dentro do navegador.
- Linhas de pico dos mini-VUs foram tornadas estreitas e discretas.

### Filtros

- Pipeline e filtros são reconstruídos do YAML ativo.
- Instâncias compartilhadas mantêm identidade por nome YAML em todos os canais que as usam.
- Catálogo de criação cobre os tipos catalogados em `app/filter-catalog.ts` e apresenta campos específicos, prévia técnica e explicação.
- Novo filtro recebe os canais de destino na criação e entra automaticamente no pipeline.
- Edição estrutural: mover, bypass, rotear, duplicar e excluir.
- Curvas e âncoras usam frequência real como rótulo.
- GEQ aceita 15 bandas em uma linha, com sliders altos, âncoras no gráfico e reset a 0 dB por duplo clique.

### Controles do DSP

- Controles são aplicados ao soltar o mouse; roda do knob usa debounce de 180 ms.
- Ganho individual por saída: −20 a +15 dB, passos de 0,5 dB.
- O knob aceita arraste, teclado, roda do mouse e duplo clique para 0 dB.
- Mute individual atua em `route_inputs` e também no último mixer da cadeia. Isso corrige o canal 0, que ainda recebia crossfeed de `stereo_widen`.
- Volume mestre é deliberadamente mais ativo que os demais controles e não muda a geometria durante o estado `APLICANDO`.

### Perfis YAML

- Nome do YAML ativo e em edição aparece de forma evidente.
- Botão de salvar mostra exatamente o arquivo de destino e cria backup com timestamp.
- Gerenciador permite carregar um perfil disponível no DSP.
- É possível criar um novo perfil como cópia independente de um existente, sem sobrescrever arquivos.
- Transferência seletiva entre perfis: crossovers, equalização, proteção/alinhamento e mixer/roteamento.
- Captura, dispositivos e infraestrutura de espectro do destino são protegidos.
- Carregar um perfil legado executa `ensureSpectrumInfrastructure`.
- O perfil Spotify foi preparado com o canal central mutado durante a sessão de configuração no Pi.

### Patchbay — atualização posterior

- O nome Patchbay foi adotado para a área conjunta de mixers e pipeline.
- A primeira camada reconstrói visualmente captura, etapas do pipeline e playback.
- Mixers podem ser selecionados e sua matriz de destinos, fontes, ganho e mute pode ser inspecionada.
- A camada atual não edita o YAML.
- A edição futura prevê modo de mesa, modo de pipeline compacto, conexões por arrastar e soltar, rascunho, validação, aplicação explícita e rollback.
- A especificação normativa está em [patchbay.md](../development/camilla-visual-control/patchbay.md); este handoff não deve ser usado como substituto dela.

## Decisões arquiteturais importantes

1. O frontend é hospedado no Pi para usar as APIs same-origin do CamillaGUI e refletir o estado real do DSP.
2. A aplicação não edita arquivos diretamente pelo navegador; usa endpoints do backend, validação CamillaDSP e backups.
3. Aplicar e persistir são estados diferentes: `setconfig` altera o DSP ao vivo; `saveconfigfile` grava o YAML somente quando solicitado.
4. O espectro é calculado no backend a partir de um tap ALSA pós-DSP. Apenas um canal é entregue à interface por vez.
5. Os dispositivos ativos são relidos e preservados antes de cada aplicação para evitar regressões ao alternar perfis ou editar filtros.
6. Um filtro compartilhado não é copiado por canal. A referência YAML comum deve continuar sendo a fonte de verdade.

## Pontos de atenção

- O perfil ativo no encerramento é `teste.yml`, criado pelo novo gerenciador; confirmar com o usuário se esse deve continuar ativo antes de mudanças de áudio.
- O repositório remoto é interno (`git.chatgpt-team.site`) e a branch local estava 36 commits à frente de `origin/main` antes do commit desta documentação. Não assumir que houve push.
- `npm run lint` inclui artefatos minificados antigos em `pi-dist` e pode gerar centenas de warnings; use `npx eslint app` para validar o código-fonte até o script ser corrigido.
- Reiniciar `camillagui` pode produzir por poucos segundos `Not connected to CamillaDSP`; confirme depois `/api/status` com `cdsp_status: RUNNING`.
- O frontend foi validado por build e respostas HTTP, mas ainda faltam testes automatizados específicos do modelo CamillaDSP e fluxos de perfil.
- O backend em `pi-backend/` espelha arquivos instalados sob `/opt/camillagui`; alterações futuras precisam ser publicadas nos destinos corretos, não apenas no frontend.

## Rotina segura para a próxima task

```powershell
Set-Location 'C:\Users\User1\.codex\visualizations\2026\07\28\019fa76e-a857-7282-954f-09e30d39f2bf\camilla-visual-control'
git status --short --branch
git log --oneline -8
Invoke-RestMethod 'http://piht.local:5005/api/getactiveconfigfile'
Invoke-RestMethod 'http://piht.local:5005/api/status'
npx eslint app
npm run build:pi
```

Para publicar somente o frontend:

```powershell
scp -o BatchMode=yes -r .\pi-dist\* elvis@piht.local:/opt/camillagui/build/control/
ssh -o BatchMode=yes elvis@piht.local 'sudo systemctl restart camillagui; systemctl is-active camillagui; systemctl is-active camilladsp'
```

## Próximos trabalhos recomendados

- Implementar a Fase 2 de [patchbay.md](../development/camilla-visual-control/patchbay.md): transformadores puros, rascunho, validação e edição convencional antes do drag-and-drop.
- Fazer revisão visual final do gerenciador de perfis em 1920×1080 após a compactação.
- Testar ponta a ponta carga, criação e transferência com perfis descartáveis e confirmar backups.
- Adicionar importação/exportação de YAML caso “carregar perfil” passe a incluir arquivos externos ao Pi.
- Criar testes unitários para `camilla-model.ts`, especialmente mixers múltiplos, roteamento compartilhado e infraestrutura do espectro.
- Separar o grande `app/page.tsx` em hooks/componentes de estado ao vivo, espectro e persistência.
- Tornar quantidade de canais, nomes, cores, sample rate e mixer de ganho configuráveis para a versão comunitária.
- Corrigir o escopo do script `lint` para ignorar `pi-dist`.
- Planejar autenticação e proteção contra CSRF antes de expor o CamillaGUI fora da rede local.
