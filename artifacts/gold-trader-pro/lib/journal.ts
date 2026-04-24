import AsyncStorage from "@react-native-async-storage/async-storage";

export interface JournalEntry {
  id: string;
  symbol: string;
  side: "LONG" | "SHORT";
  entry: number;
  exit?: number;
  size: number;
  openedAt: number;
  closedAt?: number;
  strategy?: string;
  notes?: string;
  status: "OPEN" | "CLOSED";
  pnl?: number;
}

const KEY = "gtp_journal_v1";

export async function listEntries(): Promise<JournalEntry[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as JournalEntry[];
  } catch {
    return [];
  }
}

export async function saveAll(entries: JournalEntry[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(entries));
}

export async function addEntry(
  e: Omit<JournalEntry, "id" | "openedAt" | "status">,
): Promise<JournalEntry> {
  const list = await listEntries();
  const entry: JournalEntry = {
    ...e,
    id: Date.now().toString() + Math.random().toString(36).slice(2, 8),
    openedAt: Date.now(),
    status: "OPEN",
  };
  list.unshift(entry);
  await saveAll(list);
  return entry;
}

export async function closeEntry(id: string, exit: number): Promise<void> {
  const list = await listEntries();
  const i = list.findIndex((e) => e.id === id);
  if (i < 0) return;
  const entry = list[i]!;
  const dir = entry.side === "LONG" ? 1 : -1;
  entry.exit = exit;
  entry.closedAt = Date.now();
  entry.status = "CLOSED";
  entry.pnl = (exit - entry.entry) * dir * entry.size;
  await saveAll(list);
}

export async function deleteEntry(id: string): Promise<void> {
  const list = await listEntries();
  await saveAll(list.filter((e) => e.id !== id));
}
