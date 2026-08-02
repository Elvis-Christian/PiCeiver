# Requisitos para publicação comunitária

Este projeto deve ser preparado para uma futura publicação aberta voltada à comunidade CamillaDSP. O código atual é funcional no PiCeiver, mas ainda não deve ser apresentado como solução genérica ou segura para exposição pública.

## Bloqueadores antes de tornar público

### Generalização

- Remover premissas fixas de seis canais, nomes `LEFT-H`/`RIGHT-H`, 48 kHz, `route_inputs`, `stereo_widen` e dispositivo `camilla_tee`.
- Detectar dinamicamente canais, mixers, sample rate, pipeline, capacidades do backend e versão do CamillaDSP.
- Permitir que o usuário configure o método de captura do espectro ou o desative.
- Tratar pipelines com zero, um ou vários mixers sem assumir que o último mixer representa todas as saídas.

### Compatibilidade

- Definir e testar uma matriz de versões de CamillaDSP, CamillaGUI, Python e distribuições Raspberry Pi/Debian.
- Testar ALSA, PipeWire e outros backends relevantes, sem tornar o loopback ALSA obrigatório.
- Validar todos os tipos de filtro suportados pela versão declarada do CamillaDSP.
- Tratar arquivos `.yml` e `.yaml`, aliases, symlinks e diretórios de configuração configuráveis.

### Segurança

- Não recomendar exposição direta à internet.
- Implementar autenticação, autorização, proteção CSRF e limites de origem para qualquer implantação além da LAN confiável.
- Validar nomes e caminhos no backend, impedindo traversal e sobrescrita fora do diretório permitido.
- Tornar backups atômicos, definir retenção e oferecer recuperação verificável.
- Revisar endpoints que alteram volume, mute, configuração ativa e arquivos.

### Confiabilidade

- Escrita atômica de YAML e rollback automático quando `setconfig` falhar.
- Estado transacional claro entre DSP ao vivo, arquivo em edição e arquivo persistido.
- Testes unitários do modelo, testes de contrato das APIs e testes ponta a ponta com um CamillaDSP simulado.
- Estratégia para queda/reconexão do WebSocket, backend indisponível e mudança externa do YAML.
- Limites de CPU e memória medidos em Pi 3B, Pi 4 e Pi 5.

### Produto e documentação

- Substituir nomes e descrições específicos do PiCeiver por configuração ou exemplo opcional.
- Criar assistente de instalação e desinstalação que não sobrescreva uma instalação CamillaGUI existente sem backup.
- Documentar arquitetura, permissões, portas, troubleshooting e recuperação.
- Incluir capturas de tela, guia de primeiros passos e exemplos de pipelines.
- Oferecer internacionalização; português pode permanecer como idioma inicial, com inglês obrigatório para adoção ampla.

### Governança

- Escolher uma licença de código aberto compatível com dependências e objetivos do projeto.
- Fazer auditoria de licenças de código, fontes, ícones e dependências.
- Adicionar `CONTRIBUTING.md`, código de conduta, política de segurança e templates de issue/PR.
- Definir versionamento semântico, changelog e processo de releases assinados.
- Separar claramente o projeto comunitário do produto PiCeiver e remover dados privados, hosts, usuários e caminhos específicos dos artefatos publicados.

## Critérios mínimos para a primeira versão pública

- Instalação reproduzível em um Raspberry Pi limpo.
- Nenhuma configuração de áudio existente é perdida durante instalação, atualização ou remoção.
- Descoberta dinâmica de pelo menos 2 a 8 canais.
- Leitura, aplicação, salvamento, backup e restauração testados.
- Espectro opcional funcionando dentro de orçamento documentado de CPU.
- Cobertura automatizada dos transformadores de YAML e fluxos destrutivos.
- Interface utilizável em 1920×1080 e em tablet.
- Documentação em inglês e português.
- Revisão de segurança concluída para uso em LAN.

## Direção recomendada

Manter o PiCeiver como implantação de referência e extrair uma camada genérica:

1. Adaptador CamillaGUI/CamillaDSP.
2. Modelo normalizado de canais, mixers, filtros e perfis.
3. Provedor opcional de espectro.
4. Interface sem nomes ou topologia fixos.
5. Pacote de instalação separado dos exemplos do PiCeiver.

Somente após essa separação o repositório deve ser migrado para uma hospedagem pública e anunciado à comunidade.
