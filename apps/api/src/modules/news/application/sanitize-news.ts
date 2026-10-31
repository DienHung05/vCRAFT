import sanitizeHtml from 'sanitize-html';

/** The only markup a news body may contain. Everything else is removed before it is stored. */
const NEWS_HTML: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'h2',
    'h3',
    'strong',
    'em',
    's',
    'code',
    'pre',
    'blockquote',
    'ul',
    'ol',
    'li',
    'hr',
    'a',
  ],
  allowedAttributes: { a: ['href', 'rel', 'target'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow', target: '_blank' }),
  },
};

export const sanitizeNewsHtml = (html: string): string => sanitizeHtml(html, NEWS_HTML).trim();

/** Plain text of a sanitized body, for `body`. Block ends become spaces so words don't join. */
export const newsTextOf = (html: string): string =>
  sanitizeHtml(html.replace(/<\/(p|h2|h3|li|blockquote|pre)>|<br\s*\/?>/gi, '$& '), {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Opens plain-text items written before the editor existed. */
export const paragraphsOf = (body: string): string =>
  body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('');
