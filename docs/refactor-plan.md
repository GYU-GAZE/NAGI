# nAGI — Conversation Infrastructure & QoL Overhaul

Você está trabalhando no projeto nAGI, uma extensão de navegador que modifica e amplia a interface web do ChatGPT.

Use a versão atual do projeto fornecida nesta tarefa como fonte de verdade. Antes de editar qualquer coisa, examine a arquitetura existente, os adapters do ChatGPT, estado, UI, settings, navigation, personas, chains, performance, testes e qualquer documentação interna relevante.

Não assuma que nomes de arquivos, APIs internas ou estruturas descritas neste prompt existem exatamente dessa forma. Este documento descreve comportamento, arquitetura desejada e objetivos. Adapte a implementação ao projeto real mantendo sua arquitetura sempre que ela já for adequada.

O objetivo desta tarefa é fazer uma grande evolução interna e funcional do nAGI, principalmente em:

- navegação por conversas longas
- indexação persistente de mensagens
- busca
- bookmarks e organização
- performance
- continuidade entre sessões
- redução de feature creep visual
- acesso rápido a funções sem entupir a toolbar

A prioridade é criar infraestrutura sólida primeiro e interfaces em cima dela depois.

Não implemente atalhos frágeis apenas para "fazer funcionar".

---

# PRINCÍPIOS DO PROJETO

Preserve estes princípios durante toda a implementação:

1. Local-first.

Dados estruturais do nAGI devem continuar locais sempre que possível.

2. Não depender de endpoints privados do ChatGPT quando a funcionalidade puder ser implementada com segurança usando a interface e o estado local já disponíveis.
3. Falhar fechado.

Quando uma ação de UI não puder ser identificada com segurança, não clique em algo "parecido".

4. Não duplicar controles nativos perigosos.

Ações como excluir, arquivar ou outras operações sensíveis devem continuar delegadas ao controle nativo quando possível.

5. O DOM do ChatGPT é uma fonte transitória, não o banco de dados do nAGI.

Essa mudança é central nesta tarefa.

6. Não adicionar botões permanentes para cada nova feature.

Features secundárias devem poder ser acessadas por menus, painel contextual ou Command Palette.

7. Não sacrificar performance para implementar ferramentas de performance.
8. Toda nova feature deve funcionar razoavelmente em conversas pequenas e enormes.

Considere cenários com:

- 20 mensagens
- 200 mensagens
- 1.000 mensagens
- milhares de mensagens indexadas localmente

9. Não adicionar telemetria externa.
10. Preserve a identidade visual Network existente, mas reduza densidade e redundância.

---

# OBJETIVO ARQUITETURAL CENTRAL

Atualmente, recursos como o Prompt Navigator dependem principalmente das mensagens que estão carregadas no DOM naquele momento.

Isso deve deixar de ser a arquitetura principal.

Crie uma camada persistente que represente a estrutura da conversa independentemente de quais elementos estão atualmente montados/renderizados pelo ChatGPT.

Conceitualmente:

ChatGPT DOM
→ descoberta incremental
→ ConversationIndex / MessageRegistry
→ Search
→ Prompt Navigator
→ Bookmarks
→ Outline
→ Performance Mode
→ Export
→ Chains / continuity

O DOM deve passar a ser apenas uma das fontes usadas para hidratar esse índice.

---

# FASE 0 — AUDITORIA E BASELINE

Antes de implementar:

- rode os testes existentes
- registre o baseline
- identifique como mensagens são descobertas atualmente
- identifique quantas vezes `resolveMessages`, equivalentes ou scanners de DOM são chamados
- identifique MutationObservers e timers periódicos
- identifique como conversation ID é obtido
- identifique como turns são identificados
- identifique como role user/assistant é detectada
- identifique como o scroll atual funciona
- identifique como o Prompt Navigator atual funciona
- identifique o storage atual e seus limites
- identifique qualquer dependência de objetos gigantes serializados de uma vez

