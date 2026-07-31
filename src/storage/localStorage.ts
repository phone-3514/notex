const STORAGE_KEY = "mathnote:note:v1";

export interface NoteData {
  title: string;
  content: string;
  updatedAt: number;
}

export function loadNote(): NoteData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<NoteData>;
    if (typeof parsed.content !== "string") return null;
    return {
      title: typeof parsed.title === "string" ? parsed.title : "Untitled",
      content: parsed.content,
      updatedAt: parsed.updatedAt ?? Date.now(),
    };
  } catch {
    return null;
  }
}

export function saveNote(title: string, content: string): NoteData {
  const data: NoteData = { title, content, updatedAt: Date.now() };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage unavailable (private mode / quota) — fail silently, in-memory state still works.
    }
  }
  return data;
}
