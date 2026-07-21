# Software Baseline

Estado observado em `2026-07-21` no filesystem do PiCeiver.

## Plataforma

- sistema: Debian GNU/Linux 13 (trixie), `13.3`;
- arquitetura dos pacotes: `arm64`;
- kernels instalados no filesystem:
  - `6.12.47+rpt-rpi-v8`;
  - `6.12.62+rpt-rpi-v8`;
  - variantes `rpt-rpi-2712` dos mesmos kernels tambem presentes;
- Node.js: pacote `nodejs 20.20.0-1nodesource1`;
- Node-RED: `4.1.3`, instalado globalmente em `/usr/lib/node_modules/node-red`.

## Audio e integracoes

| Componente | Versao observada | Origem/observacao |
|---|---:|---|
| CamillaDSP | `3.0.1` | binario em `/usr/local/bin/camilladsp` |
| ALSA utilities | `1.2.14-1+rpt1` | pacote Debian/Raspberry Pi |
| libasound | `1.2.14-1+rpt1` | pacote `libasound2t64` |
| Raspotify | `0.48.1~librespot.v0.8.0-ea81314` | pacote arm64 |
| librespot | `0.8.0` | fornecido pelo pacote Raspotify |
| Mosquitto | `2.0.21-1` | pacote Debian |
| Avahi daemon | `0.8-16` | pacote Debian |

## Identidade dos binarios principais

```text
105d471b12f44f5c1ab52eec1a4e1a6b49f17f8899fa1c85d29c0603b6ba7fdf  /usr/local/bin/camilladsp
3adf05fd4d203072437da90fa9f977b99ff78bc98cc37173debc40c5f4a47c51  /usr/bin/librespot
```

Os binarios nao sao guardados neste repositorio. Em uma reinstalacao, instalar
as versoes indicadas e comparar `sha256sum` quando o mesmo artefato ainda
estiver disponivel. Para CamillaDSP, usar a release oficial `v3.0.1` para
Linux AArch64.

## Node-RED

- `flows.json`, `settings.js` e configuracoes nao secretas estao no snapshot
  publico;
- `flows_cred.json` e o segredo de runtime pertencem ao `backup-private/`, que
  deve ser copiado para armazenamento externo criptografado;
- o `package.json` do usuario nao declara modulos adicionais;
- nao havia modulos locais dentro de `/home/elvis/.node-red/node_modules` na
  auditoria;
- a instalacao global continha Node-RED e ferramentas basicas do Node/npm;
- o diretorio global `@openai` nao faz parte do runtime documentado do
  PiCeiver e nao foi incluido no baseline.

## Limitacoes conhecidas

- `camillagui.service` esta habilitado, mas `/opt/camillagui` nao existia na
  auditoria; a unit foi preservada, mas esse componente nao e restauravel a
  partir deste baseline;
- `/boot/firmware/cmdline.txt` contem `PARTUUID` especifico do disco e nao foi
  copiado para evitar restaura-lo em outra instalacao;
- caches, logs, banco persistente do Mosquitto e cache do Spotify nao fazem
  parte do baseline;
- o arquivo sudoers do Node-RED deve ser sincronizado no proprio Pi com acesso
  root; o volume montado nao permitiu sua leitura durante esta auditoria.