Não reescreva arquitetura que já está adequada sem necessidade.

Após entender isso, implemente as fases abaixo em ordem.

---

# FASE 1 — MESSAGE REGISTRY / CONVERSATION INDEX

Essa é a fundação de todo o restante.

Implemente um registro central de mensagens por conversa.

O nome exato pode seguir os padrões do projeto, mas conceitualmente teremos algo equivalente a:

```ts
interface IndexedMessage {
  id: string
  conversationId: string

  role: "user" | "assistant"
  order: number

  preview: string
  text?: string

  loaded: boolean

  attachmentTypes?: string[]

  pinned?: boolean
  labels?: string[]
  note?: string

  headings?: IndexedHeading[]

  // referência transitória, nunca necessária para persistência
  node?: WeakRef<HTMLElement>
}

```

E uma estrutura central equivalente a:

```ts
ConversationIndex {
  messages
  prompts

  indexedCount
  loadedCount

  add(...)
  update(...)
  hydrate(...)
  dehydrate(...)
  search(...)
  jump(...)
}

```

Não copie literalmente essas interfaces se outra modelagem fizer mais sentido.

## Requisitos

O índice precisa:

- sobreviver ao elemento sair do DOM
- sobreviver a reload da página
- separar claramente "indexed" de "currently loaded"
- preservar ordem de conversa
- evitar duplicatas
- reconciliar mensagens descobertas em momentos diferentes
- suportar mensagens recém-enviadas
- permitir consultas sem escanear novamente todo o DOM
- ser compartilhado pelos recursos que precisem de mensagens

Evite sistemas paralelos em que Prompt Navigator, performance e bookmarks mantenham listas próprias.

---

# FASE 2 — PERSISTÊNCIA ADEQUADA

Use IndexedDB ou solução equivalente apropriada para dados potencialmente grandes.

Não faça o Conversation Index crescer dentro de um único objeto global salvo integralmente a cada alteração.

Estruture storage por responsabilidade.

Exemplo conceitual:

```text
lightweight settings/state
  personas metadata
  chains metadata
  UI preferences

IndexedDB
  conversation indexes
  message metadata
  bookmarks
  notes
  avatar blobs
  future activity data

```

Não é obrigatório migrar todos os dados imediatamente se isso aumentar risco desnecessariamente.

Porém:

- o novo Conversation Index deve usar armazenamento apropriado
- evite reserializar megabytes para alterar uma preferência simples
- blobs/imagens grandes não devem continuar crescendo indefinidamente dentro do estado global principal

Implemente versionamento/migração de schema.

Não destrua dados existentes do usuário.

---

# FASE 3 — CAPTURA INCREMENTAL

Pare de pensar em "scan completo periódico" como mecanismo principal.

Quando uma nova mensagem aparece:

- detecte-a
- identifique role
- determine sua ordem
- associe à conversa
- extraia preview/metadados necessários
- adicione ou atualize o índice

Quando o usuário envia um prompt e for possível observar a ação com segurança:

- registre o prompt imediatamente ou crie um registro pending
- reconcilie com o turn real assim que o ChatGPT o renderizar

Conceito:

```text
SEND
↓
prompt conhecido localmente
↓
index entry pending
↓
ChatGPT cria turn
↓
reconciliation
↓
entry hydrated

```

Evite depender de leitura repetida de todo o histórico.

---

# FASE 4 — BACKFILL DE CONVERSAS ANTIGAS

O nAGI precisa conseguir indexar conversas criadas antes da instalação ou antes dessa versão.

Crie um processo explícito de backfill.

UX conceitual:

```text
487 indexed
32 currently loaded

[ Index older history ]

```

Ao ativar:

1. preserve a posição atual do usuário
2. carregue progressivamente mensagens antigas usando a UI existente
3. capture tudo que surgir
4. continue até:
   - atingir o início
   - não haver progresso
   - usuário cancelar
5. restaure adequadamente o scroll original

Mostre progresso:

