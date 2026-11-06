# Verificação

## Automatizada

`npm run check` executa TypeScript estrito, testes Node/JSDOM e builds Firefox/Chromium. Testes cobrem:

- disputa de 50 requisições pela mesma trava, reinício do coordinator, token e owner incorretos;
- lock órfão, recuperação explícita e retorno a idle após geração;
- serialização de gravações, erro que não quebra fila, schema desconhecido preservado;
- versões de Persona, conflito de editores, histórico e limpeza de defaults ao excluir;
- ordem manual, sessão atual, duplicatas e conflitos de Chain;
- seleção separada por aba e rota;
- rejeição de imagem remota/SVG, CSS inválido e URLs de conversa externas;
- alternância thinking/talking, flicker de stop e estado unknown;
- seletores candidatos em fixture, sidebar reversível, Shift+Enter e IME;
- bloqueio de Persona com instruções sem consentimento visual;
- envio nativo único e preservação do rascunho se ele mudar enquanto a trava é adquirida;
- cancelamento de espera quando o rascunho muda durante uma consulta de disponibilidade;
- navegação para outro chat durante geração sem liberar a trava pelo idle errado;
- composição completa da UI em JSDOM: edição de Persona/Chain, texto tratado literalmente, módulos independentes e pausa.

JSDOM testa eventos, DOM e lógica. **Não testa layout visual, renderização CSS, API real de extensão, lifecycle real do service worker ou frontend autenticado.** A sobrevivência ao reinício é verificada recriando o coordinator sobre o mesmo storage de teste, não matando um worker real do Chrome.

## Verificação manual ainda pendente

1. Carregar build no Firefox e Chromium; conferir popup, permissões, console, navegação e opção de pausa.
2. Em uma conversa descartável, confirmar composer/send/stop e estados no Diagnóstico. Usar sidebar original se os seletores não corresponderem.
3. Criar Persona com instruções: primeiro envio deve permanecer no composer. Marcar “Somente visual” e confirmar que o texto é enviado uma única vez, sem prompt oculto.
4. Abrir duas abas com Personas habilitadas. Enquanto A gera, enviar em B deve ser permitido tanto com a mesma Persona quanto com uma diferente. Não existe fila entre abas na 0.2.5.
5. Fechar/recarregar A durante geração e conferir que B continua usando o envio nativo. A seleção do primeiro chat deve acompanhar sua URL definitiva.
6. Testar ESC, navegação por teclado, IME, Enter e Shift+Enter; não presumir suporte a regeneração, edição ou voz.
7. Recarregar conversa que pertence a uma Chain; verificar Persona padrão e memória. Adicionar, remover, reordenar e marcar atual. Confirmar que chats fora da Chain continuam fora dela.
8. Desligar cada módulo e depois pausar tudo. Confirmar sidebar, tema nativo, seleção/cópia e widgets funcionais.
9. Comparar contenção ligada/desligada no mesmo chat longo, inclusive busca Ctrl+F, scroll, tabelas, blocos de código, seleção, copiar, mídia e streaming.

## Benchmark

A fixture contém um ensaio reproduzível de scroll com OFF/ON/ON/OFF, 200 intervalos entre frames por condição. Relata mediana, p95 e contagem acima de 25 ms. O teste serve para uma primeira comparação no mesmo navegador; hardware, viewport, visibilidade da aba e carga afetam os resultados. Conteúdo sintético não reproduz reconciliação de React nem chamadas de ferramentas reais.

**Não há resultados de renderização publicados neste pacote.** O navegador remoto recusou a fixture; inventar números ou usar tempos de JSDOM como FPS produziria evidência falsa. `scanMs` e `updateMs` no Diagnóstico representam o custo das rotinas de inspeção/marcação, não o ganho de velocidade da página.

## Regressões 0.1.1

- Digitar em campos de Persona dentro do painel não dispara listeners de teclado no document/window nativo; foco permanece no campo, rascunho do ChatGPT fica intacto e Escape fecha o painel.
- Ocultar sidebar elimina o container de largura com lista, rodapé e rail; restaurar não altera os estilos inline nativos.
- Fallback estrutural reconhece sidebar com ID diferente e não classifica navegação dentro de respostas como sidebar.
- Composer inclui wrappers do editor e dos botões, mas não mensagens; troca de nós por React remove marcas antigas e aplica nas novas. Desligar o tema limpa as marcas.
- Exportação de diagnóstico contém configurações e estrutura, mas não textos de mensagem, rascunhos, URLs, IDs/nomes de entidades, instruções, avatares ou propriedades futuras desconhecidas.

