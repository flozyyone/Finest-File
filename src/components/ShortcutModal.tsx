import React, { useState, useEffect } from "react";
import {
  SHORTCUT_REGISTRY,
  getEffectiveShortcut,
  eventToKeyCombo,
  serializeKeyCombo,
} from "../shortcuts/registry";
import { ShortcutCategory } from "../shortcuts/types";
import {
  Keyboard,
  X,
  Search,
  CheckCircle2,
  RotateCcw,
  Edit2,
  AlertCircle,
  Check,
} from "lucide-react";
import { useI18n, formatWithParams } from "../i18n";
import styles from "./ShortcutModal.module.css";

interface ShortcutModalProps {
  isOpen: boolean;
  onClose: () => void;
  customShortcuts?: Record<string, string>;
  onSaveCustomShortcuts?: (customShortcuts: Record<string, string>) => void;
}

export const ShortcutModal: React.FC<ShortcutModalProps> = ({
  isOpen,
  onClose,
  customShortcuts = {},
  onSaveCustomShortcuts,
}) => {
  const { dict } = useI18n();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ShortcutCategory | "all">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [recordedKeys, setRecordedKeys] = useState<{ keys: string[]; displayKeys: string } | null>(null);
  const [heldModifiers, setHeldModifiers] = useState<string>("");

  useEffect(() => {
    if (!editingId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setEditingId(null);
        setRecordedKeys(null);
        setHeldModifiers("");
        return;
      }

      const isModifierOnly = ["Control", "Shift", "Alt", "Meta"].includes(e.key);
      if (isModifierOnly) {
        const mods: string[] = [];
        if (e.ctrlKey || e.metaKey) mods.push("Ctrl");
        if (e.altKey) mods.push("Alt");
        if (e.shiftKey) mods.push("Shift");
        setHeldModifiers(mods.join(" + ") + (mods.length > 0 ? " + ..." : ""));
        return;
      }

      const combo = eventToKeyCombo(e);
      if (combo) {
        setRecordedKeys(combo);
        setHeldModifiers("");
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) {
        const mods: string[] = [];
        if (e.ctrlKey || e.metaKey) mods.push("Ctrl");
        if (e.altKey) mods.push("Alt");
        if (e.shiftKey) mods.push("Shift");
        setHeldModifiers(mods.length > 0 ? mods.join(" + ") + " + ..." : "");
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
    };
  }, [editingId]);

  if (!isOpen) return null;

  const categories: { id: ShortcutCategory | "all"; label: string }[] = [
    { id: "all", label: dict.shortcuts.categories.all },
    { id: "navigation", label: dict.shortcuts.categories.navigation },
    { id: "operations", label: dict.shortcuts.categories.operations },
    { id: "selection", label: dict.shortcuts.categories.selection },
    { id: "view", label: dict.shortcuts.categories.view },
    { id: "tabs", label: dict.shortcuts.categories.tabs },
    { id: "help", label: dict.shortcuts.categories.help },
  ];

  const customCount = Object.keys(customShortcuts).length;

  const filteredShortcuts = SHORTCUT_REGISTRY.filter((sc) => {
    if (selectedCategory !== "all" && sc.category !== selectedCategory) {
      return false;
    }
    const effective = getEffectiveShortcut(sc, customShortcuts);
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchDesc = sc.description.toLowerCase().includes(q);
      const matchKeys = effective.displayKeys.toLowerCase().includes(q) || sc.displayKeys.toLowerCase().includes(q);
      const matchExplorer = sc.explorerBehavior.toLowerCase().includes(q);
      return matchDesc || matchKeys || matchExplorer;
    }
    return true;
  });

  const conflictShortcut =
    recordedKeys && editingId
      ? SHORTCUT_REGISTRY.find((sc) => {
          if (sc.id === editingId) return false;
          const eff = getEffectiveShortcut(sc, customShortcuts);
          return (
            serializeKeyCombo(eff.keys).toLowerCase() ===
            serializeKeyCombo(recordedKeys.keys).toLowerCase()
          );
        })
      : null;

  const handleStartRebind = (id: string) => {
    setEditingId(id);
    setRecordedKeys(null);
    setHeldModifiers("");
  };

  const handleSaveRebind = (id: string) => {
    if (!recordedKeys || !onSaveCustomShortcuts) return;
    const serialized = serializeKeyCombo(recordedKeys.keys);
    const updated = { ...customShortcuts, [id]: serialized };
    onSaveCustomShortcuts(updated);
    setEditingId(null);
    setRecordedKeys(null);
    setHeldModifiers("");
  };

  const handleResetShortcut = (id: string) => {
    if (!onSaveCustomShortcuts) return;
    const updated = { ...customShortcuts };
    delete updated[id];
    onSaveCustomShortcuts(updated);
  };

  const handleResetAll = () => {
    if (!onSaveCustomShortcuts) return;
    onSaveCustomShortcuts({});
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <Keyboard size={18} color="var(--accent)" />
            <h2 className={styles.title}>{dict.shortcuts.title}</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label={dict.common.close}>
            <X size={16} />
          </button>
        </div>

        {/* Search & Category Pills */}
        <div className={styles.controlsBar}>
          <div className={styles.searchBox}>
            <Search size={15} color="var(--text-muted)" />
            <input
              type="text"
              className={styles.searchInput}
              placeholder={dict.shortcuts.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            {search && (
              <button
                className={styles.closeBtn}
                onClick={() => setSearch("")}
                style={{ padding: 2 }}
                title={dict.common.clear}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className={styles.pillsRow}>
            {categories.map((c) => (
              <button
                key={c.id}
                className={`${styles.pill} ${selectedCategory === c.id ? styles.active : ""}`}
                onClick={() => setSelectedCategory(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Shortcuts List */}
        <div className={styles.content}>
          {filteredShortcuts.map((sc) => {
            const isEditing = editingId === sc.id;
            const effective = getEffectiveShortcut(sc, customShortcuts);
            const keyParts = effective.displayKeys.split(" + ");

            return (
              <div key={sc.id} className={styles.shortcutRow}>
                <div className={styles.shortcutInfo}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className={styles.shortcutDesc}>{sc.description}</span>
                    {effective.isCustom && (
                      <span className={styles.customBadge}>{dict.common.customized}</span>
                    )}
                  </div>
                  <span className={styles.shortcutDetail}>
                    {dict.shortcuts.explorerBehavior}: {sc.explorerBehavior}
                    {sc.differences && ` (${sc.differences})`}
                  </span>
                </div>

                {isEditing ? (
                  <div className={styles.recordingBox}>
                    <div className={styles.recordingPrompt}>
                      {recordedKeys ? (
                        <span>{recordedKeys.displayKeys}</span>
                      ) : heldModifiers ? (
                        <span>{heldModifiers}</span>
                      ) : (
                        <span>{dict.shortcuts.pressKeysPrompt}</span>
                      )}
                    </div>

                    {conflictShortcut && (
                      <div className={styles.conflictWarning}>
                        <AlertCircle size={12} />
                        <span>
                          {formatWithParams(dict.shortcuts.conflictWarning, {
                            action: conflictShortcut.description,
                          })}
                        </span>
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                      <button
                        className={styles.btnActionPrimary}
                        onClick={() => handleSaveRebind(sc.id)}
                        disabled={!recordedKeys}
                        style={{ opacity: recordedKeys ? 1 : 0.6 }}
                      >
                        <Check size={13} />
                        <span>{dict.common.save}</span>
                      </button>
                      <button
                        className={styles.btnAction}
                        onClick={() => {
                          setEditingId(null);
                          setRecordedKeys(null);
                        }}
                      >
                        <X size={13} />
                        <span>{dict.common.cancel}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.rightControls}>
                    <div className={`${styles.keyContainer} kbdContainer`} dir="ltr">
                      {keyParts.map((kp, idx) => (
                        <React.Fragment key={idx}>
                          <span className={`${styles.kbd} kbd`} dir="ltr">{kp}</span>
                          {idx < keyParts.length - 1 && <span className={styles.keyPlus}>+</span>}
                        </React.Fragment>
                      ))}
                    </div>

                    {effective.isCustom && (
                      <button
                        className={styles.btnAction}
                        onClick={() => handleResetShortcut(sc.id)}
                        title={dict.common.reset}
                      >
                        <RotateCcw size={12} />
                        <span>{dict.common.reset}</span>
                      </button>
                    )}

                    <button
                      className={styles.btnAction}
                      onClick={() => handleStartRebind(sc.id)}
                      title={dict.common.rebind}
                    >
                      <Edit2 size={12} />
                      <span>{dict.common.rebind}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className={styles.compatBadge}>
              <CheckCircle2 size={14} />
              <span>{dict.shortcuts.compatBadge}</span>
            </span>
            {customCount > 0 && (
              <button
                className={styles.resetAllBtn}
                onClick={handleResetAll}
                title={dict.common.resetAll}
              >
                <RotateCcw size={12} />
                <span>{dict.common.resetAll} ({customCount})</span>
              </button>
            )}
          </div>
          <span>
            {formatWithParams(dict.shortcuts.registeredCount, {
              count: filteredShortcuts.length,
            })}
          </span>
        </div>
      </div>
    </div>
  );
};
