# Patchbay — mixers e pipeline visual

## Objetivo

O Patchbay é a área única para compreender e construir o roteamento do CamillaDSP. Ele reúne mixers e pipeline sem tentar reproduzir a interface do CamillaGUI: a configuração YAML continua sendo a fonte de verdade, mas passa a ser apresentada como um fluxo visual formado por dispositivos, mixers, filtros, canais, portas e conexões.

O nome **Patchbay** foi escolhido para este setor. A intenção é permitir que uma configuração complexa seja lida antes de ser editada e que alterações sejam preparadas de forma interativa sem comprometer o DSP em execução.

## Estado atual

A camada de leitura e a primeira camada editável estão implementadas em `app/patchbay.tsx`.

- O botão `PATCHBAY` no cabeçalho abre uma tela própria.
- A sequência do YAML é reconstruída como `captura → estágios do pipeline → playback`.
- Mixers e grupos de filtros aparecem na ordem real do pipeline em uma visão moderna por faixas.
- Cada mixer abre suas entradas e saídas; somas, ganhos e mutes permanecem visíveis nas conexões.
- Filtros aparecem somente nos canais atingidos, enquanto os demais canais mostram passagem explícita.
- Cores de faixa permanecem consistentes até o playback e conexões mutadas usam linha tracejada e baixa opacidade.
- A visão geral se ajusta à largura e à metade superior disponíveis, sem rolagem própria horizontal ou vertical; somente a mesa inferior rola quando necessário.
- Um mixer pode ser selecionado para inspeção.
- O inspetor mostra quantidade de entradas e saídas, destinos, fontes, ganho, mute e labels existentes.
- Configurações sem mixers recebem um estado vazio explícito.
- A mesa do mixer representa todas as saídas, inclusive as ainda não mapeadas.
- Fontes podem ser conectadas e removidas por controles convencionais.
- Canal, ganho, escala e mute podem ser alterados por conexão; o destino completo também pode ser mutado.
- As alterações ficam em rascunho com desfazer, refazer e descarte.
- Diagnósticos locais verificam índices, destinos duplicados, referências quebradas, labels e escalas.
- A aplicação é bloqueada em caso de erro, validada no backend, enviada ao DSP e confirmada por nova leitura.

Esta camada ainda não cria, duplica, renomeia ou exclui definições completas de mixer e ainda não altera a ordem global do pipeline. O YAML só é persistido pela ação separada já existente no cabeçalho.

## Decisão sobre arrastar e soltar

Arrastar e soltar não é requisito para a primeira versão editável e não deve ser o modelo primário de operação.

- **Mixer:** arrastar uma porta de entrada até uma saída pode ser oferecido depois como atalho para a operação explícita “conectar fonte”. Ganho, escala, mute, remoção e inspeção continuam em controles convencionais.
- **Pipeline:** a ordem visual é uma representação direta do array `pipeline`. Reordenar blocos é semanticamente válido, mas botões “antes/depois” ou pontos de inserção explícitos devem existir antes do drag-and-drop.
- **Leitura:** nenhuma interação de arraste é necessária. O diagrama já cumpre a função de explicar como mixers e filtros formam o fluxo.

Essa separação evita confundir topologia com geometria. O mixer define conexões; o pipeline define sequência. A posição livre de blocos na tela não cria uma terceira semântica.

O drag-and-drop só entra se melhorar a velocidade de uma operação já testada e disponível por teclado. Ele não deve permitir posicionamento livre, não deve aplicar alterações durante o movimento e não substitui seleção, confirmação e diagnóstico.

## Modelo de interação pretendido

### Dois modos complementares

O Patchbay terá dois modos que representam o mesmo YAML e preservam a seleção atual ao alternar entre eles.

1. **Mesa de mixer**: mostra um mixer por vez com mais espaço, fontes e destinos claramente separados e controles por conexão.
2. **Pipeline**: mostra todos os mixers de forma compacta, lado a lado na ordem de execução, com os filtros posicionados entre eles.

O usuário poderá abrir um mixer individual para edição ou solicitar a visão conjunta de todos os mixers. Um mixer é uma definição reutilizável do mapa `mixers` e sua posição no modo Pipeline é uma referência no array `pipeline`.

### Portas e conexões

- Fontes ficam em uma região própria e destinos em outra, evitando ambiguidade entre entrada e saída.
- Arrastar uma porta de fonte até uma porta de destino cria uma conexão candidata.
- Cada conexão representa um item de `mapping[].sources[]` do CamillaDSP.
- Uma conexão selecionada oferece ganho, escala, mute, inversão e exclusão quando esses atributos forem representáveis pelo formato suportado.
- Um destino pode receber uma ou várias fontes.
- Portas incompatíveis ou fora da faixa não aceitam a conexão.
- Linhas e setas representam o sentido do sinal; cor, opacidade e estado visual indicam seleção, mute, bypass, aviso ou erro.