A confirmação visual no Firefox real continua pendente do exemplo do usuário.

## Regressões 0.1.2

43 testes locais (Node + JSDOM): inclui reconhecimento do cabeçalho Work sem ID conhecido, exclusão da conversa/painel lateral, preservação de nós/pais/eventos dos controles, nenhum click automático, exclusão dos itens de menus, largura que ativa duas linhas, pausa/navegação nativa/dispose, substituição do cabeçalho e privacidade do diagnóstico. O teste de app verifica a integração junto com tema, sidebar, performance e pausa. JSDOM não valida renderização CSS; dimensões das fixtures são simuladas.

Validação manual pendente no frontend do usuário: confirmar que não sobra faixa preta; testar Share (abrir e cancelar), menu (abrir e fechar), Files and Sources (abrir/fechar), título/Work, título longo, sidebar aberta, zoom/janela estreita e troca de chat. Conferir que menus e diálogos ficam acima da barra, que as opções não cobrem as ferramentas em duas linhas e que pausar restaura o cabeçalho. Enviar diagnóstico 0.1.2 e print para comparação.

## Regressões 0.2.0

53 testes locais. Além das regressões anteriores, há migração aditiva e validação de opções; mensagens por papel sem article; preservação de texto, código, botões e rascunho; troca independente de cards/retratos/nomes; limpeza de nós substituídos; docking dos controles nativos sem clicks automáticos; lista/rolagem de prompts, reduced motion e troca de rota; contexto Project/Work/Chain/Persona e links entre sessões; seletor no composer; privacidade do usuário e das prévias no diagnóstico; troca Network/Compacto pelo painel real de configurações.

A fixture `npm run demo` abre quatro mensagens e controles de cabeçalho simulados, sem conta ou envio externo. O benchmark sintético continua disponível pela sidebar. O preset Network é carregado apenas na primeira inicialização da fixture.

Validação visual autenticada pendente: comparar com o mockup, testar títulos longos, sidebar aberta/fechada, janela estreita/zoom, Share/More/Files, rolagem de prompts em conversas longas, respostas com ferramentas, anexos, tabelas/código e envio/stop. Exportar diagnóstico 0.2.0 e comparar counts.userMessages/assistantMessages com o conteúdo carregado. Nenhum teste JSDOM comprova posicionamento real de CSS ou compatibilidade de novos hooks no Work.

## Regressões 0.2.1

59 testes passaram; TypeScript e builds Firefox/Chromium concluídos. Saída completa em `verification-output.txt`.

Fixtures baseadas na estrutura do diagnóstico Work verificam exclusão de feedback da detecção de cabeçalho mesmo no topo da viewport ou com uma marca antiga; docking dos três controles reais; agrupamento de raciocínio/resposta/ações com preservação de handlers; restauração na pausa; composer com 12 camadas externas e decoração irmã, sem tocar no rascunho ou conversa; deslocamento do painel direito sem acumulação, resize e limpeza; coordenadas sob ancestral escalado e rolado; novos defaults Network e preservação das configurações salvas.

O layout geral da 0.2.0 foi aprovado pelo usuário. Pendente na 0.2.1: confirmar em Firefox/Work o alinhamento de “Worked for” e feedback, a remoção da faixa preta, os três controles na faixa de contexto e a posição do painel direito. Testar a rolagem com esse painel aberto e depois pausado. As fixtures usam geometria simulada, não validam pixels renderizados.

## Regressões 0.2.2

64 testes locais passaram. A fixture de app agora verifica tema e sidebar oculta já na inicialização, ausência do toggle separado e aplicação imediata de outro preset. Migração retira `appearance` de dados antigos sem perder paleta, pausa ou preferência de sidebar.

As regressões de mensagens verificam largura `fit-content` e alinhamento dos cards curtos do usuário, limite para textos longos e preservação dos nós; identidade Thinking antes da resposta existir; histórico mantido em idle; passagem do indicador provisório para o envelope de raciocínio; troca thinking/talking/idle; fallback de avatar; remoção ao desativar módulos, pausar ou substituir a conversa. As medidas CSS finais ainda dependem de confirmação visual no Firefox real, pois JSDOM não renderiza pixels.

