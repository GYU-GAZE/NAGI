# nAGI · 0.2.5

Extensão modular para o **ChatGPT Web oficial**. Sem API key, backend próprio, telemetria ou alteração automática das instruções da conta.

**Este pacote é experimental.** O usuário confirmou que quase toda a revisão 0.2.1 ficou correta no ChatGPT Work/Firefox. A 0.2.2 integra o tema ao funcionamento padrão, corrige a largura de prompts curtos e mostra a identidade durante Thinking. As novas mudanças passaram pelos testes locais; sua confirmação visual no frontend autenticado continua pendente.

## Atualização 0.2.5 · envios independentes e navegação nativa

- O envio não adquire nem aguarda reservas entre abas, mesmo com Personas diferentes. O evento original do ChatGPT segue seu fluxo normal. Reservas de versões anteriores não bloqueiam esta versão.
- A atribuição do ID ao primeiro chat preserva a seleção local mesmo quando o estado de geração ainda é desconhecido. Uma navegação explícita pelo histórico cancela essa transferência.
- **Chats pinnados** usa as seções e os estados reconhecidos na sidebar original; não cria uma segunda lista de favoritos.
- **Chats recentes** e **Chats pinnados** apresentam as linhas nativas no painel nAGI. Os próprios controles e menus do ChatGPT mantêm Share, Rename, Pin, Archive, Delete e Move to Project, conforme disponibilizados pelo site.
- Quando uma linha tem menu, mas não tem botão Pin direto, o atalho nAGI usa apenas a ação Pin/Unpin do menu associado àquela linha. Sem associação verificável, não executa nenhuma ação. Delete e Archive continuam inteiramente nos menus e confirmações nativos.
- **Scheduled, Plugins, Codex e More** integram controles reconhecidos na navegação. Um destino ainda não carregado fica indisponível; não são inventados links.
- **Projects** permanece no painel nAGI com os projetos encontrados na interface. Quando há expansão na sidebar, ela pode carregar mais projetos sem mudar de página. “Ver todos no ChatGPT” é uma escolha explícita, nunca um redirecionamento automático.

**Limites:** não há garantia de listar todos os projetos/chats da conta se o site ainda não carregou seus dados. Os seletores e o posicionamento dos controles foram exercitados em fixtures; faltam testes no frontend autenticado do usuário. Diagnóstico formato 7 registra contagens e disponibilidade da navegação sem títulos, URLs ou conteúdo de menus.

**Custom Instructions:** nAGI continua sem escrever nas instruções da conta. Por isso a coordenação entre gerações foi retirada, independentemente de como o ChatGPT relê essas instruções. A pesquisa de documentação desta revisão não confirmou que uma tarefa Work inteira mantém um snapshot imutável após edições das Custom Instructions. Isso não pode ser presumido numa futura implementação de Personas com instruções reais.

85 testes locais, TypeScript e builds Firefox/Chromium. Atualize na mesma pasta e recarregue a extensão e todas as abas para retirar o fluxo antigo de envio.

## Atualização 0.2.4 · navegação, raciocínio e inicialização

- Chat/Work fica na faixa de contexto, imediatamente após “Novo chat”, fora da barra do logotipo/ferramentas.
- Só aparece na página inicial global vazia, quando há controles nativos reconhecidos. Fica oculto em conversas existentes, inclusive durante seu carregamento, e ao enviar a primeira mensagem antes da mudança de URL.
- O fallback “abrir na navegação original” foi removido. Não há botão de troca sem um controle correspondente nem alteração de navegação/sidebar ao tentar usá-lo.
- Um botão antigo que permaneça entre atualizações do DOM também verifica novamente a página antes de executar qualquer ação.