Inversão deve ser implementada somente onde houver uma transformação CamillaDSP válida. A interface não deve inventar uma propriedade YAML. Se a versão ou o tipo de estágio exigir um filtro `Gain` com `inverted`, o Patchbay deve criar ou referenciar explicitamente esse filtro e mostrar essa consequência ao usuário.

### Mixers

O usuário deverá poder:

- criar um mixer vazio ou a partir de um modelo genérico;
- definir nome e quantidade de entradas e saídas;
- editar labels sem confundi-las com os índices reais;
- ligar fontes e destinos por arrastar e soltar;
- alterar ganho e mute de uma fonte;
- mutar um destino completo;
- remover conexões;
- duplicar, renomear e excluir um mixer com análise de referências;
- inserir uma instância do mixer no pipeline;
- abrir um mixer salvo para inspeção ou edição posterior.

Excluir uma definição usada no pipeline deve ser bloqueado até suas referências serem removidas ou substituídas. Remover apenas uma instância do pipeline não deve apagar automaticamente a definição reutilizável.

### Filtros no pipeline

- Filtros já construídos no catálogo podem ser arrastados para uma posição do pipeline.
- Um bloco pode representar uma etapa com um ou vários nomes, mantendo a ordem interna do YAML.
- O escopo de canais deve permanecer visível no bloco.
- Bypass, filtros compartilhados e referências repetidas devem preservar sua semântica original.
- Arrastar um filtro compartilhado move a referência selecionada; não deve duplicar silenciosamente sua definição.
- A edição detalhada do processador continua no editor de filtros. O Patchbay manipula posição, escopo, referência e bypass.

## Estados de edição

O Patchbay não deve modificar continuamente o DSP durante cada movimento visual. Ele trabalha sobre um rascunho imutável derivado da configuração confirmada.

1. **Confirmado**: corresponde ao YAML/configuração lida do backend.
2. **Rascunho**: contém alterações locais ainda não validadas.
3. **Com avisos**: estrutura incompleta ou potencialmente problemática que ainda pode ser organizada pelo usuário.
4. **Inválido**: não pode ser aplicada ao CamillaDSP.
5. **Aplicando**: cópia validada enviada ao DSP.
6. **Aplicado, não salvo**: DSP ao vivo alterado, mas YAML ainda não persistido.
7. **Salvo**: configuração confirmada e gravada no perfil indicado.

Foi decidido permitir a construção de estados intermediários com aviso. Isso é necessário porque uma operação de arrastar e soltar pode deixar temporariamente uma saída sem fonte ou uma definição ainda não inserida no pipeline. Permitir o rascunho não significa permitir sua aplicação: o botão de aplicar permanece bloqueado enquanto houver erro estrutural.

## Validação e segurança

O fluxo de escrita deve seguir esta ordem:

```text
configuração confirmada
        ↓ clonar
rascunho local
        ↓ validação estrutural local
candidato YAML
        ↓ /api/validateconfig
configuração validada
        ↓ /api/setconfig
DSP ao vivo
        ↓ confirmação por nova leitura
estado aplicado, ainda não salvo
        ↓ ação explícita do usuário
backup + saveconfigfile
```

Regras obrigatórias:

- Nunca editar o objeto confirmado diretamente; toda operação produz uma nova cópia.
- Nunca enviar um rascunho estruturalmente inválido ao DSP.
- Validar índices, contagem de canais, nomes únicos e todas as referências entre `mixers`, `filters` e `pipeline`.
- Reler e preservar os dispositivos ativos antes de aplicar, seguindo a regra já usada pelos editores atuais.
- Não salvar automaticamente o YAML após aplicar ao vivo.
- Criar backup antes de persistir uma mudança estrutural.
- Se `setconfig` falhar, conservar o rascunho para correção e manter a última configuração confirmada como referência de recuperação.
- Se a confirmação posterior divergir do candidato, mostrar a divergência e oferecer restauração explícita.
- Exibir impacto antes de excluir ou renomear definições referenciadas.

O primeiro rollback será a restauração da última configuração confirmada em memória. Uma fase posterior deve oferecer também a seleção de backups persistidos.

## Regras do modelo CamillaDSP

O modelo atual está em `app/camilla-model.ts`:

- `config.mixers` guarda definições nomeadas.
- `Mixer.channels.in` e `Mixer.channels.out` determinam os limites das portas.
- `Mixer.mapping[].dest` identifica uma saída do mixer.
- `Mixer.mapping[].sources[]` contém canal de origem, ganho, escala e mute opcionais.
- `config.pipeline` guarda etapas ordenadas do tipo `Mixer` ou `Filter`.
- Uma etapa `Mixer` referencia uma definição pelo nome.
- Uma etapa `Filter` referencia nomes existentes em `config.filters` e pode restringir canais.

O editor precisa aceitar zero, um ou vários mixers. Não pode assumir que o último mixer controla todas as saídas, nem fixar seis canais, nomes PiCeiver, `route_inputs`, `stereo_widen`, 48 kHz ou `camilla_tee` como regras universais.

