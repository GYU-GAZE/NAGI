# Arquitetura

## Fronteiras

`content.ts` inicia `app.ts`, que compõe serviços independentes. `adapter/chatgpt.ts` concentra descoberta de conversas, navegação, composer e sinais de geração. Os seletores candidatos ficam em `adapter/selectors.ts`. `GenerationTracker` é uma máquina de estados testável sem DOM.

`features/appearance.ts`, `performance.ts` e `send-guard.ts` não consultam endpoints do ChatGPT. `ui/` constrói elementos seguros via DOM e `textContent`, com a barra em Shadow DOM e os painéis editáveis em um iframe local sem scripts, sem framework de runtime. A fronteira de documento impede que eventos de teclado dos painéis percorram o document/window do ChatGPT. Os elementos e handlers são criados pelo content script, sem HTML fornecido pelo usuário. O iframe não pode carregar recursos remotos; sua navegação e seu tamanho são controlados pelo nAGI. O editor de configurações é reutilizado na página de opções, disponível mesmo se o content script quebrar.

`shared/platform.ts` é o transporte WebExtensions. As APIs `chrome.*` usadas são o subconjunto de callbacks/Promises também exposto pelo Firefox. O build gera background service worker para Chromium e background scripts para Firefox. O schema da extensão exige Firefox 140+; Chromium 121+. Os builds foram compilados, mas ainda não carregados em navegadores reais nesta execução.

## Dados e concorrência

`background/coordinator.ts` é o único escritor dos dados persistentes. Toda leitura-modificação-gravação passa por uma fila serial. Rejeições não quebram a fila. Configurações aceitam patches validados; edições de Persona e Chain exigem a versão esperada, evitando que um editor antigo sobreponha outro.

`storage.local.nagi`: schema 1, revisão, configurações, Personas com histórico, Chains com sessões. `storage.session`: conjunto de reservas de envio (`locks`) e seleções por ID de aba + caminho de conversa. Avatar é uma data URL local. Não há cópia de conteúdo das conversas no storage; títulos e URLs de sessões adicionadas manualmente são metadados locais.

`migrate()` reconhece instalação nova, valida schema 1 e recusa schemas desconhecidos/corrompidos sem substituir dados por defaults. A primeira migração entre versões será adicionada quando surgir um schema 2 real. Limites atuais: 30 Personas, 100 Chains, 500 sessões/Chain e 8 MB no documento local total. Histórico não é apagado silenciosamente para caber na quota.

## Envio a partir da 0.2.5

`SendGuard` faz somente validação síncrona da Persona e deixa o evento nativo continuar uma vez. Não aguarda o background, consulta reservas nem bloqueia outra aba. Personas com instruções ainda exigem a escolha explícita de “Somente visual”, porque a extensão não aplica instruções na conta.

Um registro transitório da origem do primeiro envio permite transferir a seleção para a URL definitiva do chat, inclusive com fase desconhecida. Links de navegação e popstate cancelam esse registro; ele expira em 60 segundos e é consumido na mudança de rota. Não há rascunho persistido ou fila de envio.

O protocolo antigo `locks` permanece no background apenas por compatibilidade com abas ainda carregadas na versão anterior. Não participa do envio novo, não aparece como trava global nas configurações e não deve fundamentar uma futura escrita de Custom Instructions sem validação do comportamento real do produto.

## Navegação nativa a partir da 0.2.5

`adapter/navigation.ts` resolve linhas de chats, seções pinnadas e destinos dentro das regiões de sidebar. `features/navigation-dock.ts` posiciona os nós originais nos espaços do painel/toolbar sem reparentar React ou copiar handlers. Os caminhos de uma sidebar ocultada são revelados somente para esses controles; os demais elementos continuam invisíveis. O iframe continua isolando os editores de opções. Menus e diálogos nativos permanecem no documento original.

Fechar o painel retira as marcas das linhas; pausar restaura todos os controles. Rolagem do iframe e da toolbar atualiza as posições e oculta controles cujo espaço saiu da área visível. O atalho Pin exige associação do menu por aria-controls ou aria-labelledby, revalida conversa/rota e nunca seleciona outra ação. Não há ações de conta na montagem.

Projects não mantém cache persistente de outra conta nem usa endpoints internos: mostra os dados disponíveis na página e oferece expansão nativa quando presente. Isso não equivale a um inventário completo.

## Desempenho e recuperação

MutationObserver filtra alterações produzidas pelo nAGI e agrupa verificações a cada 160 ms. Um fallback de 1 s detecta mudanças de rota sem patch de `history`/React e ajuda a estabilizar fim de geração. A extração de texto examina apenas o último candidato de resposta, sem logging. O tamanho do DOM nativo ainda afeta o custo de queries; isso precisa ser medido em produção.

O experimento marca somente turnos antigos. Mantém a cauda recente e exclui turnos contendo foco, iframe, canvas, vídeo, áudio ou conteúdo editável. Nenhum elemento React é removido ou reparentado. Ctrl+F/seleção/cópia devem ser verificados no navegador real; `content-visibility` preserva o conteúdo no DOM, mas o comportamento de widgets precisa de teste.

Erros de módulos são isolados na composição. A pausa remove os efeitos ativos, devolve sidebar e mantém um controle mínimo. O popup/options oferece uma segunda entrada. A extensão não pede permissões de cookies, webRequest, debugger, identidade ou leitura geral do histórico. A única permissão de API é storage; host limitado a `https://chatgpt.com/*`.

## Próximo marco

Validar DOM em conta autenticada PT-BR/EN, registrar contratos de settings e Projects, testar envio/edit/regenerate/voice e falhas de rede. Só então implementar read/backup/write/verify/restore de Custom Instructions por UI visível e continuação manual com verificação explícita do Project. Activity Log, auto-rollover e layouts customizados vêm após essas bases. Não há necessidade de infraestrutura remota.

## Regiões e diagnóstico (0.1.1)

`adapter/regions.ts` identifica a estrutura de sidebar/composer sem cadeias de classes utilitárias. O sidebar candidato não pode conter `main`, composer ou mensagens; o fallback estrutural exige uma região de chat identificada independentemente. Marcas CSS são reversíveis e atualizadas quando React substitui nós. `Appearance.refreshRegions` não reescreve o CSS a cada mutação.

`features/diagnostics.ts` serializa somente uma lista explícita de configurações e propriedades estruturais/computadas. IDs e classes arbitrários, texto, atributos livres, HTML, URLs e entidades privadas não entram no arquivo. O usuário escolhe baixar ou copiar o JSON e enviá-lo junto do print. Nenhum endpoint ou upload é usado.
