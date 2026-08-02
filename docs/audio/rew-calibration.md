# REW Calibration

## Objetivo

Aplicar uma rotina repetivel de calibracao para o CamillaDSP.

## Preparacao

- microfone calibrado com arquivo correto no REW
- posicao de referencia no ponto de escuta
- volume fixo controlado pelo CamillaDSP
- TV em volume zero ou mudo

## Medicoes por canal

- medir cada canal isoladamente
- salvar resposta em frequencia e fase
- repetir se houver ruido externo

## Curva alvo

- definir uma target curve global
- ajustar por canal quando necessario

## Geracao de filtros

- gerar filtros PEQ ou FIR no REW
- exportar para o CamillaDSP
- definir ganhos evitando clipping

## Alinhamento temporal

- ajustar atrasos por canal
- validar alinhamento do canal central e do subwoofer

## Validacao final

- repetir medicao com filtros ativos
- comparar com a curva alvo
- ajustar iterativamente ate convergir

## Entregaveis

- arquivo de filtros aplicado no CamillaDSP
- registro das curvas antes/depois
