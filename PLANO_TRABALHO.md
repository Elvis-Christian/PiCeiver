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

## 2) Proposta de Circuito para Trigger de 3V

### 2.1 Medicao do trigger original
- Medir tensao (Vmax/Vmin), duracao do pulso e formato do sinal.
- Verificar se e nivel DC ou pulso com duty/periodo.

### 2.2 Reproducao pelo Pi (GPIO)
- Se for nivel DC: GPIO + transistor/MOSFET + resistores para isolar.
- Se for pulso: PWM no GPIO + filtro RC (se necessario).
- Recomendado: optoacoplador para isolacao eletrica.

### 2.3 Protecao do Pi
- Nunca ligar o GPIO direto no circuito do amplificador.
- Garantir limites de corrente do GPIO.

### 2.4 Integracao com estado do audio
- Trigger deve ligar quando o sistema estiver em modo ativo.
- Desligar com atraso para evitar pops.

Entregavel: esquema eletrico simples e lista de componentes.

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
2. Trigger de 3V (protege e liga amps frontais).
3. Integracao HA/HACS para funcoes exclusivas.
4. Calibracao e filtros avancados.

### 4.2 Backlog por etapa
- Controle: mapear comandos BT e IR, testar latencia.
- Trigger: medir sinal original, montar circuito, integrar ao sistema.
- HA/HACS: configurar e testar comandos.
- DSP/REW: medir, aplicar filtros, validar.

### 4.3 Prazos
- Definir prazos por milestone quando as mediacoes forem coletadas.
- Revisar estimativas a cada iteracao.

### 4.4 Riscos
- Latencia excessiva no caminho HA/HACS.
- Incerteza no trigger de 3V.
- Ajustes finos de DSP exigem iteracoes.

Entregavel: cronograma simples e lista de riscos mitigados.