- O avatar de raciocínio fica ao lado do bloco nativo, junto ao tempo e ao raciocínio. Etapas anteriores preservam sua identidade enquanto seus blocos permanecem no histórico do site. O estado ativo mostra “Thinking...”; etapas encerradas mostram “Raciocínio”.
- Projects reconhece links de projetos em toda a interface nativa, incluindo cards e diálogos. Sem links carregados, aciona o controle nativo Projects quando disponível; a lista também permite atualizar a descoberta.
- Abas diferentes podem enviar simultaneamente com a mesma Persona, inclusive ChatGPT. Personas diferentes continuam coordenadas; cada envio tem sua própria reserva e liberação.
- O content script e o CSS inicial são carregados em `document_start`. A paleta salva é aplicada assim que as configurações chegam, antes da montagem completa do nAGI. Não há tela inteira escondida; a leitura assíncrona impede garantir ausência absoluta de flash.

Esta revisão substitui o posicionamento e o fallback descritos na seção histórica 0.2.3. As melhorias de tema permanecem. 78 testes locais passaram, com TypeScript e builds Firefox/Chromium. Posição visual, controles Projects da conta e primeiro carregamento ainda precisam de confirmação no frontend autenticado.

## Atualização 0.2.3 · Chat/Work e aparência da tela inicial

- Seletor de modo junto ao logotipo nAGI: Chat e Work usam os controles reais encontrados na navegação. A seleção destacada vem dos atributos nativos, sem presumir o modo pela URL inicial.
- Quando o site oferece um menu de modo no cabeçalho, o próprio botão é posicionado no topo nAGI, mantendo os eventos e o menu nativos. Não há clique automático ao abrir a página.
- Se o seletor não for reconhecido, **Chat / Work** revela a navegação original e oferece **Voltar ao layout nAGI**. Isso evita perder o acesso ao modo. Não se inventam rotas ou endpoints para alterar preferências da conta.
- Fonte e cores do tema passam a cobrir também saudação inicial, sugestões, abas, menus, diálogos e painéis nativos. Cards e abas usam a cor editável do campo de mensagem; bordas e estados usam texto/destaque. Imagens, SVGs, código, fórmulas e aplicativos embutidos são preservados.
- Diagnóstico formato 6 inclui detecção de modos e cobertura de regiões da tela inicial, sem exportar rótulos, sugestões, URLs ou conteúdo das conversas.

A 0.2.2 não incluía essas duas correções. Elas estão nesta versão, junto com todas as alterações anteriores. O comportamento foi verificado em fixtures locais; o seletor exato da conta do usuário ainda precisa ser confirmado no Firefox/Work.

## Atualização 0.2.2 · tema integrado, prompts compactos e Thinking

- Na primeira instalação, nAGI, layout Network e tema já começam ativos, com a sidebar original oculta.
- O tema faz parte do nAGI ativo. Foi removida a opção “Aplicar tema também à interface nativa”, inclusive das configurações internas. Uma instalação anterior com essa opção desligada passa a usar automaticamente sua paleta salva. Pausar nAGI restaura a apresentação nativa.
- **Aparência → Preset** oferece Network (padrão), Terminal azul, Papel e Carvão, além da edição de cores e fonte. O seletor identifica o preset correspondente à configuração atual. Trocar uma paleta não exige ativar outro módulo nem restaurar o layout.
- Cards de mensagens do usuário usam largura pelo conteúdo, alinhada à direita e limitada à coluna. Mensagens longas continuam quebrando linha; respostas, raciocínio e ações mantêm seu alinhamento.
- Durante Thinking, aparece o avatar correspondente da Persona, seu nome e “Thinking...” abaixo. Isso inclui o intervalo anterior à montagem da resposta pelo site. Sem imagem Thinking usa-se idle; sem imagem cadastrada usa-se monograma.
- A identidade acompanha a resposta atual e retorna aos estados talking/idle. Uma nova pergunta não muda o avatar de uma resposta anterior para Thinking. Indicadores temporários saem na pausa, ao trocar de conversa ou ao desligar avatares e nomes.

As escolhas já salvas de cores, fonte, pausa e sidebar são preservadas. Apenas o antigo opt-in de aparência foi aposentado.

## Atualização 0.2.1 · padrão Network e correções no Work

