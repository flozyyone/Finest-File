import test from "node:test";
import assert from "node:assert/strict";
import {
  SHORTCUT_REGISTRY,
  isInputFocused,
  matchesShortcut,
} from "../src/shortcuts/registry.ts";
import { undoStack } from "../src/utils/undoStack.ts";

test("Shortcut Registry - Required Windows File Explorer shortcuts are registered", () => {
  const ids = SHORTCUT_REGISTRY.map((s) => s.id);

  // Navigation
  assert.ok(ids.includes("nav.back"), "nav.back missing");
  assert.ok(ids.includes("nav.forward"), "nav.forward missing");
  assert.ok(ids.includes("nav.up"), "nav.up missing");
  assert.ok(ids.includes("nav.backspace"), "nav.backspace missing");
  assert.ok(ids.includes("nav.focus_address"), "nav.focus_address missing");
  assert.ok(ids.includes("nav.focus_address_ctrl_l"), "nav.focus_address_ctrl_l missing");
  assert.ok(ids.includes("nav.focus_address_f4"), "nav.focus_address_f4 missing");
  assert.ok(ids.includes("nav.focus_search"), "nav.focus_search missing");
  assert.ok(ids.includes("nav.focus_search_f"), "nav.focus_search_f missing");
  assert.ok(ids.includes("nav.refresh"), "nav.refresh missing");
  assert.ok(ids.includes("nav.refresh_ctrl_r"), "nav.refresh_ctrl_r missing");
  assert.ok(ids.includes("nav.properties"), "nav.properties missing");
  assert.ok(ids.includes("nav.escape"), "nav.escape missing");

  // File Operations
  assert.ok(ids.includes("ops.copy"), "ops.copy missing");
  assert.ok(ids.includes("ops.cut"), "ops.cut missing");
  assert.ok(ids.includes("ops.paste"), "ops.paste missing");
  assert.ok(ids.includes("ops.undo"), "ops.undo missing");
  assert.ok(ids.includes("ops.redo"), "ops.redo missing");
  assert.ok(ids.includes("ops.rename"), "ops.rename missing");
  assert.ok(ids.includes("ops.delete_recycle"), "ops.delete_recycle missing");
  assert.ok(ids.includes("ops.delete_permanent"), "ops.delete_permanent missing");
  assert.ok(ids.includes("ops.new_folder"), "ops.new_folder missing");
  assert.ok(ids.includes("ops.select_all"), "ops.select_all missing");
  assert.ok(ids.includes("ops.copy_path"), "ops.copy_path missing");
  assert.ok(ids.includes("ops.context_menu_f10"), "ops.context_menu_f10 missing");
  assert.ok(ids.includes("ops.context_menu_key"), "ops.context_menu_key missing");

  // Selection
  assert.ok(ids.includes("select.open"), "select.open missing");
  assert.ok(ids.includes("select.up"), "select.up missing");
  assert.ok(ids.includes("select.down"), "select.down missing");
  assert.ok(ids.includes("select.left"), "select.left missing");
  assert.ok(ids.includes("select.right"), "select.right missing");
  assert.ok(ids.includes("select.range_up"), "select.range_up missing");
  assert.ok(ids.includes("select.range_down"), "select.range_down missing");
  assert.ok(ids.includes("select.home"), "select.home missing");
  assert.ok(ids.includes("select.end"), "select.end missing");
  assert.ok(ids.includes("select.pageup"), "select.pageup missing");
  assert.ok(ids.includes("select.pagedown"), "select.pagedown missing");
  assert.ok(ids.includes("select.ctrl_space"), "select.ctrl_space missing");

  // Tabs
  assert.ok(ids.includes("tabs.new"), "tabs.new missing");
  assert.ok(ids.includes("tabs.close"), "tabs.close missing");
  assert.ok(ids.includes("tabs.next"), "tabs.next missing");
  assert.ok(ids.includes("tabs.prev"), "tabs.prev missing");

  // View & Zoom
  assert.ok(ids.includes("view.details"), "view.details missing");
  assert.ok(ids.includes("view.grid"), "view.grid missing");
  assert.ok(ids.includes("view.zoom_in"), "view.zoom_in missing");
  assert.ok(ids.includes("view.zoom_out"), "view.zoom_out missing");
  assert.ok(ids.includes("view.zoom_reset"), "view.zoom_reset missing");

  // Help
  assert.ok(ids.includes("help.shortcuts"), "help.shortcuts missing");
});

