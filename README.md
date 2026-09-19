# nAGI · 0.1.2

Extensão modular para o **ChatGPT Web oficial**. Sem API key, backend próprio, telemetria ou alteração automática das instruções da conta.

**Este pacote é experimental.** O usuário confirmou as correções de digitação, sidebar e composer da 0.1.1 em seu ChatGPT Work/Firefox e enviou print e diagnóstico. A integração do cabeçalho da 0.1.2 passa pelos testes locais, mas ainda precisa de confirmação visual nesse frontend. O ambiente de desenvolvimento não teve acesso ao ChatGPT autenticado; não há medição real de ganho de renderização.

## Atualização 0.1.2 · cabeçalho integrado

- No modo barra superior, o cabeçalho detectado recebe a superfície, fonte e cores do nAGI: título/Work à esquerda, ferramentas nAGI ao centro e ações do chat à direita. O fundo preto, bordas e sombras nativas dessa região são normalizados.
- Compartilhar, menu e Files and Sources continuam sendo os controles reais do site, com os mesmos eventos e âncoras de menus. Nenhuma ação é executada automaticamente e nenhum controle é clonado ou movido na árvore do site.
- Com pouco espaço, as ferramentas nAGI passam para uma segunda linha. O painel de configurações abre abaixo das duas linhas.
- Pausar ou selecionar navegação nativa restaura a apresentação original. Se nenhum cabeçalho seguro for reconhecido, ele permanece intacto e a barra compacta nAGI continua disponível.
- O diagnóstico agora inclui a detecção do cabeçalho, geometria e categorias de ações. Não inclui título da conversa nem rótulos privados.

O painel de arquivos/fontes continua sendo o painel funcional do ChatGPT. Esta revisão integra seu botão de acesso ao cabeçalho nAGI; o layout final será definido pelo mockup do usuário.

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

- A barra superior começa ativa. O tema e a otimização começam desligados; a sidebar original permanece visível.
- Em **Configurações → Aparência**, escolha Terminal azul, Papel ou Carvão, ou configure cores e fonte. Ative o tema em **Geral**.
- Em **Personas**, crie um nome, texto de instruções e até três imagens: idle, thinking e talking. PNG, JPEG, GIF e WebP; até 256 KB e 2048 × 2048 por imagem. Os arquivos são guardados localmente.
- Em **Answer with…**, selecione a Persona desta aba/conversa. **As instruções ainda não são aplicadas.** Uma Persona com instruções bloqueia o envio até marcar **Somente visual**. Isso envia usando as configurações atuais do ChatGPT, sem injetar outro prompt.
- Em **Chains**, crie uma Chain e adicione a conversa aberta. As setas alteram a ordem; ● marca a sessão atual; × remove apenas o vínculo. Clique em **Salvar Chain** para gravar. Cada Chain tem Persona padrão e opção de lembrar a última Persona.
- Em **Geral**, habilite a otimização experimental de turnos antigos. Os 30 turnos mais recentes ficam intactos por padrão.

Os menus Recentes e Projects usam somente links já carregados no DOM da navegação. Não acessam endpoints privados nem prometem listar todo o histórico da conta. Se estiverem vazios, abra a sidebar original. Pode ser necessário reparar o adapter para a versão atual do site.

## O que funciona neste marco

| Módulo | Implementado |
| --- | --- |
| Base | TypeScript estrito, builds MV3 separados, content script modular, background writer, storage local e session |
| Aparência | Presets, fonte local, tamanho, cores, largura e redução opcional de movimento |
| Navegação | Barra compacta, Novo chat, Recentes, Projects, configurações e retorno à sidebar |
| Personas | CRUD, histórico de instruções, três imagens, seleção por aba/conversa e indicador visual |
| Envio | Interceptação de botão/Enter/form, mutex entre abas, espera cancelável, recuperação explícita |
| Estado visual | Estimativa idle/thinking/talking, inclusive alternância; estado unknown para DOM não reconhecido |
| Chains | Criar/editar/excluir, adicionar/remover sessão, reordenar, marcar atual, Persona padrão, anterior/próxima |
| Desempenho | `content-visibility: auto` reversível, preservação dos turnos recentes e métricas de custo do adapter |
| Recuperação | Pausa global, módulos independentes, configurações fora do ChatGPT e liberação explícita de trava |

**Ainda não implementado:** aplicar/restaurar Custom Instructions, auto-rollover, criar continuação em Project, Activity Log, layouts personalizados HTML/CSS, avatares ao lado de cada mensagem, criador de personagens ou virtualização que remova DOM. A mensagem de continuação da Chain fica guardada, sem envio automático.

## Travas e recuperação

A trava cobre os envios reconhecidos nas abas com nAGI e o módulo Personas ativos neste perfil do navegador. Ela não controla outros dispositivos, perfis, abas sem a extensão, modo de voz, regeneração ou caminhos de envio que o adapter não reconheça. Por isso não existe promessa de isolamento de Custom Instructions nesta versão.

Ao fechar/recarregar a aba durante uma geração, a trava fica preservada e pode ser marcada como desconectada. Se a resposta não iniciar ou o estado ficar desconhecido, a trava também permanece. Para recuperá-la:

1. Confira as abas e verifique se a resposta terminou ou foi interrompida.
2. Abra o ícone da extensão → **Configurações e recuperação → Diagnóstico**.
3. Clique em **Liberar após conferir as outras abas** e confirme.

A trava não expira por tempo. Ela sobrevive à suspensão do service worker, mas não ao encerramento completo da sessão do navegador. A pausa restaura a interface; não cancela uma resposta que já está sendo gerada no ChatGPT.

## Desenvolvimento

Requer Node.js 22+ e npm. Dependências de desenvolvimento são baixadas do npm; a extensão empacotada não faz essas conexões.

```sh
npm ci
npm run check
npm run demo
```

`npm run check` executa TypeScript, testes e os dois builds. `npm run demo` serve uma **fixture sintética local** em `http://localhost:4173/c/demo-session`; ela não usa ChatGPT, uma conta ou IA. Abra duas abas da fixture para testar a trava. Seu armazenamento de teste é separado da extensão e fica no localStorage desse endereço.

Para medir renderização: na fixture, expanda **Teste de desempenho**, clique em **Adicionar 600 turnos** uma vez e depois em **Comparar OFF / ON**. Mantenha a aba visível. O teste alterna OFF/ON/ON/OFF e registra mediana e p95 de intervalos entre frames, além de frames acima de 25 ms. Repita com perfil limpo e compare depois com um chat real. Os resultados do exemplo não equivalem ao custo de React no ChatGPT.

## Documentação

- [Plano de implementação](docs/PLAN.md)
- [Arquitetura, privacidade e contratos](docs/ARCHITECTURE.md)
- [Integração com o DOM, evidências e dependências frágeis](docs/INTEGRATION.md)
- [Verificação e próximos testes](docs/TESTING.md)

O repositório local foi iniciado com Git. Nenhum repositório remoto, publicação ou conta externa foi criado.