```text
Indexing older history

67 / ?
128 / ?
231 / ?

```

Não faça backfill agressivo automaticamente em toda abertura de chat.

Após uma conversa ser indexada, reabra-a usando o índice persistido sem precisar carregar tudo novamente.

Trate falhas e alterações do DOM de maneira defensiva.

---

# FASE 5 — PROMPT NAVIGATOR 2.0

Reimplemente o Prompt Navigator como uma interface do Conversation Index.

Ele não deve mais significar:

"prompts atualmente encontrados no DOM"

Ele deve significar:

"prompts conhecidos desta conversa"

Mostre separadamente:

- total indexed
- total loaded/rendered atualmente

Exemplo:

```text
PROMPTS

487 indexed
31 loaded

[ Search conversation... ]

001  primeiro prompt...
002  segundo...
...
381  atual

```

## Requisitos

- painel redimensionável
- estado aberto/fechado persistido
- keyboard navigation
- highlight do prompt atual
- jump para prompt
- preview maior que o atual
- Top
- Bottom
- filtros
- lista virtualizada

NÃO renderize 1.000 botões para 1.000 prompts.

Implemente list virtualization.

Renderize apenas uma janela em torno dos itens visíveis.

---

# FASE 6 — TRACKING DO PROMPT ATUAL

Remova estratégias do tipo:

```ts
for every prompt:
  getBoundingClientRect()

```

executadas repetidamente durante scroll.

Use `IntersectionObserver` ou mecanismo equivalente.

O objetivo é fazer o browser informar quais turns relevantes cruzaram a região ativa da viewport.

Use `ResizeObserver` quando necessário para alterações do header/layout.

Evite layout thrashing.

---

# FASE 7 — SEARCH LOCAL DA CONVERSA

Implemente busca full-text em cima do índice persistente.

Atalho desejado:

```text
Ctrl+Shift+F

```

ou equivalente caso exista conflito.

A busca deve permitir encontrar:

- prompts do usuário
- respostas do assistant
- bookmarks
- notas
- headings

Filtros:

```text
All
User
Assistant
Bookmarked
Attachments

```

Busca deve ser:

- case-insensitive
- accent-insensitive

Exemplo:

```text
configuração
configuracao
CONFIGURACAO

```

devem casar adequadamente.

Considere CJK desde o início.

Não dependa exclusivamente de tokenização por espaços.

Substring, n-grams/bigrams ou estratégia similar pode ser necessária para japonês/chinês.

Ao clicar no resultado:

- revele/hidrate o turn se necessário
- navegue até ele
- destaque temporariamente o trecho encontrado

---

# FASE 8 — RESPONSE OUTLINE / TABLE OF CONTENTS

Extraia headings relevantes das respostas do assistant.

No navigator, uma resposta pode possuir filhos:

```text
Prompt 34
├ arquitetura
├ storage
├ indexing
│ ├ reconciliation
│ └ persistence
└ roadmap

```

Clique em heading deve navegar diretamente até aquele ponto da resposta.

Não mantenha uma cópia redundante completa do HTML.

Armazene apenas metadata suficiente para reconstruir a navegação.

O outline deve poder ser recolhido.

---

# FASE 9 — BOOKMARKS, LABELS E NOTES POR MENSAGEM

Permita marcar mensagens individuais.

Cada bookmark pode possuir:

- bookmark simples
- labels
- nota opcional

Exemplos de labels default ou visuais:

```text
★ important
! bug
? investigate
✓ decision

```

Não force taxonomia fixa.

Usuário deve poder criar labels próprias posteriormente.

No Navigator:

```text
ALL 487
★ 12
! 4
✓ 19

```

A busca também precisa enxergar bookmarks/labels/notes.

Bookmarks devem ser salvos independentemente de o turn estar carregado no DOM.

---

# FASE 10 — COLLAPSE / FOCUS MODE

Implemente:

- Collapse this turn
- Expand this turn
- Collapse all except current
- Expand all

