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
| Sidebar | `#history` | Oculta somente esse nó com atributo reversível; sem nó, mantém UI nativa |
| Turnos | `article[data-testid^="conversation-turn-"]` | Sem turnos reconhecidos, otimização faz zero alterações |
| Recentes | Links em `nav`/`#history`, caminho terminando `/c/<id>` | Apenas links montados; ordem acompanha DOM, não data inferida |
| Projects | Links em `nav`/`#history`, `/g/g-p-.../project` ou equivalente sem sufixo | IDs e rotas candidatos; não abre ou cria Project automaticamente |
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
