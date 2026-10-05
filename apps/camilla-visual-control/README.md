# Camilla Visual Control

Fonte canonica da interface web do PiCeiver. A instalacao ativa vive em
`/opt/camillagui`; esta pasta e a copia versionada e restauravel.

## Componentes

- `app/`: interface principal de audio, perfis, filtros e Patchbay;
- `pi-app/`: entradas Vite da pagina principal e da central de automacoes;
- `pi-backend/`: extensoes Python instaladas no CamillaGUI;
- `vendor/camillagui-3.0.3/`: base upstream preservada para restauracao;
- `tests/`: verificacoes do frontend;
- `package.json` e `package-lock.json`: dependencias reproduziveis.

## Validacao

```bash
npm ci
npm run lint
npm run build:pi
```

O build do Pi e criado em `pi-dist/`, que nao deve ser versionado.

## Implantacao

Preservar primeiro `/opt/camillagui/backend` e
`/opt/camillagui/build/control`. Instalar os arquivos de `pi-backend/`,
publicar `pi-dist/` em `/opt/camillagui/build/control/`, reiniciar somente
`camillagui` e validar as duas URLs descritas em
`../../docs/CURRENT_STATE.md`.

Detalhes funcionais e regras de seguranca:
`../../docs/development/camilla-visual-control/overview.md`.