Não destrua dados nem remova permanentemente o turn.

A UI deve conseguir representar um turn colapsado com altura pequena.

Exemplo:

```text
▶ User prompt 381 — "consegue analisar esse sistema..."

```

Preserve scroll da melhor maneira possível.

---

# FASE 11 — PERFORMANCE MODE

Mantenha o comportamento atual mais conservador como modo seguro.

Estrutura desejada:

```text
Performance Mode

Off

Safe
  content-visibility
  low-risk optimizations

Aggressive
  virtualization of old turns
  progressive reveal

```

## Aggressive

Implemente opcionalmente uma forma de virtualizar turns antigos.

Não simplesmente delete elementos aleatoriamente.

Use estratégia paginada/chunked.

Exemplo conceitual:

```text
1-100     hidden
101-200   hidden
201-260   hidden
261-290   rendered

```

Ao navegar para Prompt 47:

```text
reveal relevant chunk
↓
wait for stable layout
↓
scroll to prompt

```

Use:

- IntersectionObserver
- progressive reveal
- scroll anchoring
- placeholders/spacers quando necessário

O usuário deve poder desligar Aggressive imediatamente caso algo dê errado.

Aggressive deve ser opt-in.

Nunca faça Aggressive default antes de testes robustos.

---

# FASE 12 — COMMAND PALETTE

Adicione uma Command Palette central.

Atalho preferencial:

```text
Ctrl+K

```

desde que não conflite de forma destrutiva com o ChatGPT/browser.

Ela deve possuir fuzzy search.

Exemplo:

```text
> pin

Pin current chat
Open pinned chats
Bookmark current message

```

```text
> chain

Open Conversation Chains
Create Chain
Continue Chain

```

```text
> persona

Select Persona
Manage Personas

```

```text
> appearance

Theme
Accent
Typography

```

A Command Palette deve ser a solução estrutural para feature creep.

Funções secundárias não precisam ganhar botão permanente.

---

# FASE 13 — SIMPLIFICAR TOOLBAR

Depois que a Command Palette existir, simplifique a toolbar.

Priorize algo próximo de:

```text
Home
New Chat
Recent
Pinned
Projects
Chains
Settings

```

Itens como:

```text
Scheduled
Plugins
Codex
More

```

não precisam ser top-level permanentemente.

Agrupe-os em overflow/menu apropriado.

Se determinado recurso nativo não existir ou não tiver sido resolvido com confiança:

- esconda-o

Não mantenha uma fileira de botões desabilitados.

Não use horizontal scrolling como solução principal para excesso de ações.

---

# FASE 14 — PERSONA UI

Existe redundância atual de Persona/Answer With em diferentes regiões.

Escolha um local principal de interação.

Preferência:

```text
composer
Answer with: nAGI

```

Esse deve ser o seletor primário.

Outras regiões podem mostrar identidade/status sem repetir o mesmo controle completo.

Exemplo:

Toolbar:

```text
[avatar] nAGI

```

Composer:

```text
Answer with: nAGI ▾

```

Context bar só deve mostrar Persona quando houver informação contextual útil.

Não repita o mesmo seletor três vezes.

---

# FASE 15 — CHAINS

Revise o modelo de Conversation Chains.

Alguns campos atuais só fazem sentido quando a continuidade estiver implementada de verdade.

Implemente o fluxo:

```text
Chain
Session 1
Session 2
Session 3 [current]

[ Continue in new chat ]

```

Ao continuar:

- criar nova conversa usando os mecanismos seguros disponíveis
- associar a nova sessão à Chain
- atualizar currentSession
- preservar Persona quando aplicável
- preservar Project quando possível e seguro
- usar continuationMessage apenas quando a feature realmente existir

Não mantenha campos editáveis mortos na UI.

## Project

Não exponha Project ID cru para uso normal.

Prefira:

```text
Project
[ Null Network ▾ ]

[ Use current Project ]

```

