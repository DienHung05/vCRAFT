import { ASSISTANT_BLOCK_REASONS, CitationSchema } from '@vcraft/contracts';
import { z } from 'zod';
import type { Conversation } from './conversation';

export const ARCHIVE_KEY = 'vcraft.assistant.archive.v1';

type ArchiveStorage = Pick<Storage, 'getItem' | 'setItem'> | null;

const archivedMessage = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  text: z.string(),
  status: z.enum(['done', 'blocked', 'error', 'stopped']),
  citations: z.array(CitationSchema).optional(),
  messageId: z.string().optional(),
  blockReason: z.enum(ASSISTANT_BLOCK_REASONS).optional(),
  retryAt: z.number().finite().optional(),
  feedback: z.enum(['UP', 'DOWN']).optional(),
});
const archivedConversation = z.object({
  id: z.string(),
  messages: z.array(archivedMessage).min(1),
  seenThoughts: z.array(z.int().nonnegative()),
  savedAt: z.number().int().min(0).max(8_640_000_000_000_000),
});
export type ArchivedConversation = Conversation & { savedAt: number };

/** Persistent history is optional, including when access to localStorage itself is blocked. */
export function archiveStorage(): ArchiveStorage {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadArchive(storage: Pick<Storage, 'getItem'> | null): ArchivedConversation[] {
  try {
    const raw = storage?.getItem(ARCHIVE_KEY);
    if (!raw) return [];
    const parsed = z.array(archivedConversation).safeParse(JSON.parse(raw));
    // JSON cannot contain explicit undefined values on optional ChatMessage fields.
    return parsed.success ? (parsed.data as ArchivedConversation[]) : [];
  } catch {
    return [];
  }
}

function saveArchive(
  storage: ArchiveStorage,
  archive: ArchivedConversation[],
): ArchivedConversation[] {
  try {
    if (!storage) return [];
    storage.setItem(ARCHIVE_KEY, JSON.stringify(archive));
    return archive;
  } catch {
    // A blocked or full store behaves like an empty history.
    return [];
  }
}

export function deleteArchivedConversation(
  storage: ArchiveStorage,
  id: string,
): ArchivedConversation[] {
  return saveArchive(
    storage,
    loadArchive(storage).filter((entry) => entry.id !== id),
  );
}

export function archiveConversation(
  storage: ArchiveStorage,
  conversation: Conversation,
  savedAt = Date.now(),
): ArchivedConversation[] {
  const archive = loadArchive(storage);
  const messages = conversation.messages.filter(
    (message) => message.status !== 'pending' && message.status !== 'streaming',
  );
  if (messages.length === 0) return archive;
  return saveArchive(
    storage,
    [
      { ...conversation, messages, savedAt },
      ...archive.filter((entry) => entry.id !== conversation.id),
    ]
      .sort((a, b) => b.savedAt - a.savedAt)
      .slice(0, 20),
  );
}
