# CamillaDSP

## Estado documentado

O servico inicia `/usr/local/bin/camilladsp -p 1234` com a configuracao
`/opt/dspstack/camilladsp/camilladsp.yml`, executando como usuario `elvis` e
grupo `audio`.

O snapshot versionado contem tres perfis:

- `camilladsp.yml`: perfil ativo/base, atualmente descrito como entrada USB TOSLINK direta;
- `camilladsp-tv.yml`: entrada USB TOSLINK direta para saida USB de seis canais;
- `camilladsp-spotify.yml`: entrada Spotify via ALSA Loopback para saida USB de seis canais.

Todos incluem `devices`, `filters`, `mixers` e `pipeline`. O estado operacional
e o historico da migracao para fontes diretas estao em
[`../architecture/audio-stack-current-state.md`](../architecture/audio-stack-current-state.md).

## Arquivos de referencia

- perfis: `../../backup-config/camilladsp/`;
- unit: `../../backup-config/systemd/camilladsp.service`;
- frontend e patchbay: [`../development/camilla-visual-control/overview.md`](../development/camilla-visual-control/overview.md);
- baseline de versoes: [`../operations/software-baseline.md`](../operations/software-baseline.md).

## Regra de seguranca

Preservar o YAML ativo antes de editar, validar schema e pipeline, e aplicar
somente depois de confirmar dispositivos ALSA e possibilidade de rollback.