Se a integração ainda não puder ser feita com segurança:

- esconda a feature incompleta
- não finja que metadata manual produz continuidade real

## currentSession

currentSession precisa ter semântica real.

Abrir uma Chain deve conseguir levar à sessão atual.

Adicionar uma sessão deve atualizar currentSession.

---

# FASE 16 — CONTINUATION / HANDOFF

Quando `Continue in new chat` existir, use o Conversation Index para construir continuidade de maneira inteligente.

Não envie automaticamente a conversa inteira.

Construa um handoff baseado em:

- Chain metadata
- sessão anterior
- bookmarks importantes
- decisões marcadas
- Persona
- notas do usuário
- mensagem de continuação definida

Estruture isso de forma extensível para uma futura feature de compactação/sumarização.

Não introduza chamadas externas ou IA adicional sem necessidade.

---

# FASE 17 — RECENT PROMPT HISTORY

No composer, adicione acesso rápido ao histórico de prompts do usuário.

Preferência:

```text
Alt+↑
Alt+↓

```

caso não conflite.

Permita percorrer prompts anteriores sem enviar.

Não capture conteúdo de campos sensíveis fora do composer do ChatGPT.

Integre com Conversation Index quando possível.

---

# FASE 18 — CONVERSATION TREE

Depois da infraestrutura anterior estar estável, implemente uma visualização opcional das branches/edits/regenerations que puderem ser identificadas com segurança.

Objetivo conceitual:

```text
Prompt A
├ Response A1
│ └ Prompt B
│    ├ Response B1
│    └ Response B2
└ Response A2

```

Não invente relações que não sejam observáveis.

Se o ChatGPT não expuser informação suficiente com segurança, degrade graciosamente.

Essa feature é posterior e não deve bloquear as anteriores.

---

# FASE 19 — BACKUP / EXPORT / IMPORT

Essa feature é obrigatória antes que o usuário acumule uma quantidade grande de dados.

Implemente:

```text
Export nAGI Backup
Import nAGI Backup

```

O backup deve possuir:

- schema version
- settings
- personas
- chains
- bookmarks
- notes
- conversation indexes quando apropriado
- referências/assets necessários

Valide import rigorosamente.

Não confie cegamente em JSON importado.

Posteriormente ou se for simples:

```text
Export Persona
Export Chain
Export Theme

```

Também permita exportar uma conversa/index em formato legível quando possível.

---

# FASE 20 — SETTINGS VISUAIS

O painel de Settings deve herdar o tema atual.

Não hardcode um segundo design desconectado.

Passe variáveis equivalentes a:

```css
--nagi-ui-bg
--nagi-ui-panel
--nagi-ui-text
--nagi-ui-muted
--nagi-ui-font
--nagi-accent

```

Themes claros, escuros e customizados precisam continuar legíveis.

## Accent contrast

Determine automaticamente foreground claro/escuro com base na luminância do accent.

Não use sempre texto escuro sobre qualquer accent.

## Avatar rendering

Adicione:

```text
Avatar Rendering

Auto
Pixel Art
Smooth

```

`image-rendering: pixelated` não deve ser obrigatório para imagens normais.

---

# FASE 21 — REDUZIR ALTURA E DENSIDADE VISUAL

Preserve a identidade Network.

Não redesenhe tudo como aplicativo corporativo genérico.

Porém reduza consumo de viewport.

Alvos aproximados:

```text
toolbar
~60-68px

context strip
~38-42px

```

Não trate esses números como requisito rígido se o layout real pedir ajustes.

Considere modo:

```text
Brand
Expanded
Compact

```

Expanded:

```text
nAGI
MORE CONTEXT
DEEPER THOUGHT
A BRIGHTER YOU

```

Compact:

```text
nAGI

```

Também considere densidade:

```text
Message Layout
Comfortable
Compact

```

Não diminua legibilidade excessivamente.

---

# FASE 22 — PERFORMANCE INTERNA DO PRÓPRIO nAGI

