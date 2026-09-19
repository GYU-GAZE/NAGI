import {
  initialState,
  defaultLayout,
  type State,
  type Command,
  type Chain,
  type Settings,
  type Persona,
} from "./model";
const fail = (message: string): never => {
  throw new Error(message);
};
export function text(
  value: unknown,
  max: number,
  allowEmpty = true,
): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (!allowEmpty && !value.trim())
  )
    fail("Texto invalido ou acima do limite.");
}
export function validImage(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 360000 &&
    /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+=*$/.test(value)
  );
}
export function safeChatURL(value: string): boolean {
  try {
    const u = new URL(value);
    return (
      u.origin === "https://chatgpt.com" &&
      /^\/(?:g\/[^/]+\/)?c\/[\w-]+$/.test(u.pathname) &&
      !u.search &&
      !u.hash
    );
  } catch {
    return false;
  }
}
export function validateSettings(s: Settings) {
  for (const k of [
    "enabled",
    "hideSidebar",
    "personas",
    "chains",
    "performance",
    "showAvatar",
    "showName",
    "reduceMotion",
    "debug",
  ] as const)
    if (typeof s[k] !== "boolean") fail("Configuracao booleana invalida.");
  if (!["native", "topbar"].includes(s.navigation)) fail("Navegacao invalida.");
  if (!Number.isInteger(s.keepTurns) || s.keepTurns < 4 || s.keepTurns > 200)
    fail("Mantenha entre 4 e 200 turnos.");
  if (!["off","safe","aggressive"].includes(s.performanceMode)) fail("Modo de desempenho inválido");
  const l = s.layout;
  if (!l || !["network", "compact"].includes(l.variant))
    fail("Layout inválido.");
  for (const key of [
    "contextBar",
    "promptNavigator",
    "messageCards",
    "messageAvatars",
    "messageNames",
    "grid",
    "composerFrame",
  ] as const)
    if (typeof l[key] !== "boolean") fail("Módulo de layout inválido.");
  if (!/^#[0-9a-f]{6}$/i.test(l.accent)) fail("Cor de destaque inválida.");
  if (
    !Number.isInteger(l.avatarSize) ||
    l.avatarSize < 32 ||
    l.avatarSize > 96 ||
    !Number.isInteger(l.messageGap) ||
    l.messageGap < 8 ||
    l.messageGap > 64
  )
    fail("Dimensões do layout inválidas.");
  text(l.userName, 80, false);
  if (l.userAvatar !== "" && !validImage(l.userAvatar))
    fail("Avatar de usuário inválido.");
  const t = s.theme;
  text(t.font, 120, false);
  if (!/^[\w\s,'"-]+$/.test(t.font))
    fail("Use um nome de fonte local, sem CSS adicional.");
  for (const k of ["text", "background", "code", "composer"] as const)
    if (!/^#[0-9a-f]{6}$/i.test(t[k])) fail("Cor invalida.");
  if (
    !Number.isFinite(t.fontSize) ||
    t.fontSize < 10 ||
    t.fontSize > 32 ||
    !Number.isFinite(t.width) ||
    t.width < 480 ||
    t.width > 1600
  )
    fail("Tamanho de fonte ou largura fora do limite.");
}
function validatePersona(p: Persona) {
  text(p.id, 100, false);
  text(p.name, 80, false);
  text(p.instructions, 32000);
  if (!p.avatars || typeof p.avatars !== "object") fail("Avatares invalidos.");
  for (const [k, v] of Object.entries(p.avatars))
    if (!["idle", "thinking", "talking"].includes(k) || !validImage(v))
      fail("Imagem invalida. Use PNG, JPEG, GIF ou WebP de ate 256 KB.");
  if (
    !Number.isInteger(p.version) ||
    p.version < 1 ||
    !Array.isArray(p.history)
  )
    fail("Versao de persona invalida.");
  for (const h of p.history) {
    text(h.instructions, 32000);
    text(h.createdAt, 40);
    if (!Number.isInteger(h.version)) fail("Historico invalido.");
  }
}
function validateChain(c: Chain, s: State) {
  text(c.id, 100, false);
  text(c.name, 100, false);
  if (c.projectId !== null) text(c.projectId, 160, false);
  text(c.continuationMessage, 8000);
  if (!Array.isArray(c.sessions) || c.sessions.length > 500)
    fail("Chain muito grande.");
  const ids = new Set<string>();
  for (const v of c.sessions) {
    text(v.id, 100, false);
    text(v.title, 200, false);
    if (
      !safeChatURL(v.url) ||
      new URL(v.url).pathname.split("/").at(-1) !== v.id
    )
      fail("Link de conversa invalido.");
    if (ids.has(v.id)) fail("Conversa duplicada na Chain.");
    ids.add(v.id);
  }
  if (c.currentSession !== null && !ids.has(c.currentSession))
    fail("Sessao atual precisa pertencer a Chain.");
  for (const id of [c.defaultPersonaId, c.lastPersonaId])
    if (id !== null && !s.personas.some((p) => p.id === id))
      fail("Persona da Chain nao existe.");
  if (
    typeof c.rememberLastPersona !== "boolean" ||
    !Number.isInteger(c.version) ||
    c.version < 1
  )
    fail("Chain invalida.");
}
export function migrate(value: unknown): State {
  if (value === undefined) return initialState();
  // Never overwrite an unknown/corrupt schema with defaults.
  if (!value || typeof value !== "object" || (value as State).schema !== 1)
    fail(
      "Formato de dados desconhecido. Dados preservados; atualize a extensao.",
    );
  const s = structuredClone(value) as State;
  if (!s.settings || typeof s.settings !== "object")
    fail("Configurações inválidas.");
  if (s.settings.layout === undefined) s.settings.layout = { ...defaultLayout };
  if (s.settings.performanceMode === undefined) s.settings.performanceMode = s.settings.performance ? "safe" : "off";
  // Appearance is intrinsic to enabled nAGI; discard the retired opt-in flag.
  delete (s.settings as Settings & { appearance?: unknown }).appearance;
  validateState(s);
  return s;
}
export function validateState(s: State) {
  if (
    !Number.isInteger(s.revision) ||
    s.revision < 0 ||
    !Array.isArray(s.personas) ||
    !Array.isArray(s.chains)
  )
    fail("Dados locais invalidos.");
  validateSettings(s.settings);
  if (s.personas.length > 30 || s.chains.length > 100)
    fail("Limite local: 30 personas e 100 Chains.");
  s.personas.forEach(validatePersona);
  s.chains.forEach((c) => validateChain(c, s));
  if (
    new Set(s.personas.map((p) => p.id)).size !== s.personas.length ||
    new Set(s.chains.map((c) => c.id)).size !== s.chains.length
  )
    fail("IDs duplicados.");
  if (new TextEncoder().encode(JSON.stringify(s)).length > 8_000_000)
    fail("Armazenamento local proximo do limite. Reduza imagens ou historico.");
}
export function reduce(s: State, command: Command): State {
  const next = structuredClone(s);
  if (command.type === "settings") {
    const allowed = Object.keys(next.settings);
    for (const k of Object.keys(command.patch))
      if (!allowed.includes(k)) fail("Configuracao desconhecida.");
    next.settings = { ...next.settings, ...command.patch };
  } else if (command.type === "persona.save") {
    const old = next.personas.find((p) => p.id === command.persona.id);
    if ((old?.version ?? 0) !== command.expectedVersion)
      fail("Persona alterada em outra aba. Reabra o editor.");
    const p: Persona = {
      ...command.persona,
      version: (old?.version ?? 0) + 1,
      history: old
        ? [
            ...old.history,
            {
              version: old.version,
              instructions: old.instructions,
              createdAt: new Date().toISOString(),
            },
          ]
        : [],
    };
    next.personas = next.personas.filter((x) => x.id !== p.id);
    next.personas.push(p);
  } else if (command.type === "persona.delete") {
    const p = next.personas.find((p) => p.id === command.id);
    if (!p || p.version !== command.expectedVersion)
      fail("Persona mudou. Reabra o editor.");
    next.personas = next.personas.filter((p) => p.id !== command.id);
    next.chains.forEach((c) => {
      if (c.defaultPersonaId === command.id) c.defaultPersonaId = null;
      if (c.lastPersonaId === command.id) c.lastPersonaId = null;
      c.version++;
    });
  } else if (command.type === "chain.save") {
    const old = next.chains.find((c) => c.id === command.chain.id);
    if ((old?.version ?? 0) !== command.expectedVersion)
      fail("Chain alterada em outra aba. Reabra o painel.");
    const c = { ...command.chain, version: (old?.version ?? 0) + 1 };
    next.chains = next.chains.filter((x) => x.id !== c.id);
    next.chains.push(c);
  } else if (command.type === "chain.delete") {
    const c = next.chains.find((c) => c.id === command.id);
    if (!c || c.version !== command.expectedVersion)
      fail("Chain mudou. Reabra o painel.");
    next.chains = next.chains.filter((c) => c.id !== command.id);
  } else fail("Operacao desconhecida.");
  next.revision++;
  validateState(next);
  return next;
}
