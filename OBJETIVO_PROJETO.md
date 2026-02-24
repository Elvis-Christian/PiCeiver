# Objetivo do Projeto (Marco Atual)

Este documento fixa o objetivo atual do projeto e serve como guia para
etapas futuras, com marcos e checklist de progresso.

## Objetivo Principal
Transformar o Raspberry Pi com a placa de som em um centralizador/orquestrador
que substitui um receiver tradicional, integrando controle, automacao e
processamento de audio multicanal.

## Escopo Atual (Marco 2026-02)
- O Pi e o coracao do sistema de controle e audio.
- A TV e o hub de video: as fontes de video entram na TV.
- O Pi nao gerencia video, apenas integra controle e audio.

## Fontes de Video (Entram na TV)
- TV Box Android
- Notebook
- Nintendo Switch
- Receptor de satelite
- TV Samsung como centralizadora dos sinais de video

## Audio Multicanal (Saida do Pi)
Saida multicanal com 4 amplificadores e caixas dedicadas:
- Amp 1: Frontais L/R (medio/agudo)
- Amp 2: Frontais L/R (sub/mediograves)
- Amp 3: Central frontal
- Amp 4: Subwoofer

## Energia e Acionamento Inteligente
- Amplificadores ligados por tomadas smart (acionamento inteligente).
- Amp das caixas frontais L/R com trigger de 3V, acionado pelo GPIO do Pi.

## Processamento de Audio (CamillaDSP)
Objetivos de DSP:
- Ampliar o stereo (stereo widen).
- Criar canal central.
- Filtros avancados para melhorar o audio.
- Ajustes e melhorias continuas no pipeline.

## Calibracao e Equalizacao
- Calibracao via REW (ou software similar).
- Medicoes e ajustes de equalizacao para melhor resposta possivel.

## Integracoes e Automacao
Orquestracao via:
- Home Assistant
- Node-RED

Controles e comandos:
- Macros de IR (Pi envia IR via GPIO ou via HA).
- Controle remoto Bluetooth pareado ao Pi (botoes acionam macros).
- CEC com TV Samsung para controle integrado.

## Direcionamento e Evolucao
Este documento descreve o objetivo atual. Novas funcionalidades poderao
ser adicionadas no futuro, mas este e o marco vigente.

---

# Analise e Diretrizes Operacionais (Interpretacao Atual)

## Premissas de Responsividade
- Caminho rapido: Bluetooth -> Pi -> IR -> TV (navegacao e comandos simples).
- Caminho estendido: Bluetooth -> Pi -> Node-RED -> HA/HACS -> TV (comandos sem IR).
- Regra: se existir comando via IR, ele deve ter prioridade por latencia.
- HA/HACS apenas para funcoes exclusivas da TV Samsung que nao existem no IR.

## Controle de Volume
- CamillaDSP e o unico controlador de volume do sistema.
- O volume da TV deve permanecer em zero ou mudo.

## Trigger de 3V (Amplificadores Frontais)
- O trigger original do receiver deve ser medido e entendido (tensao, duracao, forma).
- O Pi deve reproduzir este trigger via GPIO com circuito adequado (isolacao).

## Responsividade e Confiabilidade
- Evitar cadeia longa para comandos de navegacao (latencia).
- Node-RED atua como roteador de comandos, escolhendo IR ou HA.
- Medicao de latencia e logs simples para validar tempos reais.

## Calibracao e Latencia de Audio
- Calibracao via REW para equalizacao e alinhamento de atrasos.
- Ajustes de latencia devem ficar "perfeitos" a partir das mediacoes.

---

# Ideias e Funcionalidades a Consolidar

## Automacao e Controle
- Macros podem ser associadas a botoes do controle remoto Bluetooth.
- O Pi pode enviar IR via GPIO ou comandos via Home Assistant.
- Integracao CEC para controle da TV Samsung.

## Filtros Avancados no CamillaDSP (Direcao)
- Stereo widen e extracao/geracao de canal central.
- Filtros avancados para qualidade e coerencia do audio.
- Equalizacao fina por canal a partir das mediacoes.

---

# Consideracoes de Integracao (Pontos Criticos)
- TV Samsung nao tem chamadas diretas de IR/Bluetooth para todas as entradas HDMI.
- Necessario usar HACS/HA para funcoes exclusivas da TV.
- Risco de latencia quando o caminho e: BT -> Pi -> HA -> TV -> CEC -> box.
- Solucao mista recomendada: IR local para navegacao, HA apenas para funcoes sem IR.

---

# Marco Atual e Proximos Passos

## Milestones (Planejados)
- M1: Centralizacao funcional de audio multicanal via Pi.
- M2: Integracao completa com Home Assistant + Node-RED.
- M3: Controle remoto Bluetooth com macros de IR/CEC.
- M4: Gerenciamento inteligente de energia para amplificadores.
- M5: Filtros avancados e ajuste fino no CamillaDSP.
- M6: Calibracao com REW e equalizacao final.

## Checklist de Progresso
- [ ] Pipeline DSP multicanal completo e estavel
- [ ] Acionamento inteligente das tomadas smart
- [ ] Trigger 3V via GPIO funcional e sincronizado
- [ ] Macros IR funcionando (GPIO/HA)
- [ ] Controle remoto Bluetooth operante com macros
- [ ] CEC integrado e validado com TV Samsung
- [ ] Filtros avancados no CamillaDSP
- [ ] Calibracao com REW concluida
