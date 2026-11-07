import { describe, expect, it } from 'vitest';
import type { Conversation } from '@/features/assistant/conversation';
import {
  ARCHIVE_KEY,
  archiveConversation,
  deleteArchivedConversation,
  loadArchive,
} from '@/features/assistant/conversation-archive';

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

const conversation = (id = 'first'): Conversation => ({
  id,
  messages: [
    { id: 'question', role: 'user', text: 'Where can I visit a workshop?', status: 'done' },
    {
      id: 'answer',
      role: 'assistant',
      text: 'Visit the village map.',
      status: 'done',
      citations: [{ title: 'Village map', url: '/en/map', type: 'PAGE' }],
    },
    { id: 'pending', role: 'assistant', text: '', status: 'pending' },
    { id: 'streaming', role: 'assistant', text: 'Incomplete answer', status: 'streaming' },
  ],
  seenThoughts: [2],
});

describe('conversation archive', () => {
  it('ignores empty conversations and returns empty history when storage cannot be used', () => {
    const persistent = storage();
    expect(archiveConversation(persistent, { ...conversation(), messages: [] })).toEqual([]);
    expect(persistent.getItem(ARCHIVE_KEY)).toBeNull();
    const broken = {
      getItem: () => {
        throw new Error('Storage blocked');
      },
      setItem: () => {
        throw new Error('Quota exceeded');
      },
    };
    expect(loadArchive(broken)).toEqual([]);
    expect(archiveConversation(broken, conversation())).toEqual([]);
    expect(deleteArchivedConversation(broken, 'first')).toEqual([]);
    expect(archiveConversation(null, conversation())).toEqual([]);
    expect(archiveConversation({ ...persistent, setItem: broken.setItem }, conversation())).toEqual(
      [],
    );
  });

  it.each(['{broken', 'null', '{}', '[null]', '[{"id":"bad","messages":[null],"savedAt":1}]'])(
    'ignores corrupt archive data %s',
    (raw) => {
      expect(loadArchive({ getItem: () => raw })).toEqual([]);
    },
  );

  it('deletes only the selected conversation and persists the remaining history', () => {
    const persistent = storage();
    archiveConversation(persistent, conversation('first'), 10);
    archiveConversation(persistent, conversation('second'), 20);
    deleteArchivedConversation(persistent, 'first');
    expect(loadArchive(persistent).map((entry) => entry.id)).toEqual(['second']);
    deleteArchivedConversation(persistent, 'second');
    expect(loadArchive(persistent)).toEqual([]);
  });
  it('keeps the newest twenty and updates a restored conversation without duplicating it', () => {
    const persistent = storage();
    for (let i = 0; i < 22; i++) archiveConversation(persistent, conversation(`chat-${i}`), i);
    const archive = loadArchive(persistent);
    expect(archive).toHaveLength(20);
    expect(archive[0]?.id).toBe('chat-21');
    expect(archive.at(-1)?.id).toBe('chat-2');
    archiveConversation(persistent, conversation('chat-5'), 30);
    expect(loadArchive(persistent).map((entry) => entry.id)).toEqual([
      'chat-5',
      'chat-21',
      'chat-20',
      'chat-19',
      'chat-18',
      'chat-17',
      'chat-16',
      'chat-15',
      'chat-14',
      'chat-13',
      'chat-12',
      'chat-11',
      'chat-10',
      'chat-9',
      'chat-8',
      'chat-7',
      'chat-6',
      'chat-4',
      'chat-3',
      'chat-2',
    ]);
  });
  it('restores finished messages and citations from persistent storage without unfinished answers', () => {
    const persistent = storage();
    archiveConversation(persistent, conversation(), 1_700_000_000_000);
    expect(loadArchive(persistent)).toEqual([
      {
        ...conversation(),
        messages: conversation().messages.slice(0, 2),
        savedAt: 1_700_000_000_000,
      },
    ]);
  });
});
