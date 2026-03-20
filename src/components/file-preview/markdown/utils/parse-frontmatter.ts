import matter from 'gray-matter';

export interface FrontmatterData {
  title?: string;
  date?: string;
  tags?: string[];
  author?: string;
  description?: string;
  [key: string]: unknown;
}

export interface ParsedContent {
  frontmatter: FrontmatterData | null;
  body: string;
}

/**
 * Parse YAML frontmatter from markdown content
 */
export function parseFrontmatter(content: string): ParsedContent {
  try {
    const { data, content: body } = matter(content);
    return {
      frontmatter: data && Object.keys(data).length > 0 ? data : null,
      body,
    };
  } catch {
    return {
      frontmatter: null,
      body: content,
    };
  }
}
