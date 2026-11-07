import { fireEvent, screen } from '@testing-library/react';
import { messages } from '@vcraft/i18n';
import { describe, expect, it, vi } from 'vitest';
import { AssistantPanel, type AssistantPanelProps } from '@/features/assistant/assistant-panel';
import {
  type ChatMessage,
  createSseParser,
  freshThoughts,
  historyOf,
  loadConversation,
  pageKind,
  secondsLeft,
} from '@/features/assistant/conversation';
import { renderEn, renderVi } from './render';

const data = (event: object) => `data: ${JSON.stringify(event)}\n\n`;

describe('createSseParser', () => {
  it('reads events split across chunks and skips broken ones', () => {
    const parse = createSseParser();
    const stream = `${data({ type: 'thinking' })}data: {broken\n\n${data({ type: 'delta', text: 'Chào' })}`;
    const first = parse(stream.slice(0, 30));
    const rest = parse(stream.slice(30));
    expect([...first, ...rest]).toEqual([{ type: 'thinking' }, { type: 'delta', text: 'Chào' }]);
  });

  it('ignores events outside the contract', () => {
    expect(createSseParser()(data({ type: 'shell', cmd: 'rm' }))).toEqual([]);
  });
});

describe('conversation helpers', () => {
  const msg = (over: Partial<ChatMessage>): ChatMessage => ({
    id: crypto.randomUUID(),
    role: 'assistant',
    text: 'x',
    status: 'done',
    ...over,
  });

  it('sends only finished turns as history, at most twenty', () => {
    const list = [
      ...Array.from({ length: 22 }, (_, i) => msg({ role: 'user', text: `q${i}` })),
      msg({ status: 'blocked', text: '' }),
      msg({ status: 'error', text: 'half' }),
    ];
    const history = historyOf(list);
    expect(history).toHaveLength(20);
    expect(history.at(-1)).toEqual({ role: 'user', content: 'q21' });
  });

  it('restores a stored conversation and marks a cut-off answer as stopped', () => {
    const stored = {
      id: 'c1',
      messages: [msg({ status: 'streaming', text: 'Đang' })],
      seenThoughts: [3],
    };
    const conversation = loadConversation({ getItem: () => JSON.stringify(stored) });
    expect(conversation.messages[0]?.status).toBe('stopped');
    expect(conversation.seenThoughts).toEqual([3]);
    expect(loadConversation({ getItem: () => '{oops' }).messages).toEqual([]);
    expect(
      loadConversation({
        getItem: () => {
          throw new Error('blocked');
        },
      }).id,
    ).toMatch(/[0-9a-f-]{36}/);
  });

  it.each([
    ['/vi', 'home'],
    ['/en', 'home'],
    ['/vi/san-pham/binh-hut-loc', 'catalog'],
    ['/en/products', 'catalog'],
    ['/vi/ban-do', 'map'],
    ['/en/trace/ABC123', 'trace'],
    ['/vi/yeu-cau-bao-gia/moi', 'quote'],
    ['/vi/tin-tuc', 'other'],
  ] as const)('reads %s as the %s page', (path, kind) => {
    expect(pageKind(path)).toBe(kind);
  });

  it('never repeats a thought line until all have been shown', () => {
    const first = freshThoughts(5, [], 3, () => 0.5);
    const second = freshThoughts(5, first, 3, () => 0.5);
    expect(new Set([...first, ...second]).size).toBe(5);
    expect(second).toHaveLength(2);
    expect(freshThoughts(5, [0, 1, 2, 3, 4], 3)).toHaveLength(3);
  });

  it('counts down whole seconds', () => {
    expect(secondsLeft(10_500, 9_000)).toBe(2);
    expect(secondsLeft(5_000, 9_000)).toBe(0);
    expect(secondsLeft(undefined, 9_000)).toBe(0);
  });
});

