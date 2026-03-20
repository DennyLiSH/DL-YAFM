import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkFrontmatter from 'remark-frontmatter';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeCallouts from 'rehype-callouts';
import type { Components } from 'react-markdown';

import {
  FrontmatterDisplay,
  MermaidBlock,
  parseFrontmatter,
  rehypeHighlightMark,
} from './markdown';

import 'highlight.js/styles/github-dark.css';
import 'katex/dist/katex.min.css';
import './markdown/styles/callouts.css';

interface MarkdownPreviewProps {
  content: string;
}

// Custom code block renderer for Mermaid support
function CodeBlock({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & { node?: unknown }) {
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const codeContent = String(children).replace(/\n$/, '');

  // Handle Mermaid diagrams
  if (language === 'mermaid') {
    return <MermaidBlock code={codeContent} />;
  }

  // Default code block rendering
  return (
    <code className={className} {...props}>
      {children}
    </code>
  );
}

// Custom components for ReactMarkdown
const components: Components = {
  code: CodeBlock as Components['code'],
};

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  // Parse frontmatter from content
  const { frontmatter, body } = parseFrontmatter(content);

  return (
    <div className="h-full overflow-auto p-4">
      {/* Frontmatter metadata display */}
      {frontmatter && <FrontmatterDisplay data={frontmatter} />}

      {/* Markdown content */}
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown
          remarkPlugins={[
            remarkGfm,
            remarkMath,
            [remarkFrontmatter, { type: 'yaml', marker: '-' }],
          ]}
          rehypePlugins={[
            rehypeKatex,
            rehypeHighlight,
            rehypeCallouts,
            rehypeHighlightMark,
          ]}
          components={components}
        >
          {body}
        </ReactMarkdown>
      </div>
    </div>
  );
}
