/** Presentation tokens belong here; DOM integration lives in independent feature modules. */
export const networkCSS = `
:host([data-network-shell]){position:fixed!important;inset:0 0 auto!important;transform:none!important;width:100%!important;z-index:40!important;color:var(--nagi-ui-text,#d8e7ff);font:13px/1.4 var(--nagi-ui-font,monospace);pointer-events:none}
:host([data-network-shell]) .bar{pointer-events:auto;width:100%;max-width:none;min-height:88px;gap:10px;padding:10px 22px;border:0;border-bottom:1px solid var(--nagi-line);border-radius:0;background:var(--nagi-ui-bg,#03131f);box-shadow:none;overflow-x:auto;scrollbar-width:thin}
:host([data-network-shell]) .brand{display:flex;align-items:center;gap:20px;flex-shrink:0;margin:0 14px 0 0;padding-right:24px;border-right:1px solid var(--nagi-line);color:var(--nagi-accent,#32d9f5)}
.brand-word{font:bold 38px/1 monospace;letter-spacing:3px;text-shadow:0 2px 0 color-mix(in srgb,var(--nagi-accent) 35%,transparent)}
.brand-note{font:9px/1.5 monospace;letter-spacing:1px;white-space:pre-line}
.native-mode-slot{width:124px;height:34px;pointer-events:none}
.mode-switcher{display:flex;align-items:center;gap:3px;flex-shrink:0;padding:3px;border:1px solid var(--nagi-line);border-radius:6px;background:var(--nagi-ui-panel)}
.context-strip .mode-switcher button{font:12px/1.4 var(--nagi-ui-font,monospace);padding:7px 10px;min-height:32px;background:transparent;border:1px solid transparent;color:var(--nagi-ui-text);white-space:nowrap}
.context-strip .mode-switcher button[aria-pressed=true]{color:var(--nagi-accent);border-color:var(--nagi-accent);background:color-mix(in srgb,var(--nagi-accent) 12%,var(--nagi-ui-panel))}
:host([data-network-shell]) .bar .tool{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;min-width:65px;height:62px;padding:6px 8px;border:1px solid transparent;background:transparent;border-radius:5px;color:var(--nagi-ui-text);font-size:11px;white-space:nowrap;flex-shrink:0}
:host([data-network-shell]) .tool svg{color:var(--nagi-accent)}
:host([data-network-shell]) .bar button:hover{background:color-mix(in srgb,var(--nagi-accent) 10%,transparent);border-color:var(--nagi-line)}
:host([data-network-shell]) .bar .tool-small{min-width:32px;padding:6px;height:38px}
:host([data-network-shell]) .bar .tool-small svg{width:19px;height:19px}
:host([data-network-shell]) .bar .sep{display:none}
:host([data-network-shell]) .bar .answer-choice{margin-left:auto;display:flex;gap:12px;align-items:center;flex-shrink:0;border:1px solid var(--nagi-accent);background:var(--nagi-ui-panel);min-height:54px;padding:6px 12px}
:host([data-network-shell]) .identity img{width:40px;height:40px;border:1px solid var(--nagi-line);border-radius:4px}
:host([data-network-shell]) .identity .name{font-size:17px;max-width:160px;overflow:hidden;text-overflow:ellipsis}
:host([data-network-shell]) .context-strip{pointer-events:auto;box-sizing:border-box;display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:9px 16px;min-height:52px;border:1px solid var(--nagi-line);border-radius:0 0 6px 6px;background:var(--nagi-ui-bg,#03131f)}
.context-info{display:flex;align-items:center;gap:10px;min-width:160px;flex:1;overflow:hidden;white-space:nowrap}
.chat-title{overflow:hidden;text-overflow:ellipsis;max-width:340px;min-width:70px}.context-project{max-width:180px;overflow:hidden;text-overflow:ellipsis}.divider{color:var(--nagi-accent)}
.context-strip button,.context-strip a{font:12px/1.4 var(--nagi-ui-font,monospace);color:var(--nagi-ui-text);background:var(--nagi-ui-panel);border:1px solid var(--nagi-line);border-radius:5px;padding:6px 9px;white-space:nowrap;text-decoration:none}
.context-strip .context-badge{font-size:11px;color:var(--nagi-accent);border:1px solid var(--nagi-line);border-radius:20px;padding:3px 10px;max-width:170px;overflow:hidden;text-overflow:ellipsis;flex-shrink:0}
.context-strip .session-number{font-size:11px;color:var(--nagi-accent);flex-shrink:0}.chain-nav,.prompt-nav{display:flex;align-items:center;gap:4px;flex-shrink:0}.prompt-nav{padding-left:8px;border-left:1px solid var(--nagi-line)}
.context-strip .prompt-nav .icon{height:30px;width:30px;font-size:16px}.context-strip button:disabled{opacity:.4;cursor:default}.native-actions{height:34px;flex-shrink:0;pointer-events:none}
:host([data-network-shell]) .message{pointer-events:auto;margin:8px auto;max-width:650px}
@media(max-width:1100px){.brand-note{display:none}:host([data-network-shell]) .brand{padding-right:12px;margin-right:0}.brand-word{font-size:30px;letter-spacing:1px}:host([data-network-shell]) .bar{padding-inline:12px;gap:4px}:host([data-network-shell]) .bar .tool{min-width:56px}.context-info{flex-basis:100%}.chat-title{max-width:none;flex:1}}
@media(max-width:650px){:host([data-network-shell]) .bar{min-height:76px}:host([data-network-shell]) .brand{display:none}:host([data-network-shell]) .bar .tool{min-width:50px;font-size:10px;height:52px}.answer-label{display:none}:host([data-network-shell]) .identity .name{max-width:100px}.context-info{gap:6px;flex-wrap:wrap;overflow:visible}.chat-title{flex-basis:65%;min-width:0}.context-strip .context-badge{max-width:110px}.context-strip .context-project{max-width:100px}.prompt-nav{padding-left:0;border-left:0}.session-number{display:none}}
`;
