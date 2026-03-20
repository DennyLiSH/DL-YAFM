import { visit } from 'unist-util-visit';
import type { Root, Text, Parent, Element, Properties } from 'hast';

/**
 * Rehype plugin to convert ==highlight== syntax to <mark> elements
 * This handles the HTML text nodes after markdown parsing
 */
export function rehypeHighlightMark() {
  return (tree: Root) => {
    visit(tree, 'text', (node: Text, index: number | undefined, parent: Parent | undefined) => {
      if (index === undefined || !parent) return;

      const value = node.value;
      // Match ==text== pattern (not across newlines)
      const regex = /==([^=\n]+)==/g;
      const matches = [...value.matchAll(regex)];

      if (matches.length === 0) return;

      const newNodes: Array<Text | Element> = [];
      let lastIndex = 0;

      for (const match of matches) {
        const [fullMatch, highlightText] = match;
        if (!highlightText) continue;

        const matchIndex = match.index!;

        // Text before the match
        if (matchIndex > lastIndex) {
          newNodes.push({
            type: 'text',
            value: value.slice(lastIndex, matchIndex),
          });
        }

        // The highlighted text wrapped in <mark>
        newNodes.push({
          type: 'element',
          tagName: 'mark',
          properties: {} as Properties,
          children: [{ type: 'text', value: highlightText }],
        });

        lastIndex = matchIndex + fullMatch.length;
      }

      // Remaining text after all matches
      if (lastIndex < value.length) {
        newNodes.push({
          type: 'text',
          value: value.slice(lastIndex),
        });
      }

      // Replace the original text node with new nodes
      parent.children.splice(index, 1, ...newNodes);
    });
  };
}