Revise observadores e scanners existentes.

O objetivo é eliminar situações onde uma mudança pequena resulta em múltiplos scans completos da conversa.

Evite cadeias equivalentes a:

```text
snapshot
→ resolveMessages

turns
→ resolveMessages

shell update
→ resolveMessages

message layout
→ resolveMessages

```

Centralize descoberta no Message Registry.

Os outros recursos devem consultar cache/index.

Instrumente em modo debug:

- quantidade de scans
- quantidade de mensagens processadas
- tempo do scan
- eventos MutationObserver
- tamanho do índice
- loaded count
- indexed count

Não envie essas métricas externamente.

São apenas diagnostics locais.

---

# FASE 23 — CSS / REPAINT

Revise backgrounds e layers visuais.

Se o grid/background atual estiver aplicado repetidamente em várias superfícies usando propriedades caras como `background-attachment: fixed`, considere centralizá-lo em uma layer fixa única.

Preserve a estética.

Meça antes/depois quando possível.

Não faça micro-otimização destrutiva sem evidência.

---

# TESTES

Cada fase deve receber testes adequados.

Não deixe todos os testes para o final.

Precisamos especialmente de testes para:

## Conversation Index

- adicionar mensagens
- evitar duplicatas
- preservar order
- hydrate/dehydrate
- persist/reload
- conversation isolation

## Search

- case folding
- accent folding
- CJK
- filters
- bookmarks
- notes

## Backfill

- progresso
- cancelamento
- ausência de progresso
- restore scroll
- deduplication

## Navigator

- zero prompts
- poucos prompts
- centenas/milhares de itens
- virtualization
- jump
- item unloaded

## Bookmarks

- persistence
- delete
- labels
- note updates

## Performance Mode

- Off
- Safe
- Aggressive
- navigation para chunk escondido
- restore layout
- disable/recovery

## Storage migration

- instalação nova
- estado antigo
- estado parcialmente corrompido
- import inválido

## Chains

- session creation
- currentSession
- Persona references
- Project references
- conflicts/versioning

Corrija também qualquer bug atual em que alterar/excluir uma Persona incremente versões de Chains que não foram realmente modificadas.

Versione apenas entidades efetivamente alteradas.

---

# PERFIL DE PERFORMANCE

Faça testes manuais/sintéticos com escalas diferentes.

Pelo menos:

```text
20 turns
200 turns
1,000 turns
5,000 indexed entries

```

Avalie:

- abertura do navigator
- scroll
- busca
- mutation processing
- memória
- mudança de conversa
- geração de resposta
- reopen de conversa indexada

O nAGI não precisa manter 5.000 message nodes vivos.

Esse é justamente o motivo do índice + virtualização.

---

# REGRAS DE UX

Não transformar o nAGI em um cockpit.

Toda feature nova deve responder:

"isso precisa realmente estar visível o tempo todo?"

Se a resposta for não:

- Command Palette
- context menu
- overflow
- settings
- painel do Navigator

Prefira progressive disclosure.

Recursos avançados devem existir sem dominar a interface.

---

# NÃO IMPLEMENTAR COMO PRIORIDADE

Não gastar esta tarefa com:

- streaks
- achievements
- usage heatmaps
- prompt marketplace
- prompt-of-the-day
- dashboard genérico
- AI prompt optimizer
- gamificação
- galerias sem relação com a proposta central
- widgets decorativos
- character creator antes da infraestrutura central estar completa

O nAGI deve continuar focado em:

```text
navigation
identity
context
continuity
performance

```

---

# ORDEM DE IMPLEMENTAÇÃO

Siga esta ordem geral e não pule para features posteriores por serem visualmente mais interessantes:

1. Audit / baseline
2. Conversation Index / Message Registry
3. IndexedDB / persistence
4. Incremental capture
5. Backfill
6. Prompt Navigator 2.0
7. Intersection-based current tracking
8. Search
9. Response Outline
10. Bookmarks / labels / notes
11. Collapse / Focus
12. Performance Safe/Aggressive
13. Command Palette
14. Toolbar simplification
15. Persona UI cleanup
16. Chains completion
17. Continuation / handoff
18. Recent prompt history
19. Conversation Tree
20. Backup / Import / Export
21. Settings theme inheritance
22. Density / layout polish
23. Performance audit and cleanup

Se uma fase revelar que uma etapa posterior depende de uma pequena fundação que precise ser criada antes, faça o mínimo necessário e documente a decisão.

Não implemente fases fora de ordem simplesmente para produzir mudanças visuais rápidas.

---

# COMO TRABALHAR

Você tem autonomia para editar o projeto.

Não me peça confirmação entre cada pequena etapa.

Antes de mudanças destrutivas, preserve compatibilidade ou implemente migração.

A cada marco relevante:

- rode testes
- corrija regressões
- continue

Não deixe dezenas de TODOs como substituto de implementação.

Se uma feature não puder ser implementada com segurança devido às limitações reais do DOM/API do ChatGPT:

1. não faça guessing perigoso
2. implemente a parte segura
3. degrade graciosamente
4. documente exatamente o que ficou bloqueado

Não invente endpoints privados.

Não faça monkeypatch desnecessário em APIs globais.

Não introduza dependências grandes sem necessidade clara.

---

# DOCUMENTAÇÃO

Atualize documentação relevante conforme a implementação.

Inclua uma arquitetura resumida mostrando:

```text
ChatGPT DOM / user actions
        ↓
DOM Adapter
        ↓
Message Registry
        ↓
Conversation Index
        ↓
IndexedDB
        ↓
┌───────────────────────────────┐
│ Navigator                     │
│ Search                        │
│ Outline                       │
│ Bookmarks                     │
│ Chains                        │
│ Performance virtualization    │
│ Export                        │
└───────────────────────────────┘

```

Documente também:

- schema de storage
- migration strategy
- Aggressive Performance Mode
- recovery/failsafe
- keyboard shortcuts
- Command Palette
- backup format

---

# DEFINITION OF DONE

A tarefa não está concluída apenas porque o visual mudou.

O resultado final precisa demonstrar:

- Conversation Index persistente funcionando
- prompts não desaparecem do índice quando saem do DOM
- chats antigos podem sofrer backfill
- navigator consegue representar histórico maior que o DOM atual
- lista do navigator é virtualizada
- scroll tracking não mede centenas de elementos continuamente
- busca local funciona
- response outline funciona
- bookmarks/labels/notes funcionam
- collapse/focus funciona
- Performance Safe continua estável
- Aggressive existe apenas como modo opcional e recuperável
- Command Palette reduz necessidade de toolbar enorme
- toolbar fica visualmente menor
- Persona deixa de aparecer como controle redundante em múltiplos lugares
- Chains possuem currentSession funcional
- backup/import/export existem
- settings respeitam tema
- storage foi preparado para crescimento
- testes antigos continuam passando ou foram corretamente atualizados
- novos testes cobrem a nova infraestrutura
- nenhuma regressão importante no ChatGPT vanilla quando nAGI é pausado/desativado

---

# RESULTADO DESEJADO

Depois dessa evolução, o nAGI deve conseguir abrir uma conversa enorme e pensar nela como um documento persistente estruturado.

Mesmo que o ChatGPT só tenha alguns turns montados no DOM, o nAGI deve conhecer o histórico que já indexou.

Isso permitirá:

```text
Search
Bookmarks
Outline
Chains
Jump
Collapse
Performance virtualization
Continuation
Export

```

sem precisar reaprender a conversa inteira a cada segundo.

O Prompt Navigator deixa de ser um simples atalho para elementos existentes na página.

Ele passa a ser a interface visível de uma memória estrutural local da conversa.

Essa é a mudança arquitetural mais importante desta tarefa.

Priorize fazer essa fundação extremamente bem.