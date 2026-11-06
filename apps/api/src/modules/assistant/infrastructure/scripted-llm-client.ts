import { foldVietnamese } from '@vcraft/utils';
import type {
  AssistantIntent,
  ChatMessage,
  Classification,
  LlmChunk,
  LlmClient,
} from './llm-client';

/**
 * A deterministic stand-in for the chat model (`ASSISTANT_LLM=scripted`): keyword classification and
 * canned, link-bearing answers, with no network and no key. The CI end-to-end run and offline demos use
 * it so the widget can be exercised for real; it is never a substitute for the OpenAI classifier in
 * production, where real attacks are judged by the model (GH#82).
 */
const RULES: [AssistantIntent, RegExp][] = [
  [
    'injection',
    /(ignore|bo qua|quen het).{0,40}(instruction|huong dan|chi dan|quy tac)|system prompt|prompt (he thong|goc)|developer mode|jailbreak|\bdan\b|secret marker/,
  ],
  ['private_data', /\b(cccd|can cuoc|so dien thoai|phone number|mat khau|password|email address)/],
  ['abuse', /\b(ngu|scam|lua dao|hateful|insult)\b/],
  ['open_workshops', /(xuong|workshop).{0,30}(mo cua|open)/],
  // Ordering questions go to site help (the quote request page) even when they name a product.
  ['site_help', /\b(dat|order|bulk|bao gia|quote|so luong)\b/],
  ['catalog', /\b(binh|bat|dia|am chen|lo hoa|coc|vase|bowl|gift|qua tang)\b/],
  ['out_of_scope', /\b(co phieu|stock|bitcoin|benh|thuoc|medicine|lawyer|luat su)\b/],
];

const ANSWERS: Record<'vi' | 'en', Partial<Record<AssistantIntent, string>> & { default: string }> =
  {
    vi: {
      site_help:
        'Bạn mở trang [Gửi yêu cầu báo giá](/vi/yeu-cau-bao-gia/moi), ghi số lượng và hạn giao. Các hộ trong làng sẽ chào giá cho bạn.',
      catalog: 'Bạn xem các mẫu trong [danh mục sản phẩm](/vi/san-pham) nhé.',
      open_workshops: 'Bạn xem giờ mở cửa của từng xưởng trên [bản đồ làng](/vi/ban-do).',
      chitchat: 'Tớ là Cáo, trợ lý của vCraft. Tớ mê gốm men lam lắm!',
      default:
        'Bạn có thể bắt đầu từ [Gửi yêu cầu báo giá](/vi/yeu-cau-bao-gia/moi) hoặc [danh mục sản phẩm](/vi/san-pham).',
    },
    en: {
      site_help:
        'Open [Send a quote request](/en/quotes/new) and give the quantity and deadline. Households in the village will send you offers.',
      catalog: 'Have a look at the [product catalogue](/en/products).',
      open_workshops: 'Opening hours for each workshop are on the [village map](/en/map).',
      chitchat: "I'm the Fox, vCraft's assistant. I love blue-glaze pottery!",
      default:
        'You can start from [Send a quote request](/en/quotes/new) or the [product catalogue](/en/products).',
    },
  };

const lastUser = (messages: readonly ChatMessage[]) =>
  [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';

export function scriptedIntent(message: string): AssistantIntent {
  const folded = foldVietnamese(message);
  return RULES.find(([, pattern]) => pattern.test(folded))?.[0] ?? 'site_help';
}

export class ScriptedLlmClient implements LlmClient {
  async classify(messages: readonly ChatMessage[]): Promise<Classification & { tokens: number }> {
    return { intent: scriptedIntent(lastUser(messages)), query: '', tokens: 0 };
  }

  async *stream(messages: readonly ChatMessage[]): AsyncIterable<LlmChunk> {
    const system = messages[0]?.content ?? '';
    const locale = system.includes('Answer in English') ? 'en' : 'vi';
    const intent = scriptedIntent(lastUser(messages));
    const text = ANSWERS[locale][intent] ?? ANSWERS[locale].default;
    // Two chunks with a sentence end between them, like a real stream.
    const cut = text.indexOf('. ') + 2 || text.length;
    yield { type: 'text', text: text.slice(0, cut) };
    if (cut < text.length) yield { type: 'text', text: text.slice(cut) };
    yield { type: 'usage', tokens: 0 };
  }
}
