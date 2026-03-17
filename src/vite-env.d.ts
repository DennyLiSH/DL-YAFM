/// <reference types="vite/client" />

interface Window {
  __fileChangeUnlisten?: (() => void) | undefined;
  __refreshDebounceMap?: Map<string, ReturnType<typeof setTimeout>>;
}