- Instalações novas começam com o layout Network, tema azul/ciano da referência, fonte monoespaçada, largura de 1040 px e sidebar oculta. Configurações salvas são preservadas; **Layout → Restaurar visual padrão** reaplica o conjunto.
- Raciocínio/“Worked for” e ações abaixo da resposta acompanham a coluna da mensagem e sua fonte configurada. Os controles continuam sendo os nós nativos.
- O cabeçalho não pode mais ser confundido com a barra de ações de uma resposta. Share, More e Files and Sources são posicionados na faixa de contexto; ancestrais transformados e rolagem entram no cálculo.
- O composer procura camadas externas além do antigo limite de oito wrappers e normaliza decorações vazias, preservando editor, rascunho, ferramentas e mensagens.
- O painel direito de arquivos/fontes recebe deslocamento e altura disponível com base na altura medida das duas barras nAGI.
- Diagnóstico formato 4 inclui envelopes de mensagens, acessórios, controles e painel lateral, sem texto de conversas ou rascunhos.

## Atualização 0.2.0 · layout Network modular

- Barra completa de ferramentas no topo e faixa de contexto separada com chat/projeto/Work, Chain, sessão e Persona.
- Share, More e Files and Sources reais posicionados ao lado do contexto, preservando nós e eventos do site.
- Setas e lista para navegar entre prompts do usuário já carregados; setas de sessão da Chain independentes.
- Cards centralizados, avatar/nome do usuário à direita e da Persona à esquerda, grade de fundo e moldura do composer.
- Configurações independentes em **Layout**: cards, avatares, nomes, contexto, prompts, grade e composer, além de cor de destaque, tamanho dos avatares, espaçamento, nome e avatar do usuário.
- Migração aditiva, mantendo os dados da instalação anterior. O modo **Compacto** mantém a estrutura anterior como alternativa.

Na 0.2.1, a paleta azul/ciano e a largura do mockup são padrão de instalação. Em uma instalação existente, **Configurações → Layout → Restaurar visual padrão** reaplica esse conjunto; as cores salvas são preservadas até essa escolha. Configure seu nome/avatar nessa mesma aba; os retratos de resposta são os da Persona selecionada. Não são incluídas cópias dos personagens da imagem nem horários inventados.

Veja [LAYOUT.md](docs/LAYOUT.md) para a divisão de módulos, tokens, comportamento e limites de detecção. As instruções das Personas continuam sem aplicação automática; esta entrega modifica estrutura, apresentação e navegação.

## Atualização 0.1.2 · cabeçalho integrado

- No modo barra superior, o cabeçalho detectado recebe a superfície, fonte e cores do nAGI: título/Work à esquerda, ferramentas nAGI ao centro e ações do chat à direita. O fundo preto, bordas e sombras nativas dessa região são normalizados.
- Compartilhar, menu e Files and Sources continuam sendo os controles reais do site, com os mesmos eventos e âncoras de menus. Nenhuma ação é executada automaticamente e nenhum controle é clonado ou movido na árvore do site.
- Com pouco espaço, as ferramentas nAGI passam para uma segunda linha. O painel de configurações abre abaixo das duas linhas.
- Pausar ou selecionar navegação nativa restaura a apresentação original. Se nenhum cabeçalho seguro for reconhecido, ele permanece intacto e a barra compacta nAGI continua disponível.
- O diagnóstico agora inclui a detecção do cabeçalho, geometria e categorias de ações. Não inclui título da conversa nem rótulos privados.

O painel de arquivos/fontes continua sendo o painel funcional do ChatGPT. A 0.2.0 evolui esta integração conforme o mockup recebido.

## Atualização 0.1.1 · correções de interface

