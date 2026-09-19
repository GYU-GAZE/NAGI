# Arquitetura

## Fronteiras

`content.ts` inicia `app.ts`, que compõe serviços independentes. `adapter/chatgpt.ts` concentra descoberta de conversas, navegação, composer e sinais de geração. Os seletores candidatos ficam em `adapter/selectors.ts`. `GenerationTracker` é uma máquina de estados testável sem DOM.

`features/appearance.ts`, `performance.ts` e `send-guard.ts` não consultam endpoints do ChatGPT. `ui/` constrói elementos seguros via DOM e `textContent`, com a barra em Shadow DOM e os painéis editáveis em um iframe local sem scripts, sem framework de runtime. A fronteira de documento impede que eventos de teclado dos painéis percorram o document/window do ChatGPT. Os elementos e handlers são criados pelo content script, sem HTML fornecido pelo usuário. O iframe não pode carregar recursos remotos; sua navegação e seu tamanho são controlados pelo nAGI. O editor de configurações é reutilizado na página de opções, disponível mesmo se o content script quebrar.

`shared/platform.ts` é o transporte WebExtensions. As APIs `chrome.*` usadas são o subconjunto de callbacks/Promises também exposto pelo Firefox. O build gera background service worker para Chromium e background scripts para Firefox. O schema da extensão exige Firefox 140+; Chromium 121+. Os builds foram compilados, mas ainda não carregados em navegadores reais nesta execução.

## Dados e concorrência

`background/coordinator.ts` é o único escritor dos dados persistentes. Toda leitura-modificação-gravação passa por uma fila serial. Rejeições não quebram a fila. Configurações aceitam patches validados; edições de Persona e Chain exigem a versão esperada, evitando que um editor antigo sobreponha outro.

`storage.local.nagi`: schema 1, revisão, configurações, Personas com histórico, Chains com sessões. `storage.session`: conjunto de reservas de envio (`locks`) e seleções por ID de aba + caminho de conversa. Avatar é uma data URL local. Não há cópia de conteúdo das conversas no storage; títulos e URLs de sessões adicionadas manualmente são metadados locais.

`migrate()` reconhece instalação nova, valida schema 1 e recusa schemas desconhecidos/corrompidos sem substituir dados por defaults. A primeira migração entre versões será adicionada quando surgir um schema 2 real. Limites atuais: 30 Personas, 100 Chains, 500 sessões/Chain e 8 MB no documento local total. Histórico não é apagado silenciosamente para caber na quota.

## Transação de envio do marco 1

1. Listener captura envio reconhecido por botão, Enter ou submit do composer.
2. Confere Persona selecionada; com instruções e sem confirmação visual, bloqueia.
3. Confere que o adapter estima idle.
4. Solicita reserva ao background, com owner tabId + instanceId + token da transação. Abas diferentes com a mesma Persona podem coexistir; uma Persona diferente ou outra transação na mesma aba aguarda.
5. Reconfere rascunho, composer, rota, flags e versão da Persona após a operação assíncrona.
6. Libera exatamente um clique nativo; não recria a requisição nem copia o texto para APIs.
7. Observa início de geração e só libera ao retornar a idle, ou em cancelamento anterior ao envio.

A espera guarda o contexto no content script e só é iniciada por escolha explícita. Não persiste o rascunho. Cancelar, editar o texto, mudar de rota/Persona ou desabilitar o módulo invalida a espera, inclusive enquanto uma consulta assíncrona está em andamento.

As reservas não usam TTL. Suspensão do worker não perde ownership porque o conjunto fica em session storage. A trava única de versões anteriores é migrada sem descartá-la. Consultas do envio usam seu próprio token; liberar uma reserva não libera as demais. Uma Persona diferente aguarda a liberação de todas as reservas do grupo atual. Fechamento/reload torna o owner órfão, mas não presume que a geração remota acabou. Liberação manual exige o token observado. Uma nova instância não pode liberar silenciosamente o lock de outra. Se o usuário navegar para outra conversa durante a resposta, o idle daquela conversa não libera a transação anterior.

**Este protocolo NÃO aplica Custom Instructions.** É a fundação de concorrência, testada independentemente, para uma futura transação de read → backup → write → verify. A interface não informa “Persona aplicada” nem envia silenciosamente sob essa alegação. Abas externas ao protocolo, outros dispositivos, regeneração e voz não estão cobertos. Uma integração futura só deve escrever instruções após resolver esses limites.

## Desempenho e recuperação

MutationObserver filtra alterações produzidas pelo nAGI e agrupa verificações a cada 160 ms. Um fallback de 1 s detecta mudanças de rota sem patch de `history`/React e ajuda a estabilizar fim de geração. A extração de texto examina apenas o último candidato de resposta, sem logging. O tamanho do DOM nativo ainda afeta o custo de queries; isso precisa ser medido em produção.

O experimento marca somente turnos antigos. Mantém a cauda recente e exclui turnos contendo foco, iframe, canvas, vídeo, áudio ou conteúdo editável. Nenhum elemento React é removido ou reparentado. Ctrl+F/seleção/cópia devem ser verificados no navegador real; `content-visibility` preserva o conteúdo no DOM, mas o comportamento de widgets precisa de teste.

Erros de módulos são isolados na composição. A pausa remove os efeitos ativos, devolve sidebar e mantém um controle mínimo. O popup/options oferece uma segunda entrada. A extensão não pede permissões de cookies, webRequest, debugger, identidade ou leitura geral do histórico. A única permissão de API é storage; host limitado a `https://chatgpt.com/*`.

## Próximo marco

Validar DOM em conta autenticada PT-BR/EN, registrar contratos de settings e Projects, testar envio/edit/regenerate/voice e falhas de rede. Só então implementar read/backup/write/verify/restore de Custom Instructions por UI visível e continuação manual com verificação explícita do Project. Activity Log, auto-rollover e layouts customizados vêm após essas bases. Não há necessidade de infraestrutura remota.

## Regiões e diagnóstico (0.1.1)

`adapter/regions.ts` identifica a estrutura de sidebar/composer sem cadeias de classes utilitárias. O sidebar candidato não pode conter `main`, composer ou mensagens; o fallback estrutural exige uma região de chat identificada independentemente. Marcas CSS são reversíveis e atualizadas quando React substitui nós. `Appearance.refreshRegions` não reescreve o CSS a cada mutação.

`features/diagnostics.ts` serializa somente uma lista explícita de configurações e propriedades estruturais/computadas. IDs e classes arbitrários, texto, atributos livres, HTML, URLs e entidades privadas não entram no arquivo. O usuário escolhe baixar ou copiar o JSON e enviá-lo junto do print. Nenhum endpoint ou upload é usado.
