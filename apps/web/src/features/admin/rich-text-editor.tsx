'use client';

import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Button } from '@vcraft/ui';
import { useTranslations } from 'next-intl';

/** Block editor for news bodies. Its HTML is sanitized again by the API before it is stored. */
export function RichTextEditor({
  value,
  label,
  invalid,
  onChange,
}: {
  value: string;
  label: string;
  invalid?: boolean;
  onChange: (html: string, isEmpty: boolean) => void;
}) {
  const t = useTranslations('admin.news.editor');
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, protocols: ['http', 'https', 'mailto'] },
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        'aria-label': label,
        role: 'textbox',
        'aria-multiline': 'true',
        ...(invalid ? { 'aria-invalid': 'true' } : {}),
        class:
          'min-h-64 rounded-input border border-ink/20 bg-surface p-3 focus:outline-2 focus:outline-clay [&_a]:text-clay [&_a]:underline [&_blockquote]:border-clay/40 [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_h2]:text-h2 [&_h3]:text-h3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-6',
      },
    },
    onUpdate: ({ editor: current }) => onChange(current.getHTML(), current.isEmpty),
  });

  const tool = (name: string, active: boolean, run: () => void) => (
    <Button
      key={name}
      type="button"
      size="sm"
      variant={active ? 'primary' : 'secondary'}
      aria-pressed={active}
      disabled={!editor}
      onClick={run}
    >
      {t(name as 'bold')}
    </Button>
  );

  const link = () => {
    if (!editor) return;
    const url = window.prompt(t('linkPrompt'), editor.getAttributes('link').href ?? 'https://');
    if (url === null) return;
    if (url.trim() === '') editor.chain().focus().unsetLink().run();
    else editor.chain().focus().setLink({ href: url.trim() }).run();
  };

  return (
    <div className="flex flex-col gap-2">
      <div role="toolbar" aria-label={t('toolbar')} className="flex flex-wrap gap-1">
        {tool('bold', Boolean(editor?.isActive('bold')), () =>
          editor?.chain().focus().toggleBold().run(),
        )}
        {tool('italic', Boolean(editor?.isActive('italic')), () =>
          editor?.chain().focus().toggleItalic().run(),
        )}
        {tool('heading2', Boolean(editor?.isActive('heading', { level: 2 })), () =>
          editor?.chain().focus().toggleHeading({ level: 2 }).run(),
        )}
        {tool('heading3', Boolean(editor?.isActive('heading', { level: 3 })), () =>
          editor?.chain().focus().toggleHeading({ level: 3 }).run(),
        )}
        {tool('bullet', Boolean(editor?.isActive('bulletList')), () =>
          editor?.chain().focus().toggleBulletList().run(),
        )}
        {tool('ordered', Boolean(editor?.isActive('orderedList')), () =>
          editor?.chain().focus().toggleOrderedList().run(),
        )}
        {tool('quote', Boolean(editor?.isActive('blockquote')), () =>
          editor?.chain().focus().toggleBlockquote().run(),
        )}
        {tool('link', Boolean(editor?.isActive('link')), link)}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