- Os painéis abrem em um documento isolado, para que digitação, Enter, espaços e atalhos das opções não cheguem aos handlers de teclado do ChatGPT.
- A sidebar é reconhecida por múltiplos pontos de integração e pela estrutura de navegação. O nAGI tenta ocultar o container que reserva a largura, incluindo histórico, rodapé e rail, sem tocar no conteúdo da conversa.
- A aparência agora é aplicada por regiões: fundo da página, área externa do composer, superfície do campo e wrappers dos botões. Bordas, sombras, rings e fundos decorativos do composer são normalizados, com um contorno de foco próprio.
- O diagnóstico exportável descreve configurações, dimensões e estilos dessas regiões sem copiar conversas, rascunhos, instruções, avatares, nomes de Personas/Chains ou URLs.

Para atualizar preservando os dados, feche os painéis nAGI, substitua os arquivos **na mesma pasta** usada pela instalação anterior, recarregue a extensão na página de gerenciamento do navegador e depois recarregue todas as abas do ChatGPT. Não mantenha as duas versões ativas simultaneamente. Em uma instalação temporária do Firefox, uma remoção/reinstalação pode perder armazenamento; prefira atualizar a instalação já carregada.

### Enviar um exemplo real

1. Configure o tema e ative as opções que quer testar.
2. Pela barra nAGI na própria aba do ChatGPT, abra **Configurações → Diagnóstico → Exportar diagnóstico (.json)**.
3. Feche o painel e tire um print da página inteira, incluindo a sidebar e o campo de mensagem. Use um chat vazio/de teste ou oculte qualquer conteúdo que não queira compartilhar.
4. Envie o **JSON + print**. Se o download falhar, use **Visualizar diagnóstico para copiar** e copie o texto.

O diagnóstico é gerado e baixado localmente. Nada é enviado automaticamente. Ele não é um backup de Personas/Chains nem um export de chats. Não envie HTML bruto, cookies, storage do site ou arquivos HAR.

O exemplo da 0.1.1 já confirmou as regiões anteriores no navegador do usuário. Para a nova integração do cabeçalho, envie um novo JSON + print após atualizar. Os testes automatizados cobrem a estrutura e os eventos, mas não comprovam que toda camada visual nativa foi substituída no frontend real.

## Instalar para testar

O pacote já contém os builds. **Não precisa instalar Node para usar a extensão.** Extraia o ZIP inteiro primeiro.

### Firefox 140 ou posterior

1. Abra `about:debugging#/runtime/this-firefox`.
2. Clique em **Carregar extensão temporária**.
3. Selecione `nagi/dist/firefox/manifest.json` dentro da pasta extraída.
4. Abra ou recarregue uma aba em `https://chatgpt.com`.

O Firefox remove extensões temporárias quando o navegador fecha. Esta versão não está assinada/publicada no AMO. Não dependa da instalação temporária para preservar dados importantes entre reinstalações. A publicação assinada é uma etapa posterior.

### Chrome / Edge / Chromium 121 ou posterior

1. Abra `chrome://extensions` ou `edge://extensions`.
2. Ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e selecione `nagi/dist/chromium`.
4. Abra ou recarregue uma aba em `https://chatgpt.com`.

Fixe o ícone nAGI na barra do navegador. Ele oferece pausa e configurações mesmo se a integração dentro do ChatGPT falhar.

## Primeiro uso

- O layout Network, a barra superior e o tema começam ativos, com a sidebar original oculta. A otimização de turnos começa desligada.
- Em **Configurações → Aparência**, escolha Network (padrão), Terminal azul, Papel ou Carvão, ou configure cores e fonte. O nAGI ativo sempre aplica essas escolhas, sem um toggle separado de tema.
- Em **Personas**, crie um nome, texto de instruções e até três imagens: idle, thinking e talking. PNG, JPEG, GIF e WebP; até 256 KB e 2048 × 2048 por imagem. Os arquivos são guardados localmente.
- Em **Answer with…**, selecione a Persona desta aba/conversa. **As instruções ainda não são aplicadas.** Uma Persona com instruções bloqueia o envio até marcar **Somente visual**. Isso envia usando as configurações atuais do ChatGPT, sem injetar outro prompt.
- Em **Chains**, crie uma Chain e adicione a conversa aberta. As setas alteram a ordem; ● marca a sessão atual; × remove apenas o vínculo. Clique em **Salvar Chain** para gravar. Cada Chain tem Persona padrão e opção de lembrar a última Persona.
- Em **Geral**, habilite a otimização experimental de turnos antigos. Os 30 turnos mais recentes ficam intactos por padrão.