## Arquitetura recomendada

Antes da edição interativa, separar a leitura visual da transformação do YAML:

- `patchbay-model.ts`: normalização de definições, instâncias, portas, conexões e diagnósticos.
- `patchbay-reducer.ts`: operações puras de rascunho, undo e redo.
- `patchbay-validate.ts`: invariantes locais e tradução dos erros do backend.
- `patchbay.tsx`: composição dos modos Mesa e Pipeline.
- componentes menores para mixer, porta, conexão, filtro, inspetor e barra de aplicação.

Não adicionar mutações complexas diretamente ao componente visual. Operações como conectar, desconectar, mover, renomear e excluir devem ser funções puras testáveis que recebem uma `CamillaConfig` e devolvem uma nova configuração mais diagnósticos.

Para a primeira versão, usar arrastar e soltar nativo com eventos de ponteiro e SVG para as conexões, sem assumir uma biblioteca pesada. Uma biblioteca especializada só deve ser adotada se reduzir comprovadamente a complexidade de acessibilidade, zoom, pan e roteamento de linhas dentro do orçamento do Pi 3B.

## Desempenho e acessibilidade

- O gráfico não deve recalcular o YAML ou todas as curvas de filtros durante cada pixel de arraste.
- A posição visual pode atualizar por `requestAnimationFrame`; a transformação do modelo ocorre ao concluir a operação.
- Mixers compactos podem ocultar detalhes, mas nunca o nome, contagem de portas, estado e erros.
- Conexões mutadas continuam visíveis com baixa opacidade.
- O fluxo precisa funcionar também por teclado: selecionar fonte, escolher destino e confirmar conexão.
- Cor não pode ser o único indicador de mute, bypass, aviso ou erro.
- Zoom e pan só entram depois que o fluxo básico em 1920×1080 estiver estável.

## Plano de implantação

### Fase 1 — leitura confiável — concluída

- Fluxo captura/pipeline/playback.
- Blocos de mixer e filtro na ordem do YAML.
- Inspetor de matriz.
- Estados vazios, referências quebradas e diagnóstico de índices.

### Fase 2 — modelo editável sem arrastar — em andamento

- [x] Criar transformadores puros para conexões do mixer.
- [x] Adicionar seleção de fonte/destino por controles convencionais.
- [x] Implementar rascunho, desfazer/refazer, validação e descarte.
- [x] Aplicar ao DSP sem salvar automaticamente e confirmar por nova leitura.
- [ ] Criar, duplicar, renomear e excluir definições de mixer com análise de referências.
- [ ] Inserir e remover instâncias de mixer no pipeline.
- [ ] Reordenar etapas do pipeline por controles explícitos.
- [ ] Adicionar testes unitários dos transformadores e diagnósticos.

Esta fase prova a semântica antes de depender da geometria do drag-and-drop.

### Fase 3 — atalhos visuais do mixer

- Portas e conexões SVG para leitura espacial.
- Arrastar uma fonte até um destino como atalho opcional de conexão.
- Paridade completa por teclado e controles convencionais.
- Avaliar inversão somente após definir sua transformação CamillaDSP exata.

### Fase 4 — pipeline interativo

- Visualização compacta de todos os mixers.
- Inserção e reordenação de mixers e filtros.
- Escopo de canais, bypass e compartilhamento explícitos.
- Avisos para rascunhos incompletos e bloqueio de aplicação inválida.

### Fase 5 — robustez

- Testes com zero, um e vários mixers.
- Undo/redo e rollback confirmado.
- Reconciliação quando o YAML muda fora da interface.
- Medições de CPU, memória e fluidez no Pi 3B.
- Testes ponta a ponta com backend simulado e com o Pi de referência.

## Critérios de aceitação da primeira versão editável

- Abrir qualquer configuração válida sem alterar o DSP.
- Representar corretamente zero, um ou vários mixers.
- Criar e remover uma conexão sem corromper índices ou outras definições.
- Preservar ganho, escala e mute das conexões não editadas.
- Mostrar filtros e mixers na mesma ordem do array `pipeline`.
- Permitir rascunhos intermediários com aviso, mas impedir a aplicação de uma configuração inválida.
- Validar no backend antes de `setconfig`.
- Confirmar por nova leitura que o DSP recebeu o candidato.
- Marcar claramente que o estado aplicado ainda não foi salvo.
- Descartar o rascunho e retornar exatamente à configuração confirmada.
- Salvar somente por ação explícita, com identificação do YAML e backup prévio.
- Manter interação utilizável em 1920×1080 no Raspberry Pi 3B.

## Fora do primeiro escopo

- Auto-roteamento inteligente de linhas.
- Simulação de áudio ou resposta acústica dentro do Patchbay.
- Edição detalhada dos parâmetros internos dos filtros.
- Colaboração simultânea entre vários navegadores.
- Conversão automática de topologias incompatíveis entre versões do CamillaDSP.
- Exposição do editor fora de uma LAN confiável sem autenticação e proteção CSRF.
