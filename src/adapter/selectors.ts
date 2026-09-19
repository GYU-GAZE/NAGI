/** Candidate hooks, NOT verified against authenticated ChatGPT in this environment.
 * Keep all upstream selectors here. See docs/INTEGRATION.md. */
export const selectors = {
  composer: '#prompt-textarea, textarea[data-testid="prompt-textarea"]',
  send: 'button[data-testid="send-button"], button[aria-label="Send prompt"], button[aria-label="Enviar prompt"], button[aria-label="Enviar mensagem"]',
  stop: 'button[data-testid="stop-button"], button[aria-label="Stop generating"], button[aria-label="Parar de gerar"]',
  sidebar: "#history",
  turn: 'article[data-testid^="conversation-turn-"]',
  assistant: '[data-message-author-role="assistant"]',
  finalText: ".markdown",
  progress: '[role="status"], [aria-live="polite"], details',
  newChat: 'a[data-testid="create-new-chat-button"], nav a[href="/"]',
  nav: "nav, #history",
};
