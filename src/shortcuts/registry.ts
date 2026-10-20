import type { ShortcutDefinition } from "./types";

export const SHORTCUT_REGISTRY: ShortcutDefinition[] = [
  // --- Navigation & Windows ---
  {
    id: "nav.back",
    category: "navigation",
    keys: ["Alt", "ArrowLeft"],
    displayKeys: "Alt + Left Arrow",
    description: "Navigate back in folder history",
    explorerBehavior: "Navigates to the previous location in history",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "nav.forward",
    category: "navigation",
    keys: ["Alt", "ArrowRight"],
    displayKeys: "Alt + Right Arrow",
    description: "Navigate forward in folder history",
    explorerBehavior: "Navigates to the next location in history",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "nav.up",
    category: "navigation",
    keys: ["Alt", "ArrowUp"],
    displayKeys: "Alt + Up Arrow",
    description: "Navigate to the parent folder",
    explorerBehavior: "Opens the parent directory containing the current folder",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "nav.backspace",
    category: "navigation",
    keys: ["Backspace"],
    displayKeys: "Backspace",
    description: "Go to parent folder / previous folder",
    explorerBehavior: "Opens the parent directory in legacy Explorer, or goes back",
    finestFileSupport: "full",
    differences: "Navigates to parent folder when list is focused",
    preventInInput: true,
  },
  {
    id: "nav.focus_address",
    category: "navigation",
    keys: ["Alt", "d"],
    displayKeys: "Alt + D",
    description: "Focus and select the address bar",
    explorerBehavior: "Selects the text in the address bar for typing a path",
    finestFileSupport: "full",
    preventInInput: false,
  },
  {
    id: "nav.focus_address_ctrl_l",
    category: "navigation",
    keys: ["Ctrl", "l"],
    displayKeys: "Ctrl + L",
    description: "Focus and select the address bar",
    explorerBehavior: "Alternate standard shortcut to focus address bar",
    finestFileSupport: "full",
    preventInInput: false,
  },
  {
    id: "nav.focus_address_f4",
    category: "navigation",
    keys: ["F4"],
    displayKeys: "F4",
    description: "Focus the address bar",
    explorerBehavior: "Opens the address bar history dropdown list",
    finestFileSupport: "full",
    preventInInput: false,
  },
  {
    id: "nav.focus_search",
    category: "navigation",
    keys: ["Ctrl", "e"],
    displayKeys: "Ctrl + E",
    description: "Focus the search box",
    explorerBehavior: "Focuses the search field in the top-right",
    finestFileSupport: "full",
    preventInInput: false,
  },
  {
    id: "nav.focus_search_f",
    category: "navigation",
    keys: ["Ctrl", "f"],
    displayKeys: "Ctrl + F",
    description: "Focus the search box",
    explorerBehavior: "Alternate standard shortcut to focus search field",
    finestFileSupport: "full",
    preventInInput: false,
  },
  {
    id: "nav.focus_search_f3",
    category: "navigation",
    keys: ["F3"],
    displayKeys: "F3",
    description: "Focus the search box",
    explorerBehavior: "Explorer shortcut to activate search field",
    finestFileSupport: "full",
    preventInInput: false,
  },
  {
    id: "nav.refresh",
    category: "navigation",
    keys: ["F5"],
    displayKeys: "F5",
    description: "Refresh the current folder listing",
    explorerBehavior: "Re-reads the directory contents from the filesystem",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "nav.refresh_ctrl_r",
    category: "navigation",
    keys: ["Ctrl", "r"],
    displayKeys: "Ctrl + R",
    description: "Refresh the current folder listing",
    explorerBehavior: "Web-browser and modern Explorer compatibility refresh",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "nav.properties",
    category: "navigation",
    keys: ["Alt", "Enter"],
    displayKeys: "Alt + Enter",
    description: "Open properties for selected item(s)",
    explorerBehavior: "Displays native Windows file/folder Properties dialog",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "nav.escape",
    category: "navigation",
    keys: ["Escape"],
    displayKeys: "Esc",
    description: "Cancel operation, close menu, or clear search",
    explorerBehavior: "Dismisses dialogs, menus, or active selections",
    finestFileSupport: "full",
    preventInInput: false,
  },

  // --- File & Folder Operations ---
  {
    id: "ops.copy",
    category: "operations",
    keys: ["Ctrl", "c"],
    displayKeys: "Ctrl + C",
    description: "Copy selected items to clipboard",
    explorerBehavior: "Copies paths to clipboard for pasting into Explorer or other apps",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "ops.cut",
    category: "operations",
    keys: ["Ctrl", "x"],
    displayKeys: "Ctrl + X",
    description: "Cut selected items for moving",
    explorerBehavior: "Marks items for moving on subsequent paste",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "ops.paste",
    category: "operations",
    keys: ["Ctrl", "v"],
    displayKeys: "Ctrl + V",
    description: "Paste files/folders into current folder",
    explorerBehavior: "Transfers copied/cut files with conflict resolution",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "ops.undo",
    category: "operations",
    keys: ["Ctrl", "z"],
    displayKeys: "Ctrl + Z",
    description: "Undo last file operation (rename, move, trash)",
    explorerBehavior: "Reverses the previous file system operation",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "ops.redo",
    category: "operations",
    keys: ["Ctrl", "y"],
    displayKeys: "Ctrl + Y",
    description: "Redo last undone file operation",
    explorerBehavior: "Re-applies the operation that was just undone",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "ops.rename",
    category: "operations",
    keys: ["F2"],
    displayKeys: "F2",
    description: "Rename selected item inline",
    explorerBehavior: "Highlights file base name (excluding extension) for editing",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "ops.delete_recycle",
    category: "operations",
    keys: ["Delete"],
    displayKeys: "Delete",
    description: "Move selected items to Recycle Bin",
    explorerBehavior: "Safely sends items to Windows Recycle Bin",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "ops.delete_permanent",
    category: "operations",
    keys: ["Shift", "Delete"],
    displayKeys: "Shift + Delete",
    description: "Permanently delete selected items",
    explorerBehavior: "Bypasses Recycle Bin and prompts for confirmation",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "ops.new_folder",
    category: "operations",
    keys: ["Ctrl", "Shift", "N"],
    displayKeys: "Ctrl + Shift + N",
    description: "Create a new folder",
    explorerBehavior: "Creates 'New folder' and starts inline renaming",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "ops.select_all",
    category: "operations",
    keys: ["Ctrl", "a"],
    displayKeys: "Ctrl + A",
    description: "Select all items in folder",
    explorerBehavior: "Selects every visible file and folder in the list",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "ops.copy_path",
    category: "operations",
    keys: ["Ctrl", "Shift", "C"],
    displayKeys: "Ctrl + Shift + C",
    description: "Copy selected file's full path to clipboard",
    explorerBehavior: "Copies the absolute filesystem path(s) to clipboard as text",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "ops.context_menu_f10",
    category: "operations",
    keys: ["Shift", "F10"],
    displayKeys: "Shift + F10",
    description: "Open context menu for selected item",
    explorerBehavior: "Opens context menu at the focused item position",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "ops.context_menu_key",
    category: "operations",
    keys: ["ContextMenu"],
    displayKeys: "Menu Key",
    description: "Open context menu for selected item",
    explorerBehavior: "Opens context menu at the focused item position",
    finestFileSupport: "full",
    preventInInput: true,
  },

  // --- Selection & Navigation ---
  {
    id: "select.open",
    category: "selection",
    keys: ["Enter"],
    displayKeys: "Enter",
    description: "Open selected folder or file",
    explorerBehavior: "Navigates into folder or executes default handler for file",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "select.up",
    category: "selection",
    keys: ["ArrowUp"],
    displayKeys: "Up Arrow",
    description: "Select item above",
    explorerBehavior: "Moves selection to previous item in the view",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "select.down",
    category: "selection",
    keys: ["ArrowDown"],
    displayKeys: "Down Arrow",
    description: "Select item below",
    explorerBehavior: "Moves selection to next item in the view",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "select.left",
    category: "selection",
    keys: ["ArrowLeft"],
    displayKeys: "Left Arrow",
    description: "Select item to the left (Grid view)",
    explorerBehavior: "Moves selection to the preceding column in grid mode",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "select.right",
    category: "selection",
    keys: ["ArrowRight"],
    displayKeys: "Right Arrow",
    description: "Select item to the right (Grid view)",
    explorerBehavior: "Moves selection to the succeeding column in grid mode",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "select.range_up",
    category: "selection",
    keys: ["Shift", "ArrowUp"],
    displayKeys: "Shift + Up Arrow",
    description: "Extend selection upwards",
    explorerBehavior: "Extends contiguous selection range up by one item",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "select.range_down",
    category: "selection",
    keys: ["Shift", "ArrowDown"],
    displayKeys: "Shift + Down Arrow",
    description: "Extend selection downwards",
    explorerBehavior: "Extends contiguous selection range down by one item",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "select.home",
    category: "selection",
    keys: ["Home"],
    displayKeys: "Home",
    description: "Select the first item in the folder",
    explorerBehavior: "Moves selection and view to the very top item",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "select.end",
    category: "selection",
    keys: ["End"],
    displayKeys: "End",
    description: "Select the last item in the folder",
    explorerBehavior: "Moves selection and view to the very bottom item",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "select.pageup",
    category: "selection",
    keys: ["PageUp"],
    displayKeys: "Page Up",
    description: "Move view and selection one page up",
    explorerBehavior: "Scrolls and selects one screenful upwards",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "select.pagedown",
    category: "selection",
    keys: ["PageDown"],
    displayKeys: "Page Down",
    description: "Move view and selection one page down",
    explorerBehavior: "Scrolls and selects one screenful downwards",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "select.ctrl_space",
    category: "selection",
    keys: ["Ctrl", " "],
    displayKeys: "Ctrl + Space",
    description: "Toggle selection of focused item",
    explorerBehavior: "Toggles item selection without clearing other selected items",
    finestFileSupport: "full",
    preventInInput: true,
  },

  // --- View & Tabs ---
  {
    id: "view.details",
    category: "view",
    keys: ["Ctrl", "1"],
    displayKeys: "Ctrl + 1",
    description: "Switch to Details list view",
    explorerBehavior: "Switches current folder display to Details layout",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "view.extra_large_icons",
    category: "view",
    keys: ["Ctrl", "Shift", "1"],
    displayKeys: "Ctrl + Shift + 1",
    description: "Switch to Extra Large Icons view",
    explorerBehavior: "Switches current folder display to Extra Large Icons (256px)",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "view.large_icons",
    category: "view",
    keys: ["Ctrl", "Shift", "2"],
    displayKeys: "Ctrl + Shift + 2",
    description: "Switch to Large Icons view",
    explorerBehavior: "Switches current folder display to Large Icons (96px)",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "view.medium_icons",
    category: "view",
    keys: ["Ctrl", "Shift", "3"],
    displayKeys: "Ctrl + Shift + 3",
    description: "Switch to Medium Icons view",
    explorerBehavior: "Switches current folder display to Medium Icons (48px)",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "view.small_icons",
    category: "view",
    keys: ["Ctrl", "Shift", "4"],
    displayKeys: "Ctrl + Shift + 4",
    description: "Switch to Small Icons view",
    explorerBehavior: "Switches current folder display to Small Icons (24px)",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "view.list",
    category: "view",
    keys: ["Ctrl", "Shift", "5"],
    displayKeys: "Ctrl + Shift + 5",
    description: "Switch to List view",
    explorerBehavior: "Switches current folder display to compact List layout",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "view.details_shift",
    category: "view",
    keys: ["Ctrl", "Shift", "6"],
    displayKeys: "Ctrl + Shift + 6",
    description: "Switch to Details list view",
    explorerBehavior: "Alternate Explorer shortcut for Details view",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "view.tiles",
    category: "view",
    keys: ["Ctrl", "Shift", "7"],
    displayKeys: "Ctrl + Shift + 7",
    description: "Switch to Tiles view",
    explorerBehavior: "Switches current folder display to Tiles layout (48px icon + 2 lines)",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "view.content",
    category: "view",
    keys: ["Ctrl", "Shift", "8"],
    displayKeys: "Ctrl + Shift + 8",
    description: "Switch to Content view",
    explorerBehavior: "Switches current folder display to Content layout (32px icon + 4 lines metadata)",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "view.grid",
    category: "view",
    keys: ["Ctrl", "2"],
    displayKeys: "Ctrl + 2",
    description: "Switch to Grid / Large Icons view",
    explorerBehavior: "Switches current folder display to Grid layout",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "view.grid_shift",
    category: "view",
    keys: ["Ctrl", "Shift", "2"],
    displayKeys: "Ctrl + Shift + 2",
    description: "Switch to Grid / Large Icons view",
    explorerBehavior: "Alternate Explorer shortcut for Large Icons view",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "view.zoom_in",
    category: "view",
    keys: ["Ctrl", "+"],
    displayKeys: "Ctrl + +",
    description: "Increase icon and thumbnail size",
    explorerBehavior: "Zooms in icon size smoothly",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "view.zoom_out",
    category: "view",
    keys: ["Ctrl", "-"],
    displayKeys: "Ctrl + -",
    description: "Decrease icon and thumbnail size",
    explorerBehavior: "Zooms out icon size smoothly",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "view.zoom_reset",
    category: "view",
    keys: ["Ctrl", "0"],
    displayKeys: "Ctrl + 0",
    description: "Reset icon zoom to default size",
    explorerBehavior: "Restores standard icon size",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "view.toggle_preview_pane",
    category: "view",
    keys: ["Alt", "p"],
    displayKeys: "Alt + P",
    description: "Show or hide the preview pane",
    explorerBehavior: "Toggles the File Explorer preview pane",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "tabs.new",
    category: "tabs",
    keys: ["Ctrl", "t"],
    displayKeys: "Ctrl + T",
    description: "Open a new tab",
    explorerBehavior: "Opens a new tab matching current directory (Win 11 Explorer)",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "tabs.close",
    category: "tabs",
    keys: ["Ctrl", "w"],
    displayKeys: "Ctrl + W",
    description: "Close active tab",
    explorerBehavior: "Closes current tab in Windows 11 Explorer",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "tabs.next",
    category: "tabs",
    keys: ["Ctrl", "Tab"],
    displayKeys: "Ctrl + Tab",
    description: "Switch to the next tab",
    explorerBehavior: "Cycles forward through open tabs",
    finestFileSupport: "full",
    preventInInput: true,
  },
  {
    id: "tabs.prev",
    category: "tabs",
    keys: ["Ctrl", "Shift", "Tab"],
    displayKeys: "Ctrl + Shift + Tab",
    description: "Switch to the previous tab",
    explorerBehavior: "Cycles backward through open tabs",
    finestFileSupport: "full",
    preventInInput: true,
  },

  // --- Help & Reference ---
  {
    id: "help.shortcuts",
    category: "help",
    keys: ["F1"],
    displayKeys: "F1",
    description: "Open keyboard shortcuts reference",
    explorerBehavior: "Opens Windows Help and Support",
    finestFileSupport: "custom",
    differences: "Opens FinestFile Searchable In-App Shortcut Reference Modal",
    preventInInput: false,
  },
];

