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

TV e Spotify incluem `lfe_remote_trim`, filtro Volume dedicado ao canal 3
(LFE), ligado ao fader Aux1 e limitado a +5 dB. Ele precede `lfe_limiter` no
pipeline. O controle remoto e o painel de automacoes alternam Aux1 entre mute,
-5 dB, 0 dB e +5 dB sem alterar filtros nem volume dos outros canais.

## Arquivos de referencia

- perfis: `../../backup-config/camilladsp/`;
- unit: `../../backup-config/systemd/camilladsp.service`;
- frontend e patchbay: [`../development/camilla-visual-control/overview.md`](../development/camilla-visual-control/overview.md);
- baseline de versoes: [`../operations/software-baseline.md`](../operations/software-baseline.md).

## Regra de seguranca

Preservar o YAML ativo antes de editar, validar schema e pipeline, e aplicar
somente depois de confirmar dispositivos ALSA e possibilidade de rollback.
