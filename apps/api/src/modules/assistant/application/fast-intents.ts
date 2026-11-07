import { foldVietnamese } from '@vcraft/utils';

/**
 * Messages answered without the model (PLAN E15 intent routing): greetings, thanks and goodbyes in
 * < 100 ms, with or without accents, teencode and emoji; date/time and weather go to a tool directly.
 */
export type FastIntent = 'greeting' | 'thanks' | 'bye' | 'datetime' | 'weather';

const WORDS = (text: string) =>
  foldVietnamese(text)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const GREETING =
  /^(xin )?(chao|hi|hello|hey|helo|alo|yo|chao ban|chao cao|hi cao|hello cao|cao oi|ad oi|shop oi|e oi|em oi|xin chao)( (ban|cao|ad|shop|em|anh|chi|nhe|nha|a|ah|oi|moi nguoi|ca nha))*$/;
const THANKS =
  /^(cam on|cam ơn|camon|cmon|tks|thanks?|thank you|thx|ty|cam on nhieu|cam on ban|cam on cao)( (ban|cao|nhieu|nhe|nha|a|ah|lam|nhe ban))*$/;
const BYE = /^(tam biet|bye|bai|bye bye|goodbye|see you|hen gap lai|pp)( (ban|cao|nhe|nha|a))*$/;
// Emoji, skin tones, joiners (U+200D) and variation selectors (U+FE0F) only. An alternation, not a class,
// so a joined emoji is not misread; built from escapes so no invisible character sits in the source.
// biome-ignore lint/complexity/useRegexLiterals: a literal would let the formatter write the joiner as a raw character.
const EMOJI_ONLY = new RegExp(
  '^(?:\\p{Extended_Pictographic}|\\p{Emoji_Modifier}|\\s|\\u200d|\\ufe0f)+$',
  'u',
);
const DATETIME =
  /\b(may gio|bay gio la|hom nay (la )?(ngay|thu)|ngay (bao nhieu|may)|thu may|am lich|ngay am|lich am|what time|what day|today s date|lunar date|date today)\b/;
const WEATHER =
  /\b(thoi tiet|nhiet do|troi (co )?mua|co mua khong|nang hay mua|weather|temperature|forecast)\b/;

export function fastIntent(message: string): FastIntent | null {
  if (EMOJI_ONLY.test(message.trim())) return 'greeting';
  const words = WORDS(message);
  if (!words) return null;
  if (GREETING.test(words)) return 'greeting';
  if (THANKS.test(words)) return 'thanks';
  if (BYE.test(words)) return 'bye';
  // Short questions only: a long message that mentions the weather is still a real question.
  if (words.length <= 80 && WEATHER.test(words)) return 'weather';
  if (words.length <= 80 && DATETIME.test(words)) return 'datetime';
  return null;
}

const REPLIES: Record<'greeting' | 'thanks' | 'bye', Record<'vi' | 'en', string>> = {
  greeting: {
    vi: 'Chào bạn, tớ là Cáo! Bạn muốn tìm gốm Bát Tràng, đặt hàng số lượng lớn hay truy xuất một món đồ?',
    en: "Hi, I'm Fox! Looking for Bát Tràng pottery, a bulk order, or the story behind a piece?",
  },
  thanks: {
    vi: 'Không có gì đâu! Cần gì thêm cứ hỏi tớ nhé.',
    en: "You're welcome! Ask me anything else any time.",
  },
  bye: {
    vi: 'Tạm biệt bạn, hẹn gặp lại ở làng gốm!',
    en: 'Bye for now, see you in the pottery village!',
  },
};

export function cannedReply(intent: 'greeting' | 'thanks' | 'bye', locale: 'vi' | 'en'): string {
  return REPLIES[intent][locale];
}

/** The place asked about in a weather question, or null for the default (Bát Tràng). */
export function weatherPlace(message: string): string | null {
  const words = WORDS(message);
  const match =
    /(?:thoi tiet|nhiet do|weather|temperature|forecast)(?: (?:o|tai|in|at|for))? ([a-z ]+?)(?: (?:hom nay|ngay mai|bay gio|the nao|ra sao|today|tomorrow|now|nhu the nao))?$/.exec(
      words,
    );
  const place = match?.[1]?.trim();
  if (!place || /^(hom nay|ngay mai|bay gio|today|tomorrow|now|the nao|ra sao)$/.test(place))
    return null;
  return place;
}
