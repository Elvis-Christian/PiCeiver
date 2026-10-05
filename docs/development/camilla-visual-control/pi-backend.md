# Backend da interface no Pi

## Fonte restauravel

- base CamillaGUI 3.0.3:
  `apps/camilla-visual-control/vendor/camillagui-3.0.3/`;
- extensoes do PiCeiver: `apps/camilla-visual-control/pi-backend/`;
- dependencias observadas no venv:
  `apps/camilla-visual-control/pi-backend/requirements-lock.txt`;
- instalacao ativa: `/opt/camillagui/`;
- unit: `backup-config/systemd/camillagui.service`.

A base preservada foi extraida do arquivo usado na instalacao, cujo SHA-256 e:

```text
83447ae9fdefc0cbb9dafe07737aca25402ec64308873faa7cbe753cb5ae1fe2
```

## Sobreposicoes

`pi-backend/main.py` registra:

- rotas originais do CamillaGUI;
- espectro em `pi-backend/spectrum.py`;
- central allowlisted em `pi-backend/automations.py`;
- arquivos estaticos.

`pi-backend/camillagui.yml` aponta para os perfis em
`/opt/dspstack/camilladsp`. O backend nunca aceita uma linha de shell enviada
pelo navegador; cada acao precisa existir na allowlist.

## Estado do espectro

O codigo e as rotas do espectro permanecem instalados, mas o tap nao recebe
audio no desenho atual. Os perfis usam diretamente
`hw:ICUSBAUDIO7D,0` porque `camilla_tee` tornou o caminho critico instavel.
Nao reintroduzir esse PCM apenas para recuperar o grafico.

## Restauracao

1. copiar a base 3.0.3 para `/opt/camillagui`;
2. criar o venv e instalar as dependencias registradas;
3. sobrepor `main.py`, `spectrum.py`, `automations.py` e a configuracao;
4. gerar o frontend com `npm ci && npm run build:pi`;
5. publicar `pi-dist/` em `/opt/camillagui/build/control/`;
6. instalar a unit versionada, habilitar e iniciar `camillagui`;
7. validar as duas paginas, `/api/automations` e os logs.

Preservar a instalacao anterior antes de qualquer substituicao.
