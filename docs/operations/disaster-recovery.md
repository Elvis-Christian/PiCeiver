# Recuperacao do PiCeiver

## Objetivo

Reconstruir o estado funcional preservado do PiCeiver sem transformar uma
restauracao em uma mudanca nao controlada. O baseline protege configuracao e
identidade das versoes; ele nao e uma imagem completa do cartao.

## Baseline confirmado

Em `2026-07-21`, os snapshots de CamillaDSP, ALSA, Node-RED, systemd e
Raspotify foram comparados com os arquivos ativos e apresentaram o mesmo
SHA-256. O commit/tag do baseline deve ser usado como ponto de retorno.

Itens protegidos:

- mixer, filtros, rotas e dispositivos do CamillaDSP;
- `snd-aloop`, `asound.conf` e estados ALSA;
- flows e configuracao publica do Node-RED;
- credenciais e segredo de runtime no backup privado externo;
- Raspotify/librespot e seu override efetivo de dispositivo;
- Mosquitto;
- units systemd e lista de servicos habilitados;
- configuracao de boot relevante;
- firmware do controlador Kenwood;
- versoes e hashes dos binarios principais.

## O que o Git nao substitui

- imagem integral do cartao e tabela de particoes;
- pacotes `.deb` e binarios de terceiros;
- cache e autenticacao do Spotify;
- logs e dados persistentes do Mosquitto;
- configuracao de rede dependente da instalacao;
- `cmdline.txt`, cujo `PARTUUID` muda com o disco;
- aplicacao CamillaGUI, ausente no estado auditado;
- arquivo sudoers enquanto ele nao tiver sido sincronizado com acesso root.

## Backup privado obrigatorio

O repositorio do PiCeiver e publico. A sincronizacao grava credenciais do
Node-RED em `backup-private/`, que o Git ignora. Copiar essa pasta depois de
cada mudanca de credenciais para um armazenamento externo criptografado.

```bash
PICEIVER_PRIVATE_BACKUP_DIR=/caminho/seguro \
  ./scripts/sync_backup_configs.sh
```

Na restauracao, montar ou copiar o backup privado e informar o mesmo caminho:

```bash
sudo PICEIVER_PRIVATE_BACKUP_DIR=/caminho/seguro \
  ./scripts/restore_backup_configs.sh --apply
```

`flows_cred.json` sem o `config.runtime.json` correspondente pode ser
indecifravel. Nenhum dos dois deve ser publicado.

A chave antiga aparece no historico publico e deve ser tratada como conhecida.
Antes de cadastrar senhas ou tokens reais no Node-RED, rotacionar a chave de
credenciais e produzir um novo backup privado. Nao reescrever o historico Git
sem uma operacao separada, planejada e explicitamente autorizada.

## Regra de ouro

Nunca executar o restaurador diretamente com `--apply`. Primeiro instalar as
dependencias, abrir o dry-run, revisar todos os destinos e preservar uma imagem
do cartao ou outro backup externo quando o sistema ainda estiver acessivel.

## 1. Preparar o sistema base

1. instalar Debian/Raspberry Pi OS arm64 compativel com o baseline;
2. criar o usuario `elvis` e garantir participacao no grupo `audio`;
3. configurar rede e acesso SSH separadamente;
4. instalar as versoes de referencia em
   [`software-baseline.md`](software-baseline.md);
5. instalar CamillaDSP `3.0.1` AArch64 em `/usr/local/bin/camilladsp`;
6. instalar Node-RED `4.1.3`, Raspotify, Mosquitto, ALSA utilities, Avahi e
   Python 3;
7. comparar os hashes de CamillaDSP e librespot com
   `backup-config/system/software-versions.txt`.

Versoes identicas sao preferiveis. Se uma versao nao estiver mais disponivel,
restaurar em bancada com a versao mais proxima e validar antes de conectar os
amplificadores.

## 2. Obter o baseline