/**
 * Checks if the user is currently typing in an editable field
 * (input, textarea, or contentEditable).
 */
export function isInputFocused(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  if (tagName === "input") {
    const inputType = (target as HTMLInputElement).type.toLowerCase();
    // Non-text inputs (like checkbox, radio, button) don't capture typing shortcuts
    return !["checkbox", "radio", "button", "submit", "reset"].includes(inputType);
  }
  if (tagName === "textarea" || target.isContentEditable) {
    return true;
  }
  return false;
}

/**
 * Maps internal key identifiers to clean Windows Explorer display labels.
 */
export function formatKeyDisplay(key: string): string {
  switch (key) {
    case "ArrowLeft":
      return "Left Arrow";
    case "ArrowRight":
      return "Right Arrow";
    case "ArrowUp":
      return "Up Arrow";
    case "ArrowDown":
      return "Down Arrow";
    case " ":
    case "Space":
      return "Space";
    case "Escape":
      return "Esc";
    case "ContextMenu":
      return "Menu Key";
    case "Plus":
      return "+";
    case "Minus":
      return "-";
    default:
      return key.length === 1 ? key.toUpperCase() : key;
  }
}

/**
 * Formats an array of keys (e.g. ["Ctrl", "Shift", "N"]) into a user-friendly string ("Ctrl + Shift + N").
 */
