declare module 'tinykeys' {
  export type KeyBindingHandler = (event: KeyboardEvent) => void;

  export interface KeyBindingOptions {
    timeout?: number;
  }

  export function createKeybindingsHandler(
    bindings: Record<string, KeyBindingHandler>,
    options?: KeyBindingOptions
  ): KeyBindingHandler;
}