Clonar o repositorio e selecionar explicitamente a tag ou o commit do baseline.
Nao restaurar a partir de um diretorio com mudancas locais desconhecidas.

```bash
git status --short
git log -1 --oneline
```

## 3. Simular

Executar como usuario normal:

```bash
./scripts/restore_backup_configs.sh
```

Revisar cada linha `DRY`, principalmente:

- usuario e caminhos `/home/elvis`;
- placa de som esperada pelo CamillaDSP;
- dispositivos `plughw` usados por alsaloop e librespot;
- limites de volume e roteamento dos canais;
- caminho do binario CamillaDSP.

## 4. Aplicar sem iniciar o audio

Parar os servicos de audio antes de aplicar em um Pi que ja esteja rodando. Os
amplificadores devem permanecer desligados ou mutados.

```bash
sudo ./scripts/restore_backup_configs.sh --apply
```

Antes de cada sobrescrita, o script copia o arquivo existente para:

```text
/var/backups/piceiver-restore/<timestamp>/
```

O script recarrega a leitura das units, mas nao habilita nem reinicia servicos.

## 5. Boot e modulos

O restaurador nao altera `config.txt` por padrao. Compare manualmente o arquivo
da nova instalacao com `backup-config/boot/config.txt`. Somente depois dessa
revisao:

```bash
sudo ./scripts/restore_backup_configs.sh --apply --include-boot
```

Nao copiar `cmdline.txt` de outro cartao. Confirmar depois do boot:

```bash
lsmod | grep snd_aloop
aplay -l
arecord -l
```

Os indices ALSA atuais usam numeros de placa. Se a interface USB receber outro
indice, nao iniciar o audio ate ajustar e validar o roteamento.

## 6. Habilitar os servicos

Revisar `backup-config/system/enabled-services.txt`. Habilitar somente os
componentes instalados e validados:

```bash
sudo systemctl enable camilladsp.service
sudo systemctl enable mosquitto.service
sudo systemctl enable nodered.service
sudo systemctl enable raspotify.service
sudo systemctl enable toslink-to-loopback.service
```

`camillagui.service` nao deve ser iniciada enquanto `/opt/camillagui` nao tiver
sido reconstruido.

## 7. Validar antes de conectar os amplificadores

```bash
sudo ./scripts/verify_backup_configs.sh
systemctl --no-pager --full status camilladsp mosquitto nodered raspotify toslink-to-loopback
journalctl -b --no-pager -u camilladsp -u raspotify -u toslink-to-loopback
```

Ordem de teste:

1. confirmar dispositivos ALSA;
2. iniciar Mosquitto e Node-RED;
3. iniciar CamillaDSP sem amplificadores;
4. validar canais com sinal de teste em volume seguro;
5. iniciar uma fonte por vez;
6. confirmar mute, OFF e limites de volume;
7. conectar amplificadores e testar com ganho reduzido;
8. testar 100 ciclos somente depois da bancada estar estavel.

## 8. Atualizar o baseline

No proprio Pi, depois de uma mudanca validada:

```bash
cd /home/elvis/PiCeiver
./scripts/sync_backup_configs.sh
./scripts/verify_backup_configs.sh
git diff --check
git status -sb
```

Se o sudoers existir e nao puder ser lido, repetir a sincronizacao com acesso
adequado. Nao aceitar `SKIP` ou `FAIL` para um componente necessario.

Revisar o diff para evitar publicar credenciais ou dados pessoais, commitar e
enviar ao remoto somente depois da verificacao.

## Criterio de restauracao bem-sucedida

- verificador sem falhas obrigatorias;
- `snd-aloop` carregado;
- interface USB identificada e canais conferidos;
- CamillaDSP recebe e entrega audio sem clipping;
- TV e Spotify podem ser selecionados separadamente;
- OFF e mute funcionam antes do acionamento dos amplificadores;
- Node-RED e Mosquitto reiniciam sem perda de estado essencial;
- reboot completo nao produz audio espurio nem volume perigoso.