export function formatKeyComboDisplay(keys: string[]): string {
  return keys.map(formatKeyDisplay).join(" + ");
}

/**
 * Parses a saved shortcut string (e.g. "Ctrl+Shift+N" or "Alt+ArrowLeft") into key array.
 */
export function parseKeyCombo(comboStr: string): string[] {
  if (!comboStr) return [];
  const parts: string[] = [];
  const rawParts = comboStr.split("+").map((s) => s.trim());
  for (let i = 0; i < rawParts.length; i++) {
    const part = rawParts[i];
    if (part === "" && i > 0 && rawParts[i - 1] === "") {
      parts.push("+");
    } else if (part !== "") {
      parts.push(part === "Plus" ? "+" : part);
    }
  }
  return parts;
}

/**
 * Converts a key combo array to a storage string.
 */
export function serializeKeyCombo(keys: string[]): string {
  return keys.map((k) => (k === "+" ? "Plus" : k)).join("+");
}

/**
 * Returns effective keys and display keys for a shortcut, taking into account user custom overrides.
 */
export function getEffectiveShortcut(
  shortcut: ShortcutDefinition,
  customShortcuts?: Record<string, string>
): { keys: string[]; displayKeys: string; isCustom: boolean } {
  if (customShortcuts && customShortcuts[shortcut.id]) {
    const customStr = customShortcuts[shortcut.id];
    const keys = parseKeyCombo(customStr);
    if (keys.length > 0) {
      return {
        keys,
        displayKeys: formatKeyComboDisplay(keys),
        isCustom: true,
      };
    }
  }
  return {
    keys: shortcut.keys,
    displayKeys: shortcut.displayKeys,
    isCustom: false,
  };
}

