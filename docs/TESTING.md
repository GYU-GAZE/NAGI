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
4. Abrir duas abas com Personas habilitadas. Enquanto A gera, tentar enviar em B: esperar/cancelar. Editar o rascunho em B durante a espera deve cancelar o envio.
5. Fechar/recarregar A durante geração. Verificar lock órfão e recuperação manual. Suspender o worker do Chromium e confirmar que a trava persiste.
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