describe('assistant copy', () => {
  it('has thirty short thought lines in each language and the same keys', () => {
    for (const locale of ['vi', 'en'] as const) {
      const thoughts = messages[locale].assistant.thoughts;
      expect(thoughts).toHaveLength(30);
      expect(new Set(thoughts).size).toBe(30);
      for (const line of thoughts) expect(line.length).toBeLessThanOrEqual(60);
    }
    expect(Object.keys(messages.en.assistant).sort()).toEqual(
      Object.keys(messages.vi.assistant).sort(),
    );
  });
});

function panel(over: Partial<AssistantPanelProps> = {}) {
  const props: AssistantPanelProps = {
    archive: [],
    onHistory: vi.fn(),
    onRestore: vi.fn(),
    onDelete: vi.fn(),
    messages: [],
    busy: false,
    page: 'home',
    onSend: vi.fn(),
    onStop: vi.fn(),
    onRetry: vi.fn(),
    onReset: vi.fn(),
    onRate: vi.fn(),
    onClose: vi.fn(),
    mascot: null,
    ...over,
  };
  return props;
}

describe('AssistantPanel', () => {
  it('sends on Enter, keeps Shift+Enter for a new line, and offers quick questions per page', () => {
    const props = panel({ page: 'catalog' });
    renderVi(<AssistantPanel {...props} />);
    const input = screen.getByLabelText('Câu hỏi cho Cáo');
    fireEvent.change(input, { target: { value: 'Có bình hút lộc không?' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(props.onSend).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onSend).toHaveBeenCalledWith('Có bình hút lộc không?');
    fireEvent.click(screen.getByRole('button', { name: 'Gợi ý quà tặng gốm' }));
    expect(props.onSend).toHaveBeenCalledWith('Gợi ý quà tặng gốm');
  });

  it('renders internal links and citation cards, but never external links', () => {
    renderVi(
      <AssistantPanel
        {...panel({
          messages: [
            {
              id: 'a',
              role: 'assistant',
              status: 'done',
              messageId: '00000000-0000-7000-8000-000000000001',
              text: 'Xem [bình](/vi/san-pham/binh) hoặc [lạ](https://evil.test)',
              citations: [{ title: 'Bình hút lộc', url: '/vi/san-pham/binh', type: 'PRODUCT' }],
            },
          ],
        })}
      />,
    );
    expect(screen.getByRole('link', { name: 'bình' }).getAttribute('href')).toBe(
      '/vi/san-pham/binh',
    );
    expect(screen.queryByRole('link', { name: 'lạ' })).toBeNull();
    expect(screen.getByRole('link', { name: /Sản phẩm\s*Bình hút lộc/ })).toBeTruthy();
    expect(
      screen.getByRole('list', { name: 'Cuộc trò chuyện với Cáo' }).getAttribute('aria-live'),
    ).toBe('polite');
  });

  it('takes thumbs up once, and offers retry after an error', () => {
    const done: ChatMessage = {
      id: 'a',
      role: 'assistant',
      status: 'done',
      text: 'OK',
      messageId: '00000000-0000-7000-8000-000000000001',
    };
    const props = panel({ messages: [done] });
    const { unmount } = renderVi(<AssistantPanel {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Câu trả lời hữu ích' }));
    expect(props.onRate).toHaveBeenCalledWith(done, 'UP');
    unmount();
    const failed = { ...done, status: 'error' as const, text: '' };
    renderVi(<AssistantPanel {...props} messages={[failed]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(props.onRetry).toHaveBeenCalled();
  });

  it('shows a countdown and locks the input while rate limited', () => {
    renderEn(
      <AssistantPanel
        {...panel({
          messages: [
            {
              id: 'b',
              role: 'assistant',
              status: 'blocked',
              text: '',
              blockReason: 'RATE_LIMITED',
              retryAt: Date.now() + 30_000,
            },
          ],
        })}
      />,
    );
    expect(screen.getByText(/Ask again in 30 s/)).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Conversation history' }),
    );
    expect(
      (screen.getByLabelText('Your question for the Fox') as HTMLTextAreaElement).disabled,
    ).toBe(true);
  });

  it('lets the visitor stop a streaming answer', () => {
    const props = panel({ busy: true });
    renderVi(<AssistantPanel {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dừng trả lời' }));
    expect(props.onStop).toHaveBeenCalled();
  });
});
