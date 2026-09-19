# Integração com ChatGPT Web — evidências de 2026-09-17

## O que foi observado ao vivo

A navegação para `https://chatgpt.com/` encontrou uma página com título `Just a moment...` e um desafio Cloudflare visível: `Verify you are human`. Nenhuma tentativa de resolver o desafio foi feita. O DOM autenticado, Projects, Custom Instructions e respostas em streaming **não foram inspecionados**. Não houve leitura de tokens, chamadas a endpoints privados ou alteração da conta.

A fixture em `http://localhost:4173/c/demo-session` foi servida com sucesso pelo processo local, mas o navegador remoto recusou a navegação com `net::ERR_BLOCKED_BY_CLIENT`. Isso é uma restrição de acesso do ambiente, não evidência de bot detection na fixture.

Consequência: os seletores abaixo são **candidatos de integração**, exercitados apenas em DOM sintético. Não são um retrato confirmado da versão atual do ChatGPT.

## Pontos candidatos

| Capacidade | Candidatos / regra | Limitação e fallback |
| --- | --- | --- |
| Composer | `#prompt-textarea`, `textarea[data-testid="prompt-textarea"]` | Sem correspondência: unknown; não afirmar geração concluída |
| Enviar | `button[data-testid="send-button"]`, rótulos EN/PT-BR explícitos | Mudança de botão/atalho requer reparo; nAGI não usa requisições privadas |
| Parar | `button[data-testid="stop-button"]`, rótulos EN/PT-BR explícitos | A presença visual sugere geração; ausência só vira idle após estabilização |
| Texto final | Último `[data-message-author-role="assistant"]` com `.markdown`, excluindo progress/details | Heurística frágil: ferramentas ou formatos novos podem confundir talking/thinking |
| Sidebar | `#history`, `#sidebar`, `#stage-slideover-sidebar`, `#stage-sidebar-tiny-bar`, data-testid de sidebar e fallback nav/aside | Busca um container externo que não contenha chat/composer; remove largura junto do sidebar. Sem evidência, mantém UI nativa |
| Turnos | `article[data-testid^="conversation-turn-"]` | Sem turnos reconhecidos, otimização faz zero alterações |
| Recentes | Links nas regiões identificadas como sidebar, caminho terminando `/c/<id>` | Apenas links montados; ordem acompanha DOM, não data inferida |
| Projects | Links nas regiões identificadas como sidebar, `/g/g-p-.../project` ou equivalente sem sufixo | IDs e rotas candidatos; não abre ou cria Project automaticamente |
| Conversa atual | Path terminando `/c/<id>` | Metadado local; não confirma conta, backend ou projeto associado |
| Project atual | Prefixo `/g/g-p-...` quando presente | Rota `/c/<id>` isolada retorna null, sem inferência por proximidade |
| Custom Instructions | Indisponível | Salvar Persona é operação local; nenhum backup da conta é necessário antes de uma escrita que não existe |

A máquina visual usa quatro estados: idle, thinking, talking e unknown. Durante stop visível, uma alteração no candidato a texto final produz talking por 1 s; sem novos caracteres, thinking. O retorno a idle após uma geração exige composer reconhecido e ausência estável do stop por 1,2 s. Isso permite alternância, mas pausas de streaming também podem parecer thinking. A UI e o diagnóstico usam a palavra “estimado”.

## Condições para habilitar integrações futuras

Antes de trocar Custom Instructions: inspecionar o formulário real, todos os campos e toggles relevantes, escopo entre contas/workspaces, limites, save/erro, readback e precedência de Project Instructions. Implementar backup local versionado ANTES de qualquer escrita e restauração verificável. Cobrir abas sem nAGI, regeneração, edição, voz e gerações já ativas antes da captura.

Antes de continuar uma Chain: detectar Project com evidência confiável, criar chat por UI visível e verificar seu destino antes de anexar uma sessão ou enviar continuação. Não usar `null` como “pode criar fora do Project”. Auto-rollover permanece desativado até a continuação manual funcionar.

## Referências oficiais consultadas

