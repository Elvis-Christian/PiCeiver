# Plano de Trabalho (Itens 1 a 4)

Este arquivo detalha os itens 1 a 4 solicitados, com entregaveis claros.

## 1) Diagrama de Arquitetura (Fluxos de Comando)

### 1.1 Fluxo rapido (baixa latencia)
Bluetooth -> Pi -> IR -> TV -> Dispositivo (via HDMI/CEC quando aplicavel)

### 1.2 Fluxo estendido (funcoes sem IR)
Bluetooth -> Pi -> Node-RED -> Home Assistant (HACS) -> TV

### 1.3 Roteamento de comandos
- Regra: se existir comando IR equivalente, usar IR.
- Apenas comandos exclusivos da TV Samsung (sem IR) seguem via HA/HACS.
- Node-RED faz a decisao por tipo de comando.

### 1.4 Pontos de latencia
- BT no Pi: leitura de evento.
- Node-RED: fila/execucao.
- HA/HACS: processamento interno.
- TV: aplicacao do comando.

### 1.5 Log e medicao
- Log com timestamp no Pi para cada comando recebido e enviado.
- Medir tempo fim-a-fim nos dois caminhos.

Entregavel: diagrama em texto ou Mermaid com os dois caminhos e roteamento.

---

## 2) Controle do M-AX7 pelo Arduino Nano

### 2.1 Protocolo identificado
- O enlace e o barramento Kenwood SL16 de 5 V em cabo TRS.
- TIP e BUSY, RING e DATA e SLEEVE e GND.

### 2.2 Arquitetura
- O Pi alimenta e controla o Arduino Nano por USB serial.
- O Nano gera o SL16 em D2/D3 e controla exclusivamente o M-AX7.

### 2.3 Protecao
- C-AX7 e Nano nunca devem dirigir o barramento simultaneamente.
- D2/D3 ficam em alta impedancia durante boot e repouso.

### 2.4 Integracao com estado do audio
- O comando SL16 deve ligar quando o sistema estiver em modo ativo.
- Desligar com atraso para evitar pops.

Entregavel: firmware do Nano, helper USB do Pi e ligacao documentada.

---

## 3) Roteiro de Calibracao com REW

### 3.1 Preparacao
- Microfone calibrado e posicao de referencia.
- Volume fixo controlado pelo CamillaDSP.

### 3.2 Medicoes por canal
- Medir cada canal isoladamente.
- Capturar resposta em frequencia e fase.

### 3.3 Definicao de curva alvo
- Criar target curve por canal.
- Ajustar graves/agudos conforme preferencia.

### 3.4 Aplicacao no CamillaDSP
- Gerar filtros (PEQ/FIR).
- Aplicar atrasos para alinhamento.

### 3.5 Validacao
- Repetir medicao e comparar com target.
- Ajustar ate convergir.

Entregavel: conjunto de filtros e parametros aplicados no CamillaDSP.

---

## 4) Plano de Implementacao (Prioridades e Prazos)

### 4.1 Prioridades
1. Responsividade do controle (IR local).
2. Controle SL16 pelo Nano comandado por USB pelo Pi.
3. Integracao HA/HACS para funcoes exclusivas.
4. Calibracao e filtros avancados.

### 4.2 Backlog por etapa
- Controle: mapear comandos BT e IR, testar latencia.
- SL16: instalar o Nano, implementar helper serial e integrar ao sistema.
- HA/HACS: configurar e testar comandos.
- DSP/REW: medir, aplicar filtros, validar.

### 4.3 Prazos
- Definir prazos por milestone quando as mediacoes forem coletadas.
- Revisar estimativas a cada iteracao.

### 4.4 Riscos
- Latencia excessiva no caminho HA/HACS.
- Falha ou desconexao da interface USB serial com o Nano.
- Ajustes finos de DSP exigem iteracoes.

Entregavel: cronograma simples e lista de riscos mitigados.
