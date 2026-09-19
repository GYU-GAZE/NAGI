# Layout Network · 0.2.1

![Referência visual fornecida pelo usuário](reference-network.png)

## Referência e alcance

Implementação estrutural da referência enviada pelo usuário: barra de ferramentas, faixa de contexto, mensagens centralizadas com identidade à esquerda/direita, paleta azul/ciano, grade e moldura do composer. A moldura do navegador da imagem não faz parte da extensão. Os avatares da imagem são referências: carregue as imagens desejadas nas configurações. Sem arquivo, usa-se um monograma. Não são fabricados horários de envio.

## Módulos

| Responsabilidade | Arquivos | Configuração |
| --- | --- | --- |
| Ferramentas e coordenação de painéis | `src/ui/shell.ts`, `src/ui/network-css.ts`, `src/ui/icons.ts` | `navigation`, `layout.variant` |
| Título, projeto, Work, Chain, Persona e sessões vizinhas | `src/ui/context-bar.ts` | `layout.contextBar` |
| Posicionamento de Share, More e Files and Sources reais | `src/features/context-header.ts`, `src/adapter/header.ts` | Automático no modo Network/topbar |
| Painel nativo de arquivos/fontes abaixo das barras | `src/features/auxiliary-panels.ts` | Automático no modo Network/topbar |
| Navegação e lista de prompts carregados | `src/features/prompt-navigator.ts` | `layout.promptNavigator` |
| Identificação semântica de mensagens | `src/adapter/messages.ts` | Hooks centralizados, sem inferir papéis pelo texto da conversa |
| Cards, nome e retrato de cada lado | `src/features/message-layout.ts` | `messageCards`, `messageAvatars`, `messageNames`, `avatarSize`, `messageGap` |
| Paleta, grade e moldura do campo | `src/features/layout-theme.ts` | `grid`, `composerFrame`, `accent`; cores/fonte/largura em `settings.theme` |
| Seletor de Persona no composer | `src/features/composer-identity.ts` | `composerFrame` e módulo Personas |
| Aplicação/restauração de atributos | `src/features/marks.ts` | Uso interno reversível |

## Configuração

Network e suas cores são o padrão de instalações novas. Configurações salvas continuam preservadas. No modo Network, fonte, cores e largura sempre vêm de `settings.theme`, independentemente da aplicação do tema à interface nativa.

Em **Configurações → Layout**, `Restaurar visual padrão` aplica o preset Network, largura de 1040 px, barra superior, sidebar oculta e todos os módulos visuais. Preserva o nome e avatar local do usuário. Alternativamente, mantenha as cores anteriores e habilite/desabilite cada módulo.

Os campos da estrutura `settings.layout` são validados. `variant` aceita `network` e `compact`. O modo compacto mantém a barra anterior; os módulos de aparência Network são retirados. A navegação original continua independente, assim como o tema básico e a otimização de turnos. Pausar retira marcas, retratos e controles do layout e restaura a interface nativa.

`userName` e `userAvatar` são locais. O avatar aceita PNG, JPEG, GIF e WebP, até 256 KB e 2048 × 2048 px no upload. A Persona selecionada fornece os retratos de resposta; apenas a última resposta usa o estado estimado thinking/talking. As demais usam idle. Essas identidades são uma apresentação visual da seleção atual, não um registro de qual Persona produziu cada mensagem no passado. As instruções continuam sem aplicação automática.

A migração de dados 0.1.x é aditiva, dentro do schema 1: quando `settings.layout` não existe, os novos valores padrão são acrescentados sem alterar tema, Personas, Chains ou revisões existentes. Dados corrompidos continuam sendo rejeitados, não substituídos por defaults.

## Comportamento do cabeçalho

O cabeçalho original reconhecido reserva a altura medida da barra e da faixa de contexto, mas sua apresentação fica oculta. Os controles nativos continuam em seus pais originais, com posições visíveis correspondentes ao espaço de ações na faixa nAGI. Eventos não são clonados ou sintetizados. Não há acesso a estado React ou APIs internas. Menus continuam ancorados nos próprios botões. Cabeçalhos substituídos pelo site são reconhecidos novamente; atributos e variáveis próprios são removidos dos nós antigos.