- [MDN: background de WebExtensions](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background) — variantes de background por navegador.
- [Chrome: storage API](https://developer.chrome.com/docs/extensions/reference/api/storage) — separação entre armazenamento local e de sessão.
- [MDN: content-visibility](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/content-visibility) — mecanismo de renderização opcional, sem inferir ganhos particulares no ChatGPT.

Essas referências sustentam as escolhas de plataforma, não validam os seletores do ChatGPT.

## Retorno do usuário e revisão 0.1.1

O usuário relatou interferência do composer ao digitar nas opções, sidebar que não some e camadas/bordas pretas no composer. A revisão troca os painéis editáveis por um documento isolado e expande a aplicação visual de um seletor pontual para regiões estruturais. Esses relatos não fornecem o DOM exato, portanto os novos seletores continuam candidatos até receber o diagnóstico + screenshot do navegador real.

O relatório exportável permite comparar configurações solicitadas, marcas aplicadas, containers reconhecidos, posições, fundos, bordas, sombras e pseudo-elementos. Ele omite texto e atributos livres; não é um dump de DOM.

## Cabeçalho · 0.1.2

O print e diagnóstico da 0.1.1 confirmaram tema ativo, sidebar ocultada e composer reconhecido (13 camadas internas e 8 externas), em Firefox 155, viewport 2338 × 1171. O usuário confirmou que as correções funcionaram. O relatório anterior não registrava o DOM do cabeçalho. Seus seletores continuam sendo candidatos, não observações de DOM autenticado.

`adapter/header.ts` procura cabeçalhos sem conversa, composer ou painel lateral; para a variante Work em div, exige Share/Compartilhar e outro controle em uma faixa larga e baixa no topo. Cabeçalhos dentro de mensagens, navegação lateral, menus e diálogos são excluídos. `features/header.ts` aplica marcas reversíveis às superfícies e controles, preservando nós e eventos nativos. Nenhum click é disparado pela integração. Mudanças de rota/substituição do cabeçalho são reavaliadas pelo observer existente. As marcas saem de nós antigos, na pausa, na navegação nativa e no descarte.

A barra nAGI usa o centro da largura disponível do cabeçalho. Abaixo de 1100 px (ou se as ferramentas exigirem mais espaço) o cabeçalho recebe duas linhas. O tema ativo fornece cor do campo, texto e fonte; com tema desligado, usa a paleta própria da barra nAGI. Menus e diálogos não são normalizados como botões do cabeçalho. Os controles permanecem no documento original para preservar eventos pointer/teclado e âncoras de popovers; o editor de opções continua isolado no iframe.

Limitações: não houve renderização autenticada desta revisão. Um frontend sem hooks semânticos ou sem Share reconhecível pode não ser detectado, preservando o cabeçalho. O diagnóstico formato 2 inclui apenas geometria/estilos e categorias fixas (share/menu/files/other), nunca títulos ou rótulos completos. Os zero turns no relatório do Work também indicam que o seletor de mensagens não foi validado para essa variante; isso não foi alterado por esta revisão do cabeçalho.

## Retorno real do Work · 0.2.1

O diagnóstico 0.2.0 (Firefox 155, viewport 2338 × 1171, pixel ratio 0,8) registra sete mensagens por papel, mas nenhum article de turno. O suposto cabeçalho era um div dentro de uma section de mensagem, com cinco controles de resposta e coordenada vertical negativa. Isso explica tanto as ações removidas da posição original quanto a ausência dos controles verdadeiros na faixa de contexto. A revisão exclui o envelope completo de cada mensagem da detecção de cabeçalho.

A estrutura registrada separa raciocínio, conteúdo final e feedback em ramos irmãos. A revisão dimensiona seu envelope comum e aplica a fonte aos acessórios, preservando nós e eventos. As oito camadas externas detectadas do composer já eram transparentes: o antigo teto de busca podia deixar camadas superiores intactas. A nova busca é mais profunda, limitada pelas fronteiras funcionais do chat.

O aside direito foi medido em y=52, altura 517 e largura 300, sob as barras nAGI. A revisão calcula o deslocamento a partir da altura real do shell, reserva margem de 12 px e limita a altura disponível. Não move conteúdo entre documentos.

Essas evidências orientam fixtures estruturais e testes de geometria simulada. Não equivalem a uma inspeção autenticada da 0.2.1. O diagnóstico formato 4 amplia amostras de ancestrais, envelopes, acessórios e painéis mantendo a lista permitida de atributos, estilos e categorias sem texto privado.

## Retorno do usuário · 0.2.2

O usuário confirmou que a revisão 0.2.1 ficou quase toda correta e apontou cards curtos do usuário ocupando a largura inteira. A causa estava na regra comum de largura de mensagens agrupadas. A 0.2.2 preserva o envelope de raciocínio/ações e aplica encolhimento apenas ao card do usuário.

A solicitação também esclarece o contrato de ativação: tema integra nAGI, sem opt-in separado. A migração descarta o campo antigo e preserva os valores de paleta e fonte. Network permanece o preset padrão entre as paletas disponíveis. A sidebar começa oculta na instalação limpa; preferências posteriores continuam salvas.

O indicador Thinking utiliza a fase estimada pelo adapter existente. Enquanto o site não monta a nova mensagem assistente, há um indicador próprio do nAGI, excluído dos seletores de mensagens e prompts. Ao montar a resposta, apenas a identidade própria muda de posição, mantendo o DOM nativo intacto. Não há novo acesso a APIs ou conteúdo privado.