/**
 * Converts a KeyboardEvent during recording to a structured key combo, or null if only modifiers are held.
 */
export function eventToKeyCombo(e: KeyboardEvent | React.KeyboardEvent): { keys: string[]; displayKeys: string } | null {
  const isModifierOnly = ["Control", "Shift", "Alt", "Meta"].includes(e.key);
  if (isModifierOnly) {
    return null;
  }

  const keys: string[] = [];
  if (e.ctrlKey || e.metaKey) keys.push("Ctrl");
  if (e.altKey) keys.push("Alt");
  if (e.shiftKey) keys.push("Shift");

  let mainKey = e.key;
  if (mainKey === " ") mainKey = "Space";
  else if (mainKey === "+" || mainKey === "=") mainKey = "+";
  else if (mainKey === "-" || mainKey === "_") mainKey = "-";
  else if (mainKey.length === 1) mainKey = mainKey.toUpperCase();

  keys.push(mainKey);

  return {
    keys,
    displayKeys: formatKeyComboDisplay(keys),
  };
}

/**
 * Matches a native KeyboardEvent against a ShortcutDefinition, respecting any custom user override.
 */
export function matchesShortcut(
  event: KeyboardEvent,
  shortcut: ShortcutDefinition,
  customShortcuts?: Record<string, string>
): boolean {
  const effective = getEffectiveShortcut(shortcut, customShortcuts);
  const keys = effective.keys;

  const reqCtrl = keys.includes("Ctrl");
  const reqShift = keys.includes("Shift");
  const reqAlt = keys.includes("Alt");

  // Check modifiers
  const ctrlActive = event.ctrlKey || event.metaKey;
  if (reqCtrl !== ctrlActive) return false;
  if (reqShift !== event.shiftKey) return false;
  if (reqAlt !== event.altKey) return false;

  // Find non-modifier key
  const mainKey = keys.find((k) => !["Ctrl", "Shift", "Alt"].includes(k));
  if (!mainKey) return false;

  if ((mainKey === "+" || mainKey === "Plus") && (event.key === "+" || event.key === "=")) {
    return true;
  }
  if ((mainKey === "-" || mainKey === "Minus") && (event.key === "-" || event.key === "_")) {
    return true;
  }
  if (mainKey === "Space" && event.key === " ") {
    return true;
  }
  if ((mainKey === "Menu" || mainKey === "ContextMenu") && event.key === "ContextMenu") {
    return true;
  }

  return event.key.toLowerCase() === mainKey.toLowerCase();
}

/**
 * Checks if an event matches a shortcut ID directly, taking into account user custom overrides.
 */
export function matchesShortcutId(
  event: KeyboardEvent,
  shortcutId: string,
  customShortcuts?: Record<string, string>
): boolean {
  const sc = SHORTCUT_REGISTRY.find((s) => s.id === shortcutId);
  if (!sc) return false;
  return matchesShortcut(event, sc, customShortcuts);
}

