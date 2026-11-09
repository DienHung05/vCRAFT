import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StoryText } from '@/features/exhibition/story-text';
import {
  insertLink,
  isAllowedLinkUrl,
  toggleBullets,
  toggleWrap,
} from '@/features/studio/story-format';

describe('StoryText on the public page (FR-ART-01)', () => {
  it('renders a legacy plain-text story as the same paragraphs', () => {
    const { container } = render(<StoryText source={'Đời thứ năm.\n\nLò vẫn đỏ lửa.'} />);
    const paragraphs = [...container.querySelectorAll('p')].map((p) => p.textContent);
    expect(paragraphs).toEqual(['Đời thứ năm.', 'Lò vẫn đỏ lửa.']);
    expect(container.querySelector('strong, em, a, ul')).toBeNull();
  });

  it('renders bold, italic, lists and links with rel noopener nofollow', () => {
    const { container } = render(
      <StoryText source={'Men **lam** và *rạn* [xem](https://example.com)\n\n- Bình\n- Đĩa'} />,
    );
    expect(container.querySelector('strong')?.textContent).toBe('lam');
    expect(container.querySelector('em')?.textContent).toBe('rạn');
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://example.com');
    expect(link?.getAttribute('rel')).toBe('noopener nofollow');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect([...container.querySelectorAll('li')].map((li) => li.textContent)).toEqual([
      'Bình',
      'Đĩa',
    ]);
  });

  it('does not inject HTML or javascript links', () => {
    const { container } = render(
      <StoryText source={'<img src=x onerror=alert(1)> [x](javascript:alert(1))'} />,
    );
    expect(container.querySelector('img, script, a')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});

describe('story toolbar edits', () => {
  it('toggles bold and italic around a selection and back', () => {
    const bold = toggleWrap('Men lam', 0, 3, '**', 'đậm');
    expect(bold).toEqual({ value: '**Men** lam', start: 2, end: 5 });
    expect(toggleWrap(bold.value, bold.start, bold.end, '**', 'đậm').value).toBe('Men lam');
    expect(toggleWrap('', 0, 0, '*', 'nghiêng')).toEqual({ value: '*nghiêng*', start: 1, end: 8 });
  });

  it('does not unwrap italic out of a bold selection', () => {
    expect(toggleWrap('**Men**', 2, 5, '*', 'x').value).toBe('***Men***');
  });

  it('bullets every touched line and removes them when all are bullets', () => {
    const edit = toggleBullets('a\nb\nc', 0, 3);
    expect(edit.value).toBe('- a\n- b\nc');
    expect(toggleBullets(edit.value, 0, edit.end).value).toBe('a\nb\nc');
  });

  it('inserts a link and accepts only safe schemes', () => {
    expect(insertLink('Xem trang', 4, 9, 'https://a.vn', 'chữ').value).toBe(
      'Xem [trang](https://a.vn)',
    );
    expect(isAllowedLinkUrl('https://a.vn/x?y=1')).toBe(true);
    expect(isAllowedLinkUrl('mailto:a@b.vn')).toBe(true);
    expect(isAllowedLinkUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedLinkUrl('data:text/html,x')).toBe(false);
  });
});
