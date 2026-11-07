'use client';

import type { CitationDto } from '@vcraft/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type ChatMessage,
  type Conversation,
  createSseParser,
  historyOf,
  loadConversation,
  newConversation,
  saveConversation,
} from './conversation';
import {
  type ArchivedConversation,
  archiveConversation,
  archiveStorage,
  deleteArchivedConversation,
  loadArchive,
} from './conversation-archive';

const session = () => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

type Patch = Partial<ChatMessage> | ((m: ChatMessage) => Partial<ChatMessage>);

/**
 * The widget's conversation: sends a question to `POST /api/v1/assistant/messages`, reads the SSE answer,
 * paints tokens once per animation frame, and keeps everything in `sessionStorage` (FR-AST-04, 05).
 */
export function useAssistant({ locale, pagePath }: { locale: 'vi' | 'en'; pagePath: string }) {
  const [conversation, setConversation] = useState<Conversation>(() =>
    typeof window === 'undefined' ? newConversation() : loadConversation(session()),
  );
  const [archive, setArchive] = useState<ArchivedConversation[]>([]);
  const refreshArchive = useCallback(() => setArchive(loadArchive(archiveStorage())), []);
  useEffect(refreshArchive, [refreshArchive]);
  const abort = useRef<AbortController | null>(null);
  const busy = conversation.messages.some(
    (m) => m.status === 'pending' || m.status === 'streaming',
  );

  useEffect(() => saveConversation(session(), conversation), [conversation]);
  useEffect(() => () => abort.current?.abort(), []);

  const patch = useCallback((id: string, change: Patch) => {
    setConversation((c) => ({
      ...c,
      messages: c.messages.map((m) =>
        m.id === id ? { ...m, ...(typeof change === 'function' ? change(m) : change) } : m,
      ),
    }));
  }, []);

  const ask = useCallback(
    async (question: string, earlier: readonly ChatMessage[]) => {
      const reply: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: '',
        status: 'pending',
      };
      setConversation((c) => ({ ...c, messages: [...c.messages, reply] }));
      const controller = new AbortController();
      abort.current = controller;

      // Tokens collect here and reach React once per frame, not once per chunk.
      let pending = '';
      let frame = 0;
      const flush = () => {
        frame = 0;
        if (!pending || abort.current !== controller) return;
        const text = pending;
        pending = '';
        patch(reply.id, (m) => ({ text: m.text + text, status: 'streaming' }));
      };
      const finish = (change: Partial<ChatMessage>) => {
        if (frame) cancelAnimationFrame(frame);
        flush();
        if (abort.current === controller) patch(reply.id, change);
      };

      try {
        const res = await fetch('/api/v1/assistant/messages', {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
          body: JSON.stringify({
            message: question,
            history: historyOf(earlier),
            locale,
            pagePath: pagePath.slice(0, 300),
            conversationId: conversation.id,
          }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) throw new Error(`assistant ${res.status}`);
        const parse = createSseParser();
        const decoder = new TextDecoder();
        const reader = res.body.getReader();
        let citations: CitationDto[] = [];
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const event of parse(decoder.decode(value, { stream: true }))) {
            if (event.type === 'delta') {
              pending += event.text;
              frame ||= requestAnimationFrame(flush);
            } else if (event.type === 'citations') citations = event.citations;
            else if (event.type === 'done')
              return finish({ status: 'done', messageId: event.messageId, citations });
            else if (event.type === 'blocked')
              return finish({
                status: 'blocked',
                blockReason: event.reason,
                ...(event.retryAfter !== undefined && {
                  retryAt: Date.now() + event.retryAfter * 1000,
                }),
              });
            else if (event.type === 'error') return finish({ status: 'error' });
          }
        }
        finish({ status: 'error' });
      } catch {
        finish({ status: controller.signal.aborted ? 'stopped' : 'error' });
      } finally {
        if (abort.current === controller) abort.current = null;
      }
    },
    [conversation.id, locale, pagePath, patch],
  );

  const send = useCallback(
    (text: string) => {
      const question = text.trim();
      if (!question || busy) return;
      const earlier = conversation.messages;
      const mine: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        text: question,
        status: 'done',
      };
      setConversation((c) => ({ ...c, messages: [...c.messages, mine] }));
      void ask(question, earlier);
    },
    [ask, busy, conversation.messages],
  );

  /** Asks the last question again after an error or a stop, replacing the failed answer. */
  const retry = useCallback(() => {
    const messages = conversation.messages;
    const last = messages.at(-1);
    const question = messages.findLast((m) => m.role === 'user');
    if (last?.role !== 'assistant' || !question || busy) return;
    const kept = messages.slice(0, -1);
    setConversation((c) => ({ ...c, messages: kept }));
    void ask(
      question.text,
      kept.filter((m) => m.id !== question.id),
    );
  }, [ask, busy, conversation.messages]);

  const stop = useCallback(() => abort.current?.abort(), []);

  const cancelForSwitch = useCallback(() => {
    abort.current?.abort();
    abort.current = null;
  }, []);

  const reset = useCallback(() => {
    cancelForSwitch();
    setArchive(archiveConversation(archiveStorage(), conversation));
    setConversation({ ...newConversation(), seenThoughts: conversation.seenThoughts });
  }, [cancelForSwitch, conversation]);

  const restore = useCallback(
    (id: string) => {
      const storage = archiveStorage();
      const saved = loadArchive(storage).find((entry) => entry.id === id);
      if (!saved) return;
      cancelForSwitch();
      setArchive(archiveConversation(storage, conversation));
      setConversation({ id: saved.id, messages: saved.messages, seenThoughts: saved.seenThoughts });
    },
    [cancelForSwitch, conversation],
  );

  const removeFromArchive = useCallback((id: string) => {
    setArchive(deleteArchivedConversation(archiveStorage(), id));
  }, []);

  const rate = useCallback(
    async (message: ChatMessage, rating: 'UP' | 'DOWN') => {
      if (!message.messageId || message.feedback) return;
      patch(message.id, { feedback: rating });
      await fetch(`/api/v1/assistant/messages/${message.messageId}/feedback`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rating }),
      }).catch(() => undefined);
    },
    [patch],
  );

  const markThoughtsSeen = useCallback((indices: readonly number[]) => {
    setConversation((c) => ({
      ...c,
      seenThoughts: [...new Set([...c.seenThoughts, ...indices])],
    }));
  }, []);

  return {
    archive,
    refreshArchive,
    restore,
    removeFromArchive,
    messages: conversation.messages,
    seenThoughts: conversation.seenThoughts,
    busy,
    send,
    retry,
    stop,
    reset,
    rate,
    markThoughtsSeen,
  };
}