Verificação manual: enviar um prompt curto e um longo; conferir alinhamento com avatar à direita; configurar imagens idle/thinking/talking distintas e observar uma nova resposta; confirmar que uma resposta anterior permanece idle enquanto a nova está pensando; trocar preset sem acionar opções adicionais; pausar e reativar; testar uma instalação limpa com sidebar oculta.

## Regressões 0.2.3

72 testes locais, TypeScript e builds Firefox/Chromium. Novos casos: troca de modo pelos handlers nativos de uma sidebar oculta; nenhum clique durante a montagem; estado ativo do site; substituição de controles; modo indisponível; exclusão de links externos e conversas chamadas Chat/Work; cabeçalho inicial sem Share; docking do menu de modo com preservação de menu/eventos; fallback para navegação nativa e retorno ao nAGI; superfícies de sugestões e abas; conservação de imagens/rascunho/clicks; aplicação em menus novos; limpeza ao montar conversa ou pausar; diagnóstico sem texto das sugestões.

Pendente no frontend autenticado: abrir a raiz chatgpt.com, alternar Chat/Work em ambos os sentidos, iniciar nova conversa, abrir/fechar menus e conferir a seleção nativa. Verificar saudação, sugestões, abas Projects/Files/Plugins e menus com Network/Papel e uma fonte personalizada. Confirmar que código e mídia continuam legíveis. Exportar diagnóstico 0.2.3 caso o seletor use o fallback ou alguma superfície fique com o tema antigo.

## Regressões 0.2.4

78 testes locais passaram. O teste de app exige que o seletor esteja dentro de context-info, imediatamente após o título, e ausente da barra de ferramentas. Verifica transições entre conversa, raiz vazia, primeira mensagem ainda na raiz e rota de conversa sem mensagens carregadas. Navegação/sidebar permanecem intactas. O teste do menu nativo verifica remoção do docking ao entrar em uma conversa. Um botão retido entre atualizações não aciona o modo fora da página inicial nem abre recuperação quando seu controle nativo desaparece.

Confirmação visual pendente no Firefox: posição ao lado de Novo chat e ausência do seletor durante a conversa. Não há fallback automático para navegação original nesta revisão.

Os casos adicionais cobrem reservas simultâneas da mesma Persona, bloqueio entre Personas diferentes, liberação por token, reinício do worker, migração da trava antiga e recuperação sem remover outras reservas. Projects é testado fora da sidebar, com exclusão de links em mensagens/externos e abertura do controle nativo apenas por clique do usuário. Controles de formulário sem tipo seguro são rejeitados.

A fixture de raciocínio mantém avatares nos blocos anteriores após novas etapas, resposta final e idle. O CSS inicial é verificado antes da criação do body, com paleta salva, preferência de sidebar, pausa, falha de storage e limpeza de marcas. Ambos os manifests usam `document_start` e incluem `early.css`.

Pendente no Firefox autenticado: conferir avatar ao lado do tempo/raciocínio e persistência visual entre etapas; abrir Projects e navegar por um projeto real; enviar em duas abas com a mesma Persona; observar primeiro carregamento com diferentes temas. JSDOM não mede pintura inicial, layout CSS real nem garante os seletores da conta.

## Regressões 0.2.5

85 testes locais, TypeScript e builds. Cobertura nova: envio original uma vez sem consultas a locks; Personas diferentes em abas independentes; atribuição de URL durante fase desconhecida; persistência da seleção no app completo; cancelamento da transferência por navegação explícita; Projects sem redirecionamento automático; seções pinnadas e exclusão de mensagens; destinos globais separados do menu de conversa; preservação de pai/handlers dos nós nativos; nenhum clique na montagem; restauração ao fechar/pausar; coordenadas de iframe e recorte na rolagem; Pin associado exclusivamente ao menu da conversa.

Os testes antigos do Coordinator verificam somente o protocolo de compatibilidade com abas antigas. Não descrevem o comportamento de envio da 0.2.5.

Pendente no Firefox autenticado: primeiro envio em Chat e Work; duas Personas diferentes em abas simultâneas; linhas recentes/pinnadas em sidebar carregada; Pin/Unpin e renomeação; abrir e cancelar Share/Archive/Delete/Move to Project; destinos Scheduled/Plugins/Codex/More; foco, menus, rolagem e zoom. A disponibilidade dos hooks da conta e o posicionamento CSS real não são comprovados por JSDOM. Não há alegação de inventário completo de Projects nem de imutabilidade das Custom Instructions durante uma tarefa Work.
