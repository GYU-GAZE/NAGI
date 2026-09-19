import { el, button, field, input, select, checkbox, note } from "./dom";
import {
  presets,
  defaultLayout,
  type LayoutSettings,
  newChain,
  type State,
  type Settings,
  type Persona,
  type Chain,
  type AvatarState,
} from "../shared/model";
import type { Client } from "../shared/platform";
import type { Snapshot } from "../adapter/chatgpt";
import { validImage } from "../shared/validation";
import { downloadDiagnosticReport } from "../features/diagnostics";
export interface SettingsContext {
  client: Client;
  state(): State;
  refresh(s: State): void;
  snapshot?(): Snapshot;
  diagnostics?(): object;
  exportDiagnostics?(): object;
  selectChain?(chain: Chain): void;
}
export class SettingsUI {
  private page = "Geral";
  private body = el("div");
  private status = el("p", "", "status");
  constructor(
    private root: HTMLElement,
    private ctx: SettingsContext,
  ) {}
  render(page = this.page) {
    this.page = page;
    this.root.replaceChildren();
    const tabs = el("div", undefined, "tabs");
    for (const name of [
      "Geral",
      "Aparência",
      "Layout",
      "Personas",
      "Chains",
      "Diagnóstico",
    ]) {
      const b = button(name, () => this.render(name));
      b.setAttribute("aria-pressed", String(name === page));
      tabs.append(b);
    }
    this.body = el("div");
    this.status = el("p", "", "status");
    this.status.setAttribute("role", "status");
    this.root.append(tabs, this.body, this.status);
    if (page === "Geral") this.general();
    if (page === "Aparência") this.appearance();
    if (page === "Layout") this.layout();
    if (page === "Personas") this.personas();
    if (page === "Chains") this.chains();
    if (page === "Diagnóstico") void this.debug();
  }
  private async run(action: () => Promise<void>) {
    this.status.className = "status";
    this.status.textContent = "Salvando…";
    try {
      await action();
      this.status.textContent = "Salvo neste navegador.";
    } catch (e) {
      this.status.className = "error";
      this.status.textContent = e instanceof Error ? e.message : String(e);
    }
  }
  private async settings(patch: Partial<Settings>) {
    const s = await this.ctx.client.mutate({ type: "settings", patch });
    this.ctx.refresh(s);
  }
  private general() {
    const s = this.ctx.state().settings;
    this.body.append(
      el("h2", "Módulos independentes"),
      note(
        "Nada é enviado a servidores do nAGI. Personas e Chains são dados locais deste navegador.",
      ),
    );
    const toggles: [keyof Settings, string][] = [
      ["enabled", "Ativar nAGI"],
      ["personas", "Personas e identidade visual"],
      ["chains", "Conversation Chains"],
      ["showAvatar", "Mostrar avatar da Persona na barra"],
      ["showName", "Mostrar nome da Persona na barra"],
      ["reduceMotion", "Reduzir animações do ChatGPT"],
      ["debug", "Exibir diagnóstico na barra"],
    ];
    for (const [k, label] of toggles)
      this.body.append(
        checkbox(
          label,
          s[k] as boolean,
          (v) => void this.run(() => this.settings({ [k]: v })),
        ),
      );
    const nav = select(
      [
        ["topbar", "Barra superior nAGI"],
        ["native", "Navegação original"],
      ],
      s.navigation,
    );
    nav.onchange = () =>
      void this.run(() =>
        this.settings({ navigation: nav.value as Settings["navigation"] }),
      );
    this.body.append(
      field("Navegação", nav),
      checkbox(
        "Ocultar sidebar original quando a barra estiver ativa",
        s.hideSidebar,
        (v) => void this.run(() => this.settings({ hideSidebar: v })),
      ),
      note(
        "Os módulos estruturais e a identidade visual das mensagens podem ser ajustados na aba Layout. A navegação original continua disponível para recuperação.",
      ),
    );
    const mode = select([["off","Off"],["safe","Safe"],["aggressive","Aggressive · experimental"]],s.performance ? s.performanceMode === "aggressive" ? "aggressive" : "safe" : "off");
    mode.onchange=()=>void this.run(()=>this.settings({performance:mode.value!=="off",performanceMode:mode.value as Settings["performanceMode"]}));
    this.body.append(field("Desempenho",mode),note("Aggressive reduz a renderização de mensagens distantes. Desligue para restaurar imediatamente o conteúdo; não remove nós do ChatGPT."));
    const keep = input(String(s.keepTurns), "number");
    keep.min = "4";
    keep.max = "200";
    keep.onchange = () =>
      void this.run(() => this.settings({ keepTurns: Number(keep.value) }));
    this.body.append(
      field("Turnos recentes sem otimização", keep),
      note(
        "O conteúdo continua no DOM. Turnos com mídia interativa são preservados. Compare o mesmo chat com o recurso ligado e desligado; não há promessa de ganho universal.",
      ),
    );
  }
  private appearance() {
    const s = this.ctx.state().settings;
    const t = { ...s.theme };
    this.body.append(
      el("h2", "Aparência"),
      note(
        "Use fontes instaladas no computador. Esta versão não baixa fontes. O tema faz parte do nAGI ativo. Escolha uma paleta ou personalize as cores e a fonte aqui.",
      ),
    );
    const preset = select(
      [
        ["", "Escolher preset"],
        ...Object.keys(presets).map(
          (n) =>
            [n, n === "Network" ? "Network (padrão)" : n] as [string, string],
        ),
      ],
      Object.keys(presets).find((name) =>
        Object.entries(presets[name]).every(
          ([key, value]) => t[key as keyof typeof t] === value,
        ),
      ) ?? "",
    );
    preset.onchange = () => {
      if (presets[preset.value])
        void this.run(async () => {
          await this.settings({ theme: { ...presets[preset.value] } });
          this.render();
        });
    };
    this.body.append(field("Preset", preset));
    const font = input(t.font);
    font.maxLength = 120;
    this.body.append(
      field("Fonte", font, "Ex.: monospace, system-ui, Georgia, Silver"),
    );
    const grid = el("div", undefined, "grid");
    const colors: {
      key: "text" | "background" | "code" | "composer";
      label: string;
    }[] = [
      { key: "text", label: "Texto" },
      { key: "background", label: "Fundo" },
      { key: "code", label: "Fundo do código" },
      { key: "composer", label: "Campo de mensagem" },
    ];
    for (const { key, label } of colors) {
      const i = input(t[key], "color");
      i.oninput = () => (t[key] = i.value);
      grid.append(field(label, i));
    }
    const size = input(String(t.fontSize), "number");
    size.min = "10";
    size.max = "32";
    const width = input(String(t.width), "number");
    width.min = "480";
    width.max = "1600";
    grid.append(field("Fonte (px)", size), field("Largura (px)", width));
    this.body.append(
      grid,
      button(
        "Salvar aparência",
        () =>
          void this.run(async () => {
            await this.settings({
              theme: {
                ...t,
                font: font.value,
                fontSize: Number(size.value),
                width: Number(width.value),
              },
            });
          }),
      ),
    );
  }
  private layout() {
    const l = this.ctx.state().settings.layout;
    this.body.append(
      el("h2", "Layout modular"),
      note(
        "Cada parte pode ser ligada ou desligada separadamente. A aparência da conta e o conteúdo das conversas não são alterados.",
      ),
    );
    const variant = select(
      [
        ["network", "Network · referência visual"],
        ["compact", "Compacto · barra da versão anterior"],
      ],
      l.variant,
    );
    variant.onchange = () =>
      void this.run(() =>
        this.settings({
          layout: {
            ...this.ctx.state().settings.layout,
            variant: variant.value as LayoutSettings["variant"],
          },
        }),
      );
    this.body.append(
      field("Estrutura", variant),
      button(
        "Restaurar visual padrão",
        () =>
          void this.run(async () => {
            await this.settings({
              navigation: "topbar",
              hideSidebar: true,
              showName: true,
              theme: { ...presets.Network },
              layout: {
                ...defaultLayout,
                userName: l.userName,
                userAvatar: l.userAvatar,
              },
            });
            this.render("Layout");
          }),
      ),
      note(
        "O preset aplica a paleta azul/ciano, grade e largura de 1040 px. Preserva seu nome e avatar. Para manter suas cores atuais, ajuste apenas os módulos abaixo.",
      ),
    );
    const toggles: [keyof LayoutSettings, string][] = [
      ["contextBar", "Contexto: chat, projeto, Work, Chain e Persona"],
      ["promptNavigator", "Navegação entre prompts enviados"],
      ["messageCards", "Cards de mensagem"],
      ["messageAvatars", "Avatares ao lado das mensagens"],
      ["messageNames", "Nomes abaixo dos avatares"],
      ["grid", "Grade de fundo"],
      ["composerFrame", "Moldura e seletor de Persona no campo de mensagem"],
    ];
    for (const [key, label] of toggles)
      this.body.append(
        checkbox(
          label,
          l[key] as boolean,
          (v) =>
            void this.run(() =>
              this.settings({
                layout: { ...this.ctx.state().settings.layout, [key]: v },
              }),
            ),
        ),
      );
    const accent = input(l.accent, "color"),
      size = input(String(l.avatarSize), "number"),
      gap = input(String(l.messageGap), "number"),
      name = input(l.userName);
    size.min = "32";
    size.max = "96";
    gap.min = "8";
    gap.max = "64";
    name.maxLength = 80;
    const grid = el("div", undefined, "grid");
    grid.append(
      field("Destaque", accent),
      field("Avatar (px)", size),
      field("Espaço entre mensagens (px)", gap),
      field("Seu nome nas mensagens", name),
    );
    let avatar = l.userAvatar;
    const preview = el("img", undefined, "portrait");
    preview.alt = "Seu avatar";
    preview.hidden = !avatar;
    if (avatar) preview.src = avatar;
    const file = input("", "file");
    file.accept = "image/png,image/jpeg,image/gif,image/webp";
    file.onchange = () =>
      void this.run(async () => {
        const f = file.files?.[0];
        if (!f) return;
        if (
          f.size > 256 * 1024 ||
          !["image/png", "image/jpeg", "image/gif", "image/webp"].includes(
            f.type,
          )
        )
          throw new Error("Use PNG, JPEG, GIF ou WebP de até 256 KB.");
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("Falha ao ler imagem."));
          reader.readAsDataURL(f);
        });
        if (!validImage(data)) throw new Error("Imagem inválida.");
        const image = new Image();
        image.src = data;
        await image.decode();
        if (image.naturalWidth > 2048 || image.naturalHeight > 2048)
          throw new Error("Use imagem de no máximo 2048 × 2048 pixels.");
        avatar = data;
        preview.src = data;
        preview.hidden = false;
      });
    this.body.append(
      grid,
      el("h3", "Seu avatar"),
      preview,
      field("Imagem local", file),
      button("Remover seu avatar", () => {
        avatar = "";
        preview.removeAttribute("src");
        preview.hidden = true;
      }),
      note(
        "As respostas usam a identidade visual da Persona selecionada. Isso não registra autoria histórica nem aplica suas instruções ao ChatGPT. Sem imagem, aparece um monograma. Horários não são inventados.",
      ),
      button(
        "Salvar detalhes do layout",
        () =>
          void this.run(() =>
            this.settings({
              layout: {
                ...this.ctx.state().settings.layout,
                accent: accent.value,
                avatarSize: Number(size.value),
                messageGap: Number(gap.value),
                userName: name.value.trim(),
                userAvatar: avatar,
              },
            }),
          ),
      ),
    );
  }
  private personas() {
    this.body.append(
      el("h2", "Personas"),
      note(
        "As instruções são guardadas e versionadas localmente. A troca das Custom Instructions do ChatGPT ainda não está implementada. O envio com instruções requer escolha explícita de “Somente visual”.",
      ),
    );
    const list = el("div", undefined, "list");
    for (const p of this.ctx.state().personas)
      list.append(
        button(`${p.name} · v${p.version}`, () => this.editPersona(p)),
      );
    this.body.append(
      list,
      button("Criar Persona", () => this.editPersona()),
    );
  }
  private editPersona(old?: Persona) {
    this.body.replaceChildren(
      el("h2", old ? "Editar Persona" : "Nova Persona"),
    );
    const name = input(old?.name ?? "");
    name.maxLength = 80;
    const instructions = el("textarea");
    instructions.value = old?.instructions ?? "";
    instructions.maxLength = 32000;
    const avatars = { ...old?.avatars };
    this.body.append(
      field("Nome", name),
      field(
        "Custom Instructions",
        instructions,
        "Armazenadas apenas. Nenhuma configuração da sua conta será alterada.",
      ),
    );
    for (const state of ["idle", "thinking", "talking"] as AvatarState[]) {
      const row = el("div", undefined, "row");
      const preview = el("img");
      preview.className = "portrait";
      preview.alt = state;
      if (avatars[state]) preview.src = avatars[state]!;
      else preview.hidden = true;
      const file = input("", "file");
      file.accept = "image/png,image/jpeg,image/gif,image/webp";
      file.onchange = () =>
        void this.run(async () => {
          const f = file.files?.[0];
          if (!f) return;
          if (
            f.size > 256 * 1024 ||
            !["image/png", "image/jpeg", "image/gif", "image/webp"].includes(
              f.type,
            )
          )
            throw new Error("Use PNG, JPEG, GIF ou WebP de até 256 KB.");
          const data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error("Falha ao ler imagem."));
            reader.readAsDataURL(f);
          });
          if (!validImage(data)) throw new Error("Imagem não suportada.");
          const image = new Image();
          image.src = data;
          await image.decode();
          if (image.naturalWidth > 2048 || image.naturalHeight > 2048)
            throw new Error("Imagem deve ter no máximo 2048 × 2048 pixels.");
          avatars[state] = data;
          preview.src = data;
          preview.hidden = false;
          this.status.textContent =
            "Imagem carregada. Salve a Persona para confirmar.";
        });
      row.append(
        preview,
        field(
          {
            idle: "Idle · aguardando",
            thinking: "Thinking · atividade",
            talking: "Talking · resposta",
          }[state],
          file,
        ),
        button("Remover imagem", () => {
          delete avatars[state];
          preview.removeAttribute("src");
          preview.hidden = true;
        }),
      );
      this.body.append(row);
    }
    const actions = el("div", undefined, "actions");
    actions.append(
      button(
        "Salvar Persona",
        () =>
          void this.run(async () => {
            const s = await this.ctx.client.mutate({
              type: "persona.save",
              expectedVersion: old?.version ?? 0,
              persona: {
                id: old?.id ?? crypto.randomUUID(),
                name: name.value.trim(),
                instructions: instructions.value,
                avatars,
              },
            });
            this.ctx.refresh(s);
            this.render();
          }),
      ),
      button("Voltar", () => this.render()),
    );
    if (old)
      actions.append(
        button("Excluir Persona", () => {
          const confirm = button(
            "Confirmar exclusão local",
            () =>
              void this.run(async () => {
                this.ctx.refresh(
                  await this.ctx.client.mutate({
                    type: "persona.delete",
                    id: old.id,
                    expectedVersion: old.version,
                  }),
                );
                this.render();
              }),
          );
          this.body.append(
            note(
              "A Persona será removida das seleções padrão das Chains. Chats do ChatGPT não serão alterados.",
            ),
            confirm,
          );
        }),
      );
    this.body.append(actions);
    if (old?.history.length) {
      const history = el("details");
      history.append(
        el(
          "summary",
          `Histórico local · ${old.history.length} versões anteriores`,
        ),
      );
      for (const h of [...old.history].reverse()) {
        const d = el("details");
        d.append(
          el("summary", `v${h.version} · ${h.createdAt.slice(0, 10)}`),
          el("pre", h.instructions || "(sem instruções)"),
          button(
            "Usar este texto no editor",
            () => (instructions.value = h.instructions),
          ),
        );
        history.append(d);
      }
      this.body.append(history);
    }
  }
  private chains() {
    this.body.append(
      el("h2", "Conversation Chains"),
      note(
        "Organização local de chats reais. Uma Chain pode estar em um Project; outras conversas do Project continuam independentes. Nenhum contexto antigo é enviado automaticamente.",
      ),
    );
    const list = el("div", undefined, "list");
    for (const c of this.ctx.state().chains)
      list.append(
        button(`${c.name} · ${c.sessions.length} sessões`, () =>
          this.editChain(c),
        ),
      );
    this.body.append(
      list,
      button("Criar Chain", () =>
        this.editChain(newChain("", this.ctx.snapshot?.().projectId ?? null)),
      ),
    );
  }
  private editChain(original: Chain) {
    const c = structuredClone(original);
    this.body.replaceChildren(el("h2", c.name || "Nova Chain"));
    const name = input(c.name);
    name.maxLength = 100;
    const project = input(c.projectId ?? "");
    project.maxLength = 160;
    const persona = select(
      [
        ["", "ChatGPT / nenhuma Persona"],
        ...this.ctx
          .state()
          .personas.map((p) => [p.id, p.name] as [string, string]),
      ],
      c.defaultPersonaId ?? "",
    );
    const continuation = input(c.continuationMessage);
    continuation.maxLength = 8000;
    this.body.append(
      field("Nome da Chain", name),
      field(
        "Project ID (opcional)",
        project,
        "Metadado local. Se não foi detectado, deixe vazio ou informe manualmente. Nenhum chat será movido.",
      ),
      field("Persona padrão", persona),
      checkbox(
        "Lembrar última Persona da Chain",
        c.rememberLastPersona,
        (v) => (c.rememberLastPersona = v),
      ),
      field(
        "Mensagem de continuação",
        continuation,
        "Guardada para o próximo marco. Não será enviada automaticamente.",
      ),
    );
    const sessions = el("div");
    const renderSessions = () => {
      sessions.replaceChildren(el("h3", "Sessões · ordem manual"));
      if (!c.sessions.length)
        sessions.append(
          note("Adicione uma conversa aberta pelo painel dentro do ChatGPT."),
        );
      c.sessions.forEach((session, index) => {
        const row = el("div", undefined, "session");
        const a = el(
          "a",
          `${String(index + 1).padStart(2, "0")} · ${session.title}${session.id === c.currentSession ? " · atual" : ""}`,
        );
        a.href = session.url;
        const up = button(
          "Mover para cima",
          () => {
            [c.sessions[index - 1], c.sessions[index]] = [
              c.sessions[index],
              c.sessions[index - 1],
            ];
            renderSessions();
          },
          "↑",
        );
        up.disabled = index === 0;
        const down = button(
          "Mover para baixo",
          () => {
            [c.sessions[index + 1], c.sessions[index]] = [
              c.sessions[index],
              c.sessions[index + 1],
            ];
            renderSessions();
          },
          "↓",
        );
        down.disabled = index === c.sessions.length - 1;
        row.append(
          a,
          up,
          down,
          button(
            "Marcar atual",
            () => {
              c.currentSession = session.id;
              renderSessions();
            },
            "●",
          ),
          button(
            "Remover da Chain",
            () => {
              c.sessions.splice(index, 1);
              if (c.currentSession === session.id)
                c.currentSession = c.sessions.at(-1)?.id ?? null;
              renderSessions();
            },
            "×",
          ),
        );
        sessions.append(row);
      });
    };
    renderSessions();
    this.body.append(sessions);
    const current = this.ctx.snapshot?.().conversation;
    if (current)
      this.body.append(
        button("Adicionar conversa aberta", () => {
          if (!c.sessions.some((s) => s.id === current.id)) {
            c.sessions.push(current);
            c.currentSession = current.id;
            renderSessions();
          }
        }),
      );
    const actions = el("div", undefined, "actions");
    actions.append(
      button(
        "Salvar Chain",
        () =>
          void this.run(async () => {
            c.name = name.value.trim();
            c.projectId = project.value.trim() || null;
            c.defaultPersonaId = persona.value || null;
            c.continuationMessage = continuation.value;
            const s = await this.ctx.client.mutate({
              type: "chain.save",
              chain: c,
              expectedVersion: original.version,
            });
            this.ctx.refresh(s);
            this.render();
          }),
      ),
      button("Voltar", () => this.render()),
    );
    if (original.version) {
      actions.append(
        button("Selecionar nesta aba", () => {
          this.ctx.selectChain?.(original);
          this.status.textContent = "Chain selecionada nesta aba.";
        }),
      );
      actions.append(
        button("Excluir Chain", () =>
          this.body.append(
            note(
              "Excluir apenas a organização local? As conversas no ChatGPT permanecerão intactas.",
            ),
            button(
              "Confirmar exclusão da Chain",
              () =>
                void this.run(async () => {
                  this.ctx.refresh(
                    await this.ctx.client.mutate({
                      type: "chain.delete",
                      id: c.id,
                      expectedVersion: original.version,
                    }),
                  );
                  this.render();
                }),
            ),
          ),
        ),
      );
    }
    this.body.append(
      actions,
      note(
        "Alterações de ordem, sessão atual e remoção só são gravadas ao salvar.",
      ),
    );
  }
  private async debug() {
    this.body.append(
      el("h2", "Diagnóstico"),
      note(
        "Nenhum texto de conversa, instrução ou avatar aparece aqui. A detecção de geração é uma estimativa do DOM visível.",
      ),
    );
    if (this.ctx.exportDiagnostics) {
      this.body.append(
        note(
          "Para relatar um problema: ative as opções que está testando, baixe o diagnóstico e envie o JSON junto de um print da página. O arquivo contém configurações, dimensões e estilos das regiões; não inclui conversas, rascunhos, prompts, nomes ou imagens de Personas.",
        ),
        button("Exportar diagnóstico (.json)", () => {
          try {
            const report = this.ctx.exportDiagnostics!();
            downloadDiagnosticReport(report);
            this.status.textContent =
              "Diagnóstico baixado. Envie o JSON junto do print.";
          } catch {
            this.status.textContent =
              "Falha ao baixar. Use Visualizar diagnóstico e copie o JSON.";
          }
        }),
        button("Visualizar diagnóstico para copiar", () => {
          const report = this.ctx.exportDiagnostics!();
          const text = el("textarea");
          text.readOnly = true;
          text.value = JSON.stringify(report, null, 2);
          text.setAttribute("aria-label", "Diagnóstico para copiar");
          this.body.append(text);
          text.focus();
          text.select();
        }),
      );
    } else
      this.body.append(
        note(
          "Para exportar o estado real da interface, abra Configurações → Diagnóstico pela barra nAGI dentro da aba do ChatGPT.",
        ),
      );
    const data = el(
      "pre",
      JSON.stringify(
        this.ctx.diagnostics?.() ?? {
          context: "página de configurações",
          schema: this.ctx.state().schema,
          revision: this.ctx.state().revision,
        },
        null,
        2,
      ),
    );
    this.body.append(data);
    this.body.append(
      note(
        "Envios independentes entre abas. nAGI não altera Custom Instructions e não mantém uma trava global de geração.",
      ),
    );
    this.body.append(
      button("Atualizar diagnóstico", () => this.render()),
      note(
        "Custom Instructions: integração indisponível. Activity Log, auto-rollover e virtualização agressiva: não implementados neste marco.",
      ),
    );
  }
}
