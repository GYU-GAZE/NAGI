export type Phase = "idle" | "thinking" | "talking" | "unknown";
export type AvatarState = "idle" | "thinking" | "talking";
export interface Theme {
  font: string;
  fontSize: number;
  text: string;
  background: string;
  code: string;
  composer: string;
  width: number;
}
export interface LayoutSettings {
  variant: "network" | "compact";
  contextBar: boolean;
  promptNavigator: boolean;
  messageCards: boolean;
  messageAvatars: boolean;
  messageNames: boolean;
  grid: boolean;
  composerFrame: boolean;
  accent: string;
  avatarSize: number;
  messageGap: number;
  userName: string;
  userAvatar: string;
}
export const defaultLayout: LayoutSettings = {
  variant: "network",
  contextBar: true,
  promptNavigator: true,
  messageCards: true,
  messageAvatars: true,
  messageNames: true,
  grid: true,
  composerFrame: true,
  accent: "#32d9f5",
  avatarSize: 64,
  messageGap: 24,
  userName: "Você",
  userAvatar: "",
};
export interface Settings {
  enabled: boolean;
  navigation: "native" | "topbar";
  hideSidebar: boolean;
  personas: boolean;
  chains: boolean;
  performance: boolean;
  keepTurns: number;
  showAvatar: boolean;
  showName: boolean;
  reduceMotion: boolean;
  debug: boolean;
  theme: Theme;
  layout: LayoutSettings;
}
export interface PersonaVersion {
  version: number;
  instructions: string;
  createdAt: string;
}
export interface Persona {
  id: string;
  name: string;
  instructions: string;
  avatars: Partial<Record<AvatarState, string>>;
  version: number;
  history: PersonaVersion[];
}
export interface ChainSession {
  id: string;
  title: string;
  url: string;
  personaId?: string;
  personaVersion?: number;
}
export interface Chain {
  id: string;
  name: string;
  projectId: string | null;
  sessions: ChainSession[];
  currentSession: string | null;
  defaultPersonaId: string | null;
  rememberLastPersona: boolean;
  lastPersonaId: string | null;
  continuationMessage: string;
  version: number;
}
export interface State {
  schema: 1;
  revision: number;
  settings: Settings;
  personas: Persona[];
  chains: Chain[];
}
export interface Selection {
  personaId: string | null;
  visualOnly: boolean;
  chainId: string | null;
}
export interface Owner {
  tabId: number;
  instanceId: string;
}
export interface SendLock extends Owner {
  token: string;
  personaId: string | null;
  personaName: string;
  createdAt: number;
  phase: "reserved" | "generating";
  orphaned: boolean;
}
export type Command =
  | { type: "settings"; patch: Partial<Settings> }
  | {
      type: "persona.save";
      persona: Omit<Persona, "version" | "history">;
      expectedVersion: number;
    }
  | { type: "persona.delete"; id: string; expectedVersion: number }
  | {
      type: "chain.save";
      chain: Omit<Chain, "version">;
      expectedVersion: number;
    }
  | { type: "chain.delete"; id: string; expectedVersion: number };
export const defaultTheme: Theme = {
  font: "monospace",
  fontSize: 15,
  text: "#d8e7ff",
  background: "#03131f",
  code: "#04121d",
  composer: "#061c2b",
  width: 1040,
};
export const presets: Record<string, Theme> = {
  Network: { ...defaultTheme },
  "Terminal azul": {
    ...defaultTheme,
    background: "#07111f",
    code: "#0b1728",
    composer: "#101d30",
    width: 850,
  },
  Papel: {
    font: "Georgia",
    fontSize: 17,
    text: "#242322",
    background: "#f5f1e8",
    code: "#e9e2d5",
    composer: "#fffcf5",
    width: 800,
  },
  Carvao: {
    font: "system-ui",
    fontSize: 16,
    text: "#eeeeef",
    background: "#18181b",
    code: "#252529",
    composer: "#27272a",
    width: 900,
  },
};
export function initialState(): State {
  return {
    schema: 1,
    revision: 0,
    settings: {
      enabled: true,
      navigation: "topbar",
      hideSidebar: true,
      personas: true,
      chains: true,
      performance: false,
      keepTurns: 30,
      showAvatar: true,
      showName: true,
      reduceMotion: false,
      debug: false,
      theme: { ...defaultTheme },
      layout: { ...defaultLayout },
    },
    personas: [],
    chains: [],
  };
}
export const emptySelection = (): Selection => ({
  personaId: null,
  visualOnly: false,
  chainId: null,
});
export function newChain(name: string, projectId: string | null): Chain {
  return {
    id: crypto.randomUUID(),
    name,
    projectId,
    sessions: [],
    currentSession: null,
    defaultPersonaId: null,
    rememberLastPersona: true,
    lastPersonaId: null,
    continuationMessage: "",
    version: 0,
  };
}
