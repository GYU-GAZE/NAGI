import type { ConversationService } from '../conversation/service';
import { readDraft, writeDraft } from './composer-draft';

/** Only observes the resolved ChatGPT composer, preserving the original draft. */
export class PromptHistory {
  private route = '';
  private cursor = -1;
  private draft = '';
  private recalled = '';
  private node?: HTMLElement;
  constructor(private service: ConversationService, private composer: () => HTMLElement | null, private enabled: () => boolean, private error: (message: string) => void) {
    window.addEventListener('keydown', this.key, true);
  }
  private key = (event: KeyboardEvent) => {
    if (!this.enabled() || event.defaultPrevented || event.isComposing || !event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    const node = this.composer();
    if (!node || !event.composedPath().includes(node)) return;
    const route = this.service.index.conversationId;
    if (this.route !== route || this.node !== node || (this.cursor >= 0 && readDraft(node) !== this.recalled)) {
      this.cursor = -1; this.route = route; this.node = node;
    }
    const prompts = this.service.index.all.filter(row => row.role === 'user');
    if (!prompts.length || (event.key === 'ArrowDown' && this.cursor < 0)) return;
    const cursor = event.key === 'ArrowUp' ? Math.min(prompts.length - 1, this.cursor + 1) : this.cursor - 1;
    if (this.cursor < 0) this.draft = readDraft(node);
    const text = cursor < 0 ? this.draft : prompts[prompts.length - 1 - cursor].text;
    event.preventDefault(); event.stopPropagation();
    try { writeDraft(node, text, true); this.cursor = cursor; this.recalled = text; }
    catch (error) { this.error(String(error)); }
  };
  dispose() { window.removeEventListener('keydown', this.key, true); }
}
