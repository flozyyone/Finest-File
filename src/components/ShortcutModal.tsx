import React, { useState } from "react";
import { SHORTCUT_REGISTRY } from "../shortcuts/registry";
import { ShortcutCategory } from "../shortcuts/types";
import { Keyboard, X, Search, CheckCircle2 } from "lucide-react";
import styles from "./ShortcutModal.module.css";

interface ShortcutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutModal: React.FC<ShortcutModalProps> = ({ isOpen, onClose }) => {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ShortcutCategory | "all">("all");

  if (!isOpen) return null;

  const categories: { id: ShortcutCategory | "all"; label: string }[] = [
    { id: "all", label: "All Shortcuts" },
    { id: "navigation", label: "Navigation" },
    { id: "operations", label: "File Operations" },
    { id: "selection", label: "Selection & List" },
    { id: "view", label: "View & Zoom" },
    { id: "tabs", label: "Tabs" },
    { id: "help", label: "Help" },
  ];

  const filteredShortcuts = SHORTCUT_REGISTRY.filter((sc) => {
    if (selectedCategory !== "all" && sc.category !== selectedCategory) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchDesc = sc.description.toLowerCase().includes(q);
      const matchKeys = sc.displayKeys.toLowerCase().includes(q);
      const matchExplorer = sc.explorerBehavior.toLowerCase().includes(q);
      return matchDesc || matchKeys || matchExplorer;
    }
    return true;
  });

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <Keyboard size={18} color="var(--accent)" />
            <h2 className={styles.title}>Windows Explorer Keyboard Shortcuts</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
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
              placeholder="Search shortcuts (e.g. 'copy', 'F2', 'address', 'zoom')..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            {search && (
              <button
                className={styles.closeBtn}
                onClick={() => setSearch("")}
                style={{ padding: 2 }}
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
            const keyParts = sc.displayKeys.split(" + ");
            return (
              <div key={sc.id} className={styles.shortcutRow}>
                <div className={styles.shortcutInfo}>
                  <span className={styles.shortcutDesc}>{sc.description}</span>
                  <span className={styles.shortcutDetail}>
                    Explorer: {sc.explorerBehavior}
                    {sc.differences && ` (${sc.differences})`}
                  </span>
                </div>

                <div className={styles.keyContainer}>
                  {keyParts.map((kp, idx) => (
                    <React.Fragment key={idx}>
                      <span className={styles.kbd}>{kp}</span>
                      {idx < keyParts.length - 1 && <span className={styles.keyPlus}>+</span>}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <span className={styles.compatBadge}>
            <CheckCircle2 size={14} />
            <span>100% Windows File Explorer Shortcut Compatible</span>
          </span>
          <span>{filteredShortcuts.length} shortcuts registered</span>
        </div>
      </div>
    </div>
  );
};