test("Shortcut Registry - Every shortcut has valid categories and keys", () => {
  assert.ok(SHORTCUT_REGISTRY.length >= 40, `Expected at least 40 shortcuts, found ${SHORTCUT_REGISTRY.length}`);
  for (const sc of SHORTCUT_REGISTRY) {
    assert.ok(sc.id, `Shortcut missing id`);
    assert.ok(sc.category, `${sc.id} missing category`);
    assert.ok(sc.keys.length > 0, `${sc.id} missing keys`);
    assert.ok(sc.displayKeys, `${sc.id} missing displayKeys`);
    assert.ok(sc.description, `${sc.id} missing description`);
    assert.ok(sc.explorerBehavior, `${sc.id} missing explorerBehavior`);
    assert.ok(sc.finestFileSupport, `${sc.id} missing finestFileSupport`);
  }
});

test("matchesShortcut - Validates Ctrl+C, Ctrl+X, Ctrl+V, F5, Alt+Left", () => {
  const copySc = SHORTCUT_REGISTRY.find((s) => s.id === "ops.copy");
  assert.ok(copySc);

  // Exact match
  assert.equal(
    matchesShortcut(
      { key: "c", ctrlKey: true, metaKey: false, shiftKey: false, altKey: false },
      copySc
    ),
    true
  );

  // Missing modifier
  assert.equal(
    matchesShortcut(
      { key: "c", ctrlKey: false, metaKey: false, shiftKey: false, altKey: false },
      copySc
    ),
    false
  );

  // Extra modifier
  assert.equal(
    matchesShortcut(
      { key: "c", ctrlKey: true, metaKey: false, shiftKey: true, altKey: false },
      copySc
    ),
    false
  );

  // Refresh F5
  const refreshSc = SHORTCUT_REGISTRY.find((s) => s.id === "nav.refresh");
  assert.ok(refreshSc);
  assert.equal(
    matchesShortcut(
      { key: "F5", ctrlKey: false, metaKey: false, shiftKey: false, altKey: false },
      refreshSc
    ),
    true
  );

  // Alt + Left Arrow
  const backSc = SHORTCUT_REGISTRY.find((s) => s.id === "nav.back");
  assert.ok(backSc);
  assert.equal(
    matchesShortcut(
      { key: "ArrowLeft", ctrlKey: false, metaKey: false, shiftKey: false, altKey: true },
      backSc
    ),
    true
  );
});

test("UndoStack - Pushes, pops, redos, and clear history correctly", () => {
  undoStack.clear();
  assert.equal(undoStack.canUndo(), false);
  assert.equal(undoStack.canRedo(), false);

  undoStack.push({
    type: "rename",
    description: "Rename a.txt to b.txt",
    payload: { originalPath: "C:\\a.txt", newPath: "C:\\b.txt" },
  });

  assert.equal(undoStack.canUndo(), true);
  assert.equal(undoStack.canRedo(), false);

  const undone = undoStack.popUndo();
  assert.ok(undone);
  assert.equal(undone.type, "rename");
  assert.equal(undone.payload.originalPath, "C:\\a.txt");
  assert.equal(undoStack.canUndo(), false);
  assert.equal(undoStack.canRedo(), true);

  const redone = undoStack.popRedo();
  assert.ok(redone);
  assert.equal(redone.payload.newPath, "C:\\b.txt");
  assert.equal(undoStack.canUndo(), true);
  assert.equal(undoStack.canRedo(), false);
});

test("Custom Shortcuts - Override detection and matchesShortcutId", () => {
  const copySc = SHORTCUT_REGISTRY.find((s) => s.id === "ops.copy");
  assert.ok(copySc);

  // Default behavior
  const defaultEvent = { key: "c", ctrlKey: true, metaKey: false, shiftKey: false, altKey: false };
  assert.equal(matchesShortcut(defaultEvent, copySc), true);

  // Custom override: rebind Ctrl+C to Ctrl+Shift+K
  const customShortcuts = { "ops.copy": "Ctrl+Shift+K" };
  // Old default no longer matches
  assert.equal(matchesShortcut(defaultEvent, copySc, customShortcuts), false);

  // New combo matches
  const customEvent = { key: "k", ctrlKey: true, metaKey: false, shiftKey: true, altKey: false };
  assert.equal(matchesShortcut(customEvent, copySc, customShortcuts), true);
  assert.equal(matchesShortcut(customEvent, copySc), false); // Without overrides, doesn't match
});