As opções nAGI permanecem em iframe isolado para impedir que a digitação chegue aos atalhos de edição/envio do ChatGPT. A altura do painel considera a faixa de contexto e suas quebras de linha. Em janelas estreitas, a faixa reorganiza os itens e a barra de ferramentas permite rolagem horizontal.

Sem um cabeçalho reconhecido, o nAGI preserva o original e reserva espaço no conteúdo. Essa condição aparece no diagnóstico; não se oculta uma região arbitrária para aproximar o mockup.

## Contexto e navegação

O título vem do cabeçalho reconhecido, com fallback para documento/navegação carregada. Project é identificado pela rota, link de cabeçalho ou metadado da Chain e recebe o nome de um link de projeto carregado, quando disponível. Work é lido do cabeçalho; não é presumido. A Chain e a Persona vêm da seleção local desta aba/conversa. O índice de sessão é calculado pela posição da conversa aberta na Chain, sem alterar sua organização automaticamente.

As setas horizontais da Chain levam às conversas adjacentes reais. As setas verticais dos prompts rolam dentro da conversa atual. O contador abre uma lista de trechos para escolher um prompt diretamente. Apenas mensagens do usuário já carregadas no DOM participam. Os trechos existem apenas no painel local e não são persistidos nem exportados. Sem mensagens reconhecidas, aparece “Sem prompts detectados”. Não há carregamento automático do histórico remoto.

## Tokens e futuras alterações

A apresentação usa `--nagi-ui-bg`, `--nagi-ui-panel`, `--nagi-ui-text`, `--nagi-ui-font`, `--nagi-ui-font-size`, `--nagi-thread-width`, `--nagi-accent`, `--nagi-line`, `--nagi-avatar-size` e `--nagi-message-gap`. O shell publica `--nagi-shell-height`, usado por scroll-margin, reserva de espaço e posição dos painéis. Para mudar a composição, altere o módulo responsável, preservando o contrato dos seletores no adapter e o ciclo de remoção das marcas.

Não se aceita CSS/JS arbitrário nas configurações. Isso mantém dimensões e cores validáveis e evita transformar importação de tema em execução de código.

## Evidência e limitações

A 0.1.1 e a composição geral da 0.2.0 foram confirmadas pelo usuário em Firefox/Work. As correções da 0.2.1 ainda precisam de confirmação visual nesse frontend. Esta estrutura Network foi testada com fixtures DOM, incluindo uma variante sem os articles de conversa antigos. Os testes cobrem conservação de nós e handlers, rascunho, privacidade, seleção de prompts, troca de módulo e restauração. JSDOM não renderiza o layout real: dimensões dos testes são simuladas. Não houve inspeção autenticada nem comparação visual desta revisão no navegador do usuário.

O diagnóstico formato 4 registra configurações estruturais, contagem de papéis, cards e controles, além de amostras de geometria/estilos sem texto. Se Work usar hooks semânticos diferentes, `adapter/messages.ts` pode precisar de novos seletores. Não se classifica uma mensagem como usuário/assistente pela prosa ou cor de uma bolha.

## Agrupamento e posicionamento · 0.2.1

`resolveMessageGroups` reconhece wrappers de uma única mensagem, incluindo variantes Work com section/div. O envelope externo contém raciocínio, mensagem e ações; wrappers intermediários recebem a mesma largura e os acessórios recebem a fonte do tema. Mensagens e controles não são movidos. A seleção para no main, em regiões funcionais ou em um ancestral com mais de uma mensagem.

O detector de cabeçalho exclui envelopes completos de mensagens e barras com ações de feedback, inclusive se já marcadas por uma detecção antiga. O docking considera ancestrais que estabelecem um bloco para posicionamento fixo e recalcula as coordenadas durante rolagem. O painel direito é medido sem seu deslocamento anterior, evitando acumulação; o deslocamento e as marcas são removidos ao desativar.

A busca externa do composer sobe até 32 ancestrais, interrompendo antes de main/body ou qualquer região que contenha mensagens. Apenas decorações vazias e não interativas ao longo desse caminho são normalizadas. Não se limpa todo o conteúdo da página para remover uma faixa de fundo.
