// The editor's own undo/redo history. The browser's built-in textarea undo is
// wiped by every programmatic edit (snippet expansion, shortcuts, figure
// edits…) and can't be capped or saved, so the editor keeps its own: a stack
// of small patches (one contiguous replacement each) rather than whole-document
// copies, which keeps 100 steps cheap and lets them be persisted.

export interface Patch {
  at: number; // offset in the document where the replacement starts
  removed: string; // the text that was there before
  inserted: string; // the text that replaced it
  // Typing bursts merge into one step; programmatic edits (snippets, figure
  // saves…) are "sealed" so they stay a step of their own.
  sealed: boolean;
  time: number; // ms timestamp of the last merged edit (0 for restored entries)
}

export interface UndoResult {
  value: string;
  caret: number;
}

export const DEFAULT_UNDO_LIMIT = 100;
// Edits closer together than this, and contiguous, count as one step.
const MERGE_WINDOW_MS = 800;

// The single replacement that turns `prev` into `next`: the span between their
// common prefix and common suffix. Never splits a surrogate pair.
export function diffPatch(prev: string, next: string): { at: number; removed: string; inserted: string } {
  let start = 0;
  const limit = Math.min(prev.length, next.length);
  while (start < limit && prev[start] === next[start]) start++;
  if (start > 0 && isHighSurrogate(prev.charCodeAt(start - 1))) start--;
  let endPrev = prev.length;
  let endNext = next.length;
  while (endPrev > start && endNext > start && prev[endPrev - 1] === next[endNext - 1]) {
    endPrev--;
    endNext--;
  }
  if (endPrev < prev.length && isLowSurrogate(prev.charCodeAt(endPrev))) {
    endPrev++;
    endNext++;
  }
  return { at: start, removed: prev.slice(start, endPrev), inserted: next.slice(start, endNext) };
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}
function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}

// A short, stable fingerprint of a document, to tell whether a saved history
// still belongs to the text that's now in the editor.
export function fingerprint(doc: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < doc.length; i++) {
    h ^= doc.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${doc.length}:${(h >>> 0).toString(16)}`;
}

export class UndoHistory {
  private undoStack: Patch[] = [];
  private redoStack: Patch[] = [];

  constructor(private readonly limit = DEFAULT_UNDO_LIMIT) {}

  get undoCount(): number {
    return this.undoStack.length;
  }
  get redoCount(): number {
    return this.redoStack.length;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  // Records that the document changed from `prev` to `next`. A new edit
  // discards the redo stack.
  record(prev: string, next: string, options: { sealed?: boolean; now?: number } = {}): void {
    if (prev === next) return;
    const now = options.now ?? Date.now();
    const sealed = options.sealed ?? false;
    const edit = diffPatch(prev, next);
    this.redoStack = [];

    const last = this.undoStack[this.undoStack.length - 1];
    if (!sealed && last && !last.sealed && now - last.time <= MERGE_WINDOW_MS && this.tryMerge(last, edit)) {
      last.time = now;
      return;
    }
    this.undoStack.push({ ...edit, sealed, time: now });
    if (this.undoStack.length > this.limit) this.undoStack.shift();
  }

  // Merges `edit` into `last` when it continues the same burst of typing,
  // backspacing or forward-deleting. Newlines end a typing burst.
  private tryMerge(last: Patch, edit: { at: number; removed: string; inserted: string }): boolean {
    const typing = last.removed === "" && edit.removed === "" && last.inserted !== "" && edit.inserted !== "";
    if (
      typing &&
      edit.at === last.at + last.inserted.length &&
      !edit.inserted.includes("\n") &&
      !last.inserted.endsWith("\n")
    ) {
      last.inserted += edit.inserted;
      return true;
    }
    const deleting = last.inserted === "" && edit.inserted === "" && last.removed !== "" && edit.removed !== "";
    if (deleting && edit.at + edit.removed.length === last.at) {
      // Backspace: the new deletion sits immediately before the last one.
      last.at = edit.at;
      last.removed = edit.removed + last.removed;
      return true;
    }
    if (deleting && edit.at === last.at) {
      // Forward delete: the new deletion sits where the last one started.
      last.removed += edit.removed;
      return true;
    }
    return false;
  }

  // Steps back one edit. Returns the restored document and where the caret
  // goes, or null if there is nothing to undo — or if the history no longer
  // matches `value` (it is then cleared rather than risk corrupting the text).
  undo(value: string): UndoResult | null {
    const patch = this.undoStack.pop();
    if (!patch) return null;
    if (value.slice(patch.at, patch.at + patch.inserted.length) !== patch.inserted) {
      this.clear();
      return null;
    }
    this.redoStack.push(patch);
    return {
      value: value.slice(0, patch.at) + patch.removed + value.slice(patch.at + patch.inserted.length),
      caret: patch.at + patch.removed.length,
    };
  }

  redo(value: string): UndoResult | null {
    const patch = this.redoStack.pop();
    if (!patch) return null;
    if (value.slice(patch.at, patch.at + patch.removed.length) !== patch.removed) {
      this.clear();
      return null;
    }
    this.undoStack.push({ ...patch, time: 0 });
    return {
      value: value.slice(0, patch.at) + patch.inserted + value.slice(patch.at + patch.removed.length),
      caret: patch.at + patch.inserted.length,
    };
  }

  // The undo steps as JSON, tagged with a fingerprint of the document they end
  // at, so they're only reused if the saved text is still that document. The
  // oldest steps are dropped first if the result would exceed `maxChars`.
  serialize(doc: string, maxChars = 400_000): string {
    let entries = this.undoStack.map(({ at, removed, inserted, sealed }) => ({ at, removed, inserted, sealed }));
    let json = JSON.stringify({ v: 1, doc: fingerprint(doc), entries });
    while (json.length > maxChars && entries.length > 0) {
      entries = entries.slice(Math.ceil(entries.length / 4));
      json = JSON.stringify({ v: 1, doc: fingerprint(doc), entries });
    }
    return json;
  }

  // Rebuilds a history from `serialize` output, or returns an empty one if the
  // data is missing, malformed, or belongs to a different document.
  static restore(json: string | null, doc: string, limit = DEFAULT_UNDO_LIMIT): UndoHistory {
    const history = new UndoHistory(limit);
    if (!json) return history;
    try {
      const data = JSON.parse(json) as { v?: number; doc?: string; entries?: Partial<Patch>[] };
      if (data.v !== 1 || data.doc !== fingerprint(doc) || !Array.isArray(data.entries)) return history;
      const entries: Patch[] = [];
      for (const e of data.entries) {
        if (typeof e.at !== "number" || typeof e.removed !== "string" || typeof e.inserted !== "string") return history;
        entries.push({ at: e.at, removed: e.removed, inserted: e.inserted, sealed: e.sealed === true, time: 0 });
      }
      history.undoStack = entries.slice(-limit);
    } catch {
      // Unreadable saved history is simply ignored.
    }
    return history;
  }
}
