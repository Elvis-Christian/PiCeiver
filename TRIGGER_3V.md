# Trigger 3V dos Amplificadores Frontais

Este documento define a proposta para medir e reproduzir o trigger de 3V
do receiver original usando o Raspberry Pi.

## 1) Medicao do Trigger Original

Objetivo: entender o sinal real para reproduzir com seguranca.

Checklist:
- Medir tensao maxima e minima (Vmax/Vmin).
- Verificar se e nivel DC continuo ou pulso.
- Medir duracao do pulso e periodo (se pulsado).
- Verificar polaridade e referencia (GND).

Ferramentas sugeridas:
- Multimetro (tensao DC/AC).
- Osciloscopio (ideal, se disponivel).

## 2) Reproducao via GPIO (Opcao Segura)

Principio: isolar o GPIO e nao injetar corrente direta no amplificador.

Opcao A (Nivel DC simples):
- GPIO -> resistor -> transistor/MOSFET -> trigger do amp.
- Fonte de 3V do Pi ou regulador dedicado, se necessario.
- Optoacoplador recomendado para isolacao.

Opcao B (Pulso/PWM):
- GPIO com PWM -> filtro RC (se necessario).
- Optoacoplador antes da carga.

## 3) Protecao do Raspberry Pi
- Nunca ligar o GPIO direto ao trigger do amp.
- Limitar corrente com resistores.
- Usar optoacoplador quando possivel.

## 4) Integracao com o Sistema
- Trigger liga ao ativar audio (perfil ativo).
- Trigger desliga com atraso (evitar pops).

## 5) Entregaveis
- Medicao documentada do sinal original.
- Esquema eletrico simples com componentes.
- Validacao com teste de acionamento.
