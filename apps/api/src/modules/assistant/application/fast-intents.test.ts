import { describe, expect, it } from 'vitest';
import { cannedReply, fastIntent, weatherPlace } from './fast-intents';

describe('fastIntent', () => {
  it.each([
    'Chào Cáo',
    'chao cao',
    'CHÀO BẠN!',
    'hi',
    'Hello cáo ơi',
    'alo ad ơi',
    'xin chào mọi người',
    '👋',
    '👋😊',
  ])('greets %j without the model', (text) => {
    expect(fastIntent(text)).toBe('greeting');
  });

  it.each(['Cảm ơn', 'cam on ban nhieu', 'tks', 'thanks!', 'camon cáo nha'])(
    'thanks %j',
    (text) => {
      expect(fastIntent(text)).toBe('thanks');
    },
  );

  it.each(['Tạm biệt', 'bye bye', 'pp', 'hẹn gặp lại nhé'])('says bye to %j', (text) => {
    expect(fastIntent(text)).toBe('bye');
  });

  it.each(['Bây giờ là mấy giờ?', 'hôm nay là ngày bao nhiêu âm lịch', 'What day is it today?'])(
    'answers %j with the date tool',
    (text) => {
      expect(fastIntent(text)).toBe('datetime');
    },
  );

  it.each(['Thời tiết Bát Tràng hôm nay?', 'troi co mua khong', "what's the weather"])(
    'answers %j with the weather tool',
    (text) => {
      expect(fastIntent(text)).toBe('weather');
    },
  );

  it.each([
    'Chào bạn, tôi muốn đặt 200 bộ ấm chén làm quà tặng',
    'Làm sao đăng ký hộ sản xuất?',
    'Nung gốm men rạn mất bao lâu và thời tiết nồm có ảnh hưởng tới men không, mình đang muốn mua số lượng lớn',
  ])('leaves a real question %j to the model', (text) => {
    expect(fastIntent(text)).toBeNull();
  });
});

describe('weatherPlace', () => {
  it('reads the place after the question, or null for the default', () => {
    expect(weatherPlace('Thời tiết ở Hà Nội hôm nay')).toBe('ha noi');
    expect(weatherPlace('thời tiết hôm nay')).toBeNull();
    // The default village is null so the reply prints BAT_TRANG.name, not the geocoder's spelling (GH#233).
    expect(weatherPlace('Thời tiết Bát Tràng hôm nay?')).toBeNull();
    expect(weatherPlace('weather in Bát Tràng today')).toBeNull();
    expect(weatherPlace('weather in Da Nang')).toBe('da nang');
  });
});

describe('cannedReply', () => {
  it('speaks the visitor locale', () => {
    expect(cannedReply('greeting', 'vi')).toContain('Cáo');
    expect(cannedReply('bye', 'en')).toMatch(/bye/i);
  });
});
