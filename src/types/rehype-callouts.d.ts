declare module 'rehype-callouts' {
  import type { Plugin } from 'unified';
  import type { Root } from 'hast';

  interface RehypeCalloutsOptions {
    /** Custom callout type aliases */
    aliases?: Record<string, string>;
    /** Theme for callout styling */
    theme?: 'github' | 'obsidian' | 'vitepress';
  }

  const rehypeCallouts: Plugin<[RehypeCalloutsOptions?], Root, Root>;
  export default rehypeCallouts;
}
