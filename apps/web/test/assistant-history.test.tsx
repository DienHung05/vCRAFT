import { fireEvent, screen } from '@testing-library/react';
import { messages } from '@vcraft/i18n';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AssistantPanel } from '@/features/assistant/assistant-panel';
import { CONVERSATION_KEY } from '@/features/assistant/conversation';
import { useAssistant } from '@/features/assistant/use-assistant';
import { renderEn, renderVi } from './render';

function Chat() {
  const assistant = useAssistant({ locale: 'en', pagePath: '/en' });
  return (
    <AssistantPanel
      {...assistant}
      page="home"
      mascot={null}
      onSend={assistant.send}
      onStop={assistant.stop}
      onRetry={assistant.retry}
      onReset={assistant.reset}
      onRate={assistant.rate}
      onClose={() => {}}
      onRestore={assistant.restore}
      onDelete={assistant.removeFromArchive}
      onHistory={assistant.refreshArchive}
    />
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  sessionStorage.setItem(
    CONVERSATION_KEY,
    JSON.stringify({
      id: 'saved-chat',
      seenThoughts: [],
      messages: [
        { id: 'q1', role: 'user', text: 'Where can I visit a workshop?', status: 'done' },
        { id: 'a1', role: 'assistant', text: 'Open the village map.', status: 'done' },
      ],
    }),
  );
});
afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('assistant history', () => {
  it('opens archived messages from a fresh tab session', () => {
    const first = renderEn(<Chat />);
    fireEvent.click(screen.getByRole('button', { name: 'New conversation' }));
    first.unmount();
    sessionStorage.clear();
    renderEn(<Chat />);
    fireEvent.click(screen.getByRole('button', { name: 'Conversation history' }));
    fireEvent.click(screen.getByRole('button', { name: 'Where can I visit a workshop?' }));
    expect(screen.getByText('Open the village map.')).toBeTruthy();
  });

  it.each(['vi', 'en'] as const)(
    'archives, restores and deletes a conversation with %s controls',
    (locale) => {
      const t = messages[locale].assistant;
      const render = locale === 'vi' ? renderVi : renderEn;
      render(<Chat />);
      fireEvent.click(screen.getByRole('button', { name: t.newChat }));
      expect(screen.queryByText('Open the village map.')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: t.history }));
      const row = screen.getByRole('button', { name: 'Where can I visit a workshop?' });
      expect(screen.queryByRole('textbox')).toBeNull();
      fireEvent.click(row);
      expect(screen.getByText('Open the village map.')).toBeTruthy();
      expect(document.activeElement).toBe(screen.getByRole('textbox'));
      fireEvent.click(screen.getByRole('button', { name: t.history }));
      fireEvent.click(screen.getByRole('button', { name: t.deleteConversation }));
      expect(screen.getByText(t.historyEmpty)).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: t.backToChat }));
      expect(screen.getByText('Open the village map.')).toBeTruthy();
    },
  );
});