Recentes usa links carregados na navegação. Projects procura links de projetos em toda a interface nativa, excluindo mensagens e conteúdo editável, e pode abrir o controle nativo Projects por ação explícita. Sem links nem controle reconhecido, oferece carregar a navegação e atualizar a descoberta. Não acessa endpoints privados nem promete listar projetos ainda não disponibilizados pelo site.

## O que funciona neste marco

| Módulo | Implementado |
| --- | --- |
| Base | TypeScript estrito, builds MV3 separados, content script modular, background writer, storage local e session |
| Aparência | Presets, fonte local, tamanho, cores, largura e redução opcional de movimento |
| Navegação | Barra compacta, Novo chat, Recentes, Projects, configurações e retorno à sidebar |
| Personas | CRUD, histórico de instruções, três imagens, seleção por aba/conversa e indicador visual |
| Envio | Evento nativo preservado, abas independentes, validação de instruções não aplicadas e seleção no primeiro chat |
| Estado visual | Estimativa idle/thinking/talking, inclusive alternância; estado unknown para DOM não reconhecido |
| Chains | Criar/editar/excluir, adicionar/remover sessão, reordenar, marcar atual, Persona padrão, anterior/próxima |
| Desempenho | `content-visibility: auto` reversível, preservação dos turnos recentes e métricas de custo do adapter |
| Recuperação | Pausa global, módulos independentes, configurações fora do ChatGPT |

**Ainda não implementado:** aplicar/restaurar Custom Instructions, auto-rollover, criar continuação em Project, Activity Log, layouts personalizados HTML/CSS, criador de personagens ou virtualização que remova DOM. A mensagem de continuação da Chain fica guardada, sem envio automático.

## Travas e recuperação

Desde 0.2.5, o envio não usa trava entre abas. A validação local apenas evita apresentar instruções de Persona como aplicadas quando não foram. Não há promessa de isolamento de Custom Instructions, que esta versão não modifica.

Abas antigas ainda executam o código da versão anterior até serem recarregadas. Atualize todas as abas depois de recarregar a extensão. Não é necessário liberar reservas antigas nas configurações da 0.2.5. A pausa restaura a interface; não cancela uma resposta que já está sendo gerada no ChatGPT.

## Desenvolvimento

Requer Node.js 22+ e npm. Dependências de desenvolvimento são baixadas do npm; a extensão empacotada não faz essas conexões.

```sh
npm ci
npm run check
npm run demo
```

`npm run check` executa TypeScript, testes e os dois builds. `npm run demo` serve uma **fixture sintética local** em `http://localhost:4173/c/demo-session`; ela não usa ChatGPT, uma conta ou IA. Abra duas abas da fixture para testar envios independentes. Seu armazenamento de teste é separado da extensão e fica no localStorage desse endereço.

Para medir renderização: na fixture, expanda **Teste de desempenho**, clique em **Adicionar 600 turnos** uma vez e depois em **Comparar OFF / ON**. Mantenha a aba visível. O teste alterna OFF/ON/ON/OFF e registra mediana e p95 de intervalos entre frames, além de frames acima de 25 ms. Repita com perfil limpo e compare depois com um chat real. Os resultados do exemplo não equivalem ao custo de React no ChatGPT.

## Documentação

- [Plano de implementação](docs/PLAN.md)
- [Arquitetura, privacidade e contratos](docs/ARCHITECTURE.md)
- [Integração com o DOM, evidências e dependências frágeis](docs/INTEGRATION.md)
- [Verificação e próximos testes](docs/TESTING.md)

O repositório local foi iniciado com Git. Nenhum repositório remoto, publicação ou conta externa foi criado.
