# nAGI · 0.1.0

Extensão modular para o **ChatGPT Web oficial**. Sem API key, backend próprio, telemetria ou alteração automática das instruções da conta.

**Este pacote é um primeiro marco experimental.** Compila e passa pelos testes locais, mas seus seletores ainda precisam ser validados no ChatGPT autenticado. O ambiente de desenvolvimento encontrou uma verificação humana no ChatGPT e não conseguiu abrir a fixture no navegador remoto. Isso impede afirmar compatibilidade real ou ganho de renderização neste momento.

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
