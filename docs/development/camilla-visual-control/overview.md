# Camilla Visual Control

## Localizacao do codigo

O codigo-fonte ativo permanece em
`C:\Users\User1\.codex\visualizations\2026\07\28\019fa76e-a857-7282-954f-09e30d39f2bf\camilla-visual-control`.
Todos os caminhos de codigo citados neste conjunto de documentos sao relativos
a esse repositorio. A documentacao, por decisao do projeto, vive somente nesta
pasta canonica em `V:\home\elvis\PiCeiver\docs`.

Interface web de controle ao vivo para CamillaDSP, desenvolvida inicialmente para o projeto PiCeiver em um Raspberry Pi 3B. O objetivo é tornar pipelines multicanal, crossovers, equalização e perfis YAML compreensíveis e manipuláveis sem abandonar a configuração nativa do CamillaDSP.

O frontend roda no próprio Pi e é servido pelo CamillaGUI em:

```text
http://piht.local:5005/gui/control/index.html
```

## Estado atual

- CamillaDSP e CamillaGUI são a fonte de verdade ao vivo.
- Seis canais de saída podem ser selecionados individualmente.
- Apenas o espectro da saída selecionada é processado e exibido, reduzindo o custo no Pi 3B.
- VUs de entrada e saída, pico, volume mestre e mute são atualizados pela API do CamillaGUI.
- Filtros do pipeline YAML são desenhados sobre o espectro e podem ser editados ao vivo.
- Alterações de controles são validadas e aplicadas ao DSP; persistência no arquivo YAML é uma ação separada e explícita.
- Perfis YAML podem ser carregados, clonados e receber partes de outros perfis com validação e backup.

Consulte [handoff-2026-07-28.md](handoff-2026-07-28.md) para o estado exato da implantacao e a continuacao recomendada.

## Funcionalidades

- Espectro pós-DSP da saída selecionada a 15 Hz.
- Curvas de HPF, LPF, PEQ, shelves, GEQ e demais filtros compatíveis sobrepostas ao espectro.
- Catálogo para criar filtros CamillaDSP e roteá-los para um ou mais canais.
- Compartilhamento real de filtros: canais que usam o mesmo nome YAML veem e editam a mesma instância.
- Equalizador gráfico com até 15 bandas na mesma linha, sliders e âncoras arrastáveis; duplo clique retorna uma banda a 0 dB.
- Reordenação, bypass, roteamento, duplicação e exclusão de filtros.
- Ganho por saída de −20 a +15 dB em passos de 0,5 dB, incluindo roda do mouse.
- Mute por saída aplicado também ao último mixer, evitando vazamento por matrizes como `stereo_widen`.
- Volume mestre com sincronização contínua, mute, dim e geometria estável durante aplicações.
- Gerenciador visual de YAML com perfil ativo evidente, salvamento no arquivo em edição, criação por cópia e transferência controlada de blocos.
- Patchbay com fluxo completo por canais, conexoes internas dos mixers, filtros por faixa e mesa editavel com rascunho, diagnostico, undo/redo e aplicacao validada. A arquitetura esta em [patchbay.md](patchbay.md).

## Estrutura

```text
app/
  page.tsx              interface e integração com as APIs do Pi
  camilla-model.ts      leitura, transformação e escrita do modelo CamillaDSP
  filter-catalog.ts     catálogo e campos dos tipos de filtro
  filter-manager.tsx    criação, prévia e roteamento de filtros
  patchbay.tsx          leitura visual de mixers e pipeline
  profile-manager.tsx   carga, criação e transferência de perfis YAML
  globals.css           layout Full HD e linguagem visual
pi-app/
  src/main.tsx          ponto de entrada Vite para o Pi
pi-backend/
  spectrum.py           captura e FFT leve do tap pós-DSP
  main.py               integração do endpoint de espectro ao CamillaGUI
  README.md             requisitos operacionais do backend
pi-dist/                build gerado para implantação, não editar manualmente
```

## Patchbay

O Patchbay unifica mixers e pipeline em uma mesma area visual. O fluxo abre entradas, saidas, somas, ganhos, mutes e filtros na ordem real do YAML; a mesa inferior permite editar conexoes sem depender de arrastar e soltar. Criacao de definicoes completas de mixer e reordenacao do pipeline continuam planejadas por fases em [patchbay.md](patchbay.md).

## Desenvolvimento e build

Requer Node.js 22 ou superior.

```bash
npm install
npx eslint app
npm run build:pi
```

Implantação atual no Pi:

```powershell
scp -o BatchMode=yes -r .\pi-dist\* elvis@piht.local:/opt/camillagui/build/control/
ssh -o BatchMode=yes elvis@piht.local 'sudo systemctl restart camillagui; systemctl is-active camillagui; systemctl is-active camilladsp'
```

Não reinicie o CamillaDSP para publicar somente mudanças de frontend.

## Regras de segurança do YAML

- Toda configuração é validada por `/api/validateconfig` antes de ser aplicada ou gravada.
- Edições ao vivo preservam `devices` lidos novamente do DSP para não perder os dispositivos ativos.
- Salvar o perfil atual cria antes um backup com timestamp.
- Transferir partes entre perfis cria backup do destino.
- Criar perfil nunca sobrescreve um nome existente.
- `camilla_tee`, seis saídas e a infraestrutura do espectro são reintroduzidos quando um perfil legado é carregado.
- Aplicar ao DSP e salvar no YAML são operações deliberadamente distintas.

## Publicação futura

O projeto tem potencial para uso pela comunidade CamillaDSP, mas ainda contem premissas especificas do PiCeiver. Os requisitos de generalizacao, seguranca, empacotamento, testes e licenciamento estao em [public-release.md](public-release.md).
