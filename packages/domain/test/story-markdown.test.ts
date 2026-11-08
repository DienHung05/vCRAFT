import { describe, expect, it } from 'vitest';
import { parseStoryMarkdown, storyPlainText } from '../src/household';

describe('story markdown (FR-ART-01)', () => {
  it('renders a legacy plain-text story as the same paragraphs', () => {
    const blocks = parseStoryMarkdown('Đời thứ năm làm gốm.\n\nLò lửa vẫn đỏ.');
    expect(blocks).toEqual([
      { type: 'paragraph', children: [{ type: 'text', text: 'Đời thứ năm làm gốm.' }] },
      { type: 'paragraph', children: [{ type: 'text', text: 'Lò lửa vẫn đỏ.' }] },
    ]);
  });

  it('does not treat lone asterisks or arithmetic as formatting', () => {
    expect(storyPlainText('Giá 5*3*2 và 2 * 3')).toBe('Giá 5*3*2 và 2 * 3');
  });

  it('parses bold, italic and bulleted lists', () => {
    const [paragraph, list] = parseStoryMarkdown('Men **lam** và *rạn*\n\n- Bình\n- Đĩa');
    expect(paragraph).toEqual({
      type: 'paragraph',
      children: [
        { type: 'text', text: 'Men ' },
        { type: 'strong', children: [{ type: 'text', text: 'lam' }] },
        { type: 'text', text: ' và ' },
        { type: 'em', children: [{ type: 'text', text: 'rạn' }] },
      ],
    });
    expect(list).toMatchObject({ type: 'list' });
    expect(list?.type === 'list' && list.items.length).toBe(2);
  });

  it('keeps https and mailto links and leaves unsafe addresses as literal text', () => {
    const [ok] = parseStoryMarkdown('[Xem](https://example.com/a?b=1)');
    expect(ok).toEqual({
      type: 'paragraph',
      children: [
        {
          type: 'link',
          href: 'https://example.com/a?b=1',
          children: [{ type: 'text', text: 'Xem' }],
        },
      ],
    });
    expect(JSON.stringify(parseStoryMarkdown('[x](javascript:alert(1))'))).not.toContain('"link"');
    expect(storyPlainText('[x](javascript:alert(1))')).toBe('[x](javascript:alert(1))');
    expect(JSON.stringify(parseStoryMarkdown('[x](data:text/html;base64,AAAA)'))).not.toContain(
      '"link"',
    );
  });

  it('never produces an HTML node: tags in the text stay text', () => {
    const blocks = parseStoryMarkdown('<script>alert(1)</script> **x**');
    expect(JSON.stringify(blocks)).toContain('<script>alert(1)</script> ');
    expect(storyPlainText('<b>x</b>')).toBe('<b>x</b>');
  });

  it('strips markup for plain-text uses', () => {
    expect(storyPlainText('**Gốm** [Bát Tràng](https://a.vn)\n\n- một\n- hai')).toBe(
      'Gốm Bát Tràng\n\nmột\nhai',
    );
  });
});
