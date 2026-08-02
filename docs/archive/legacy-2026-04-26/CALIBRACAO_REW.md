# Calibracao com REW (Roteiro)

Este roteiro descreve uma calibracao padrao para aplicar no CamillaDSP.

## 1) Preparacao
- Microfone calibrado (arquivo de calibracao carregado no REW).
- Posicao de referencia (ponto de escuta).
- Volume fixo controlado pelo CamillaDSP.
- TV sempre em volume 0/mudo.

## 2) Medicoes por Canal
- Medir cada canal isoladamente.
- Salvar resposta em frequencia e fase.
- Repetir se houver ruido externo.

## 3) Definicao de Curva Alvo
- Definir target curve global.
- Ajustar por canal se necessario.

## 4) Geracao de Filtros
- Gerar PEQ/FIR no REW.
- Exportar filtros para o CamillaDSP.
- Definir ganhos para evitar clipping.

## 5) Alinhamento Temporal
- Ajustar atrasos por canal.
- Validar alinhamento do canal central e subwoofer.

## 6) Validacao Final
- Repetir medicao com filtros ativos.
- Comparar com a curva alvo.
- Ajustar iterativamente ate convergir.

## Entregavel
- Arquivo de filtros aplicado no CamillaDSP.
- Registro das curvas antes/depois.
