import { parseStoryMarkdown, type StoryInline } from '@vcraft/domain';
import type { ReactNode } from 'react';

function Inline({ nodes }: { nodes: readonly StoryInline[] }): ReactNode {
  return nodes.map((node, index) => {
    const key = index;
    if (node.type === 'text') return node.text;
    if (node.type === 'strong') {
      return (
        <strong key={key}>
          <Inline nodes={node.children} />
        </strong>
      );
    }
    if (node.type === 'em') {
      return (
        <em key={key}>
          <Inline nodes={node.children} />
        </em>
      );
    }
    return (
      <a
        key={key}
        href={node.href}
        target="_blank"
        rel="noopener nofollow"
        className="text-clay underline underline-offset-2"
      >
        <Inline nodes={node.children} />
      </a>
    );
  });
}

/**
 * A household story (FR-ART-01): a restricted Markdown subset rendered as React elements, never as raw
 * HTML, so nothing typed into the story can inject markup. Links open in a new tab with
 * `rel="noopener nofollow"`. A legacy plain-text story renders as the same paragraphs as before.
 */
export function StoryText({ source }: { source: string }) {
  return parseStoryMarkdown(source).map((block, index) =>
    block.type === 'list' ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: parsed blocks have no id and never reorder.
      <ul key={index} className="mt-4 max-w-prose-vn list-disc space-y-1 pl-6">
        {block.items.map((item, itemIndex) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: list items have no id and never reorder.
          <li key={itemIndex}>
            <Inline nodes={item} />
          </li>
        ))}
      </ul>
    ) : (
      // biome-ignore lint/suspicious/noArrayIndexKey: parsed blocks have no id and never reorder.
      <p key={index} className="mt-4 max-w-prose-vn">
        <Inline nodes={block.children} />
      </p>
    ),
  );
}
