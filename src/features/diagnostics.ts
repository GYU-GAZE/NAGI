import { resolveProjects, resolveProjectsControl } from "../adapter/projects";
import { resolveModeControls } from "../adapter/modes";
import { resolveAuxiliaryPanels } from "./auxiliary-panels";
import { resolveMessageGroups } from "../adapter/messages";
import type { State } from "../shared/model";
import { resolveHeader, headerControls, headerAction } from "../adapter/header";
import { VERSION } from "../shared/version";
import { resolveRegions } from "../adapter/regions";
import { selectors as S } from "../adapter/selectors";

const knownIDs = new Set([
  "history",
  "sidebar",
  "stage-slideover-sidebar",
  "stage-sidebar-tiny-bar",
  "prompt-textarea",
  "composer-background",
  "thread",
  "thread-bottom-container",
  "page-header",
  "nagi-root",
  "nagi-panel-frame",
]);
// Whitelisted structural classes only. Never emit arbitrary class/attribute values.
const structuralClass =
  /^(?:(?:[a-z]{2,8}:)*(?:flex|inline-flex|grid|block|hidden|fixed|sticky|relative|absolute|isolate|isolation-auto|grow|shrink|shrink-0|flex-1|flex-auto|flex-col|flex-row|overflow-(?:auto|hidden|visible)|h-full|w-full|min-w-0|border|border-\d|rounded(?:-(?:sm|md|lg|xl|\dxl|full))?|shadow(?:-(?:sm|md|lg|xl|\dxl|none))?|bg-token-(?:main-surface-primary|main-surface-secondary|main-surface-tertiary|sidebar-surface-primary|sidebar-surface-secondary|composer-surface-primary))|(?:bg|ring|border|shadow)-\[#[0-9a-fA-F]{3,8}\])$/;
const count = (n: number) => Math.round(n * 10) / 10;
function elementDescription(el: Element) {
  const style = el.ownerDocument.defaultView?.getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  const id = el.getAttribute("id");
  const classList = [...el.classList];
  const testid = el.getAttribute("data-testid");
  const knownTestIds = new Set([
    "sidebar",
    "history-sidebar",
    "composer",
    "composer-background",
    "send-button",
    "stop-button",
    "create-new-chat-button",
  ]);
  const value = (name: string) => style?.getPropertyValue(name) ?? "";
  // Computed CSS only from typed properties that cannot embed text, paths or URLs.
  const appearance = Object.fromEntries(
    [
      "display",
      "position",
      "visibility",
      "background-color",
      "color",
      "border-top-color",
      "border-top-width",
      "border-top-style",
      "border-radius",
      "box-shadow",
      "outline-color",
      "outline-width",
      "width",
      "min-width",
      "max-width",
      "height",
      "padding",
      "margin",
      "overflow",
      "flex-basis",
      "font-family",
      "font-size",
      "contain",
      "content-visibility",
    ].map((k) => [k, value(k)]),
  );
  return {
    tag: el.tagName.toLowerCase(),
    id: knownIDs.has(id ?? "") ? id : null,
    testHook: knownTestIds.has(testid ?? "") ? testid : null,
    classes: classList.filter((c) => structuralClass.test(c)),
    otherClassCount: classList.filter((c) => !structuralClass.test(c)).length,
    marks: [...el.attributes]
      .map((a) => a.name)
      .filter((k) =>
        /^data-nagi-(?:header(?:-layer|-layout|-part|-control)?|surface|sidebar|composer-(?:layer|root|outer))$/.test(
          k,
        ),
      ),
    rect: {
      x: count(rect.x),
      y: count(rect.y),
      width: count(rect.width),
      height: count(rect.height),
    },
    style: appearance,
    pseudo: el.ownerDocument.defaultView?.CSS?.supports?.("selector(::before)")
      ? ["::before", "::after"].map((pseudo) => {
          const computed = el.ownerDocument.defaultView!.getComputedStyle(
            el,
            pseudo,
          );
          return {
            pseudo,
            display: computed.display,
            backgroundColor: computed.backgroundColor,
            borderColor: computed.borderColor,
            boxShadow: computed.boxShadow,
            hasContent:
              computed.content !== "none" && computed.content !== "normal",
            hasBackgroundImage: computed.backgroundImage !== "none",
          };
        })
      : [],
    hasBackgroundImage:
      !!value("background-image") && value("background-image") !== "none",
    fixedContainerSignals: {
      transform: value("transform") !== "none" && !!value("transform"),
      filter: value("filter") !== "none" && !!value("filter"),
      perspective: value("perspective") !== "none" && !!value("perspective"),
    },
    childElementCount: el.childElementCount,
  };
}
function ancestors(el: Element | null, maximum = 12) {
  const list: ReturnType<typeof elementDescription>[] = [];
  for (let depth = 0; el && depth < maximum; depth++, el = el.parentElement)
    list.push(elementDescription(el));
  return list;
}
export function createDiagnosticReport(state: State, doc: Document = document) {
  const r = resolveRegions(doc);
  const header = resolveHeader(doc);
  const modes = resolveModeControls(doc);
  const messages = resolveMessageGroups(doc);
  const win = doc.defaultView;
  const browser =
    win?.navigator.userAgent.match(/(?:Firefox|Edg|Chrome)\/[\d.]+/)?.[0] ??
    "unknown";
  const candidates = [...doc.querySelectorAll<HTMLElement>("nav,aside")]
    .filter((e) => !e.closest("[data-message-author-role]"))
    .slice(0, 12);
  const root = doc.documentElement;
  return {
    format: "nagi-diagnostics",
    formatVersion: 6,
    extensionVersion: VERSION,
    createdAt: new Date().toISOString(),
    privacy:
      "No chat text, draft, instructions, persona or chain names/IDs, avatars, URLs, cookies, tokens, full HTML, arbitrary attributes or styles are included.",
    environment: {
      browser,
      viewport: {
        width: win?.innerWidth,
        height: win?.innerHeight,
        pixelRatio: win?.devicePixelRatio,
      },
      pageKind: /\/c\//.test(win?.location.pathname ?? "")
        ? "conversation"
        : "other",
    },
    settings: {
      enabled: state.settings.enabled,
      navigation: state.settings.navigation,
      hideSidebar: state.settings.hideSidebar,
      personas: state.settings.personas,
      chains: state.settings.chains,
      performance: state.settings.performance,
      keepTurns: state.settings.keepTurns,
      showAvatar: state.settings.showAvatar,
      showName: state.settings.showName,
      reduceMotion: state.settings.reduceMotion,
      debug: state.settings.debug,
      layout: {
        variant: state.settings.layout.variant,
        contextBar: state.settings.layout.contextBar,
        promptNavigator: state.settings.layout.promptNavigator,
        messageCards: state.settings.layout.messageCards,
        messageAvatars: state.settings.layout.messageAvatars,
        messageNames: state.settings.layout.messageNames,
        grid: state.settings.layout.grid,
        composerFrame: state.settings.layout.composerFrame,
        accent: state.settings.layout.accent,
        avatarSize: state.settings.layout.avatarSize,
        messageGap: state.settings.layout.messageGap,
        hasUserAvatar: !!state.settings.layout.userAvatar,
      },
      theme: {
        font: state.settings.theme.font,
        fontSize: state.settings.theme.fontSize,
        text: state.settings.theme.text,
        background: state.settings.theme.background,
        code: state.settings.theme.code,
        composer: state.settings.theme.composer,
        width: state.settings.theme.width,
      },
    },
    counts: {
      personas: state.personas.length,
      chains: state.chains.length,
      turns: doc.querySelectorAll(S.turn).length,
      userMessages: messages.filter((r) => r.role === "user").length,
      assistantMessages: messages.filter((r) => r.role === "assistant").length,
    },
    active: {
      headerIntegration:
        root.hasAttribute("data-nagi-header-active") ||
        !!doc.querySelector("[data-nagi-context-header]"),
      reasoningIdentities: doc.querySelectorAll("[data-nagi-reasoning]").length,
      homeRegions: doc.querySelectorAll("[data-nagi-home]").length,
      nativePanels: doc.querySelectorAll("[data-nagi-native-panel]").length,
      networkLayout: root.getAttribute("data-nagi-layout") === "network",
      dockedControls: doc.querySelectorAll("[data-nagi-docked]").length,
      messageCards: doc.querySelectorAll("[data-nagi-message-card]").length,
      messageGroups: doc.querySelectorAll("[data-nagi-message-envelope]")
        .length,
      messageAccessories: doc.querySelectorAll("[data-nagi-message-accessory]")
        .length,
      auxiliaryPanels: doc.querySelectorAll("[data-nagi-aux-panel]").length,
      promptTargets: doc.querySelectorAll("[data-nagi-prompt-target]").length,
      headerStacked: root.hasAttribute("data-nagi-header-stacked"),
      theme: root.hasAttribute("data-nagi-theme"),
      sidebarCollapse: root.hasAttribute("data-nagi-sidebar-collapsed"),
      panelFrame: !!doc.querySelector("#nagi-panel-frame"),
      hiddenSidebars: doc.querySelectorAll('[data-nagi-sidebar="hidden"]')
        .length,
    },
    matches: {
      projects: {
        links: resolveProjects(doc).length,
        nativeControl: !!resolveProjectsControl(doc),
      },
      modes: {
        paired: !!modes.chat && !!modes.work,
        menu: !!modes.trigger,
        active: modes.active,
      },
      header: !!header,
      headerControls: headerControls(header).map(
        (e) => headerAction(e) ?? "other",
      ),
      composer: !!r.composer,
      composerRoot: !!r.composerRoot,
      sidebar: r.sidebar.length,
      composerLayers: r.composerLayers.length,
      outerLayers: r.composerOuter.length,
    },
    regions: {
      messageSamples: messages.slice(0, 4).map((r) => ({
        role: r.role,
        node: elementDescription(r.node),
        turn: elementDescription(r.turn),
      })),
      messageGroups: messages.slice(-4).map((r) => ({
        role: r.role,
        envelope: elementDescription(r.envelope),
        path: r.path.map(elementDescription),
        accessories: r.accessories.map(elementDescription),
      })),
      dockedActions: [
        ...doc.querySelectorAll<HTMLElement>("[data-nagi-docked]"),
      ].map((e) => ({
        kind: headerAction(e) ?? "other",
        node: elementDescription(e),
        ancestors: ancestors(e).slice(0, 6),
      })),
      auxiliaryPanels: resolveAuxiliaryPanels(doc).map(elementDescription),
      composerDecorations: r.composerDecorations.map(elementDescription),
      headerAncestors: ancestors(header).slice(0, 5),
      headerChildren: header
        ? [...header.children].slice(0, 12).map(elementDescription)
        : [],
      composerAncestors: ancestors(r.composer, 32),
      sidebarRoots: r.sidebar.map(elementDescription),
      sidebarAncestors: r.sidebar.map((s) => ancestors(s).slice(0, 5)),
      composerLayers: r.composerLayers.map(elementDescription),
      composerNearby: r.composerOuter
        .slice(0, 4)
        .map((parent) =>
          [...parent.children].slice(0, 10).map(elementDescription),
        ),
      outerLayers: r.composerOuter.map(elementDescription),
      pageSurfaces: r.pageSurfaces.map(elementDescription),
      navigationCandidates: candidates.map(elementDescription),
    },
    limitation:
      "Selector candidates require comparison with a screenshot from the actual page. This report does not verify generation or Custom Instructions.",
  };
}
export function downloadDiagnosticReport(report: unknown) {
  const blob = new Blob([JSON.stringify(report, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `nagi-diagnostico-${VERSION}.json`;
  link.dataset.nagiOwned = "download";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
