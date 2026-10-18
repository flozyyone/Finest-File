export type ShortcutCategory =
  | "navigation"
  | "operations"
  | "selection"
  | "view"
  | "tabs"
  | "help";

export type CompatibilityStatus = "full" | "partial" | "custom";

export interface ShortcutDefinition {
  id: string;
  category: ShortcutCategory;
  keys: string[]; // e.g. ["Alt", "ArrowLeft"] or ["Ctrl", "c"]
  displayKeys: string; // e.g. "Alt + Left Arrow"
  description: string;
  explorerBehavior: string;
  finestFileSupport: CompatibilityStatus;
  differences?: string;
  preventInInput?: boolean; // True if shortcut should be ignored when typing in text fields
}

export interface ShortcutContext {
  activeTabPath: string;
  selectedPaths: string[];
  entriesCount: number;
  hasClipboard: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  canUndo: boolean;
  canRedo: boolean;
}
