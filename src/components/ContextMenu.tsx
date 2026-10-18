import React, { useState } from "react";
import { FileEntry, ViewPreferences, SortField, GroupMode } from "../types";
import {
  FolderPlus,
  FilePlus,
  Copy,
  Scissors,
  Clipboard,
  Trash2,
  Edit2,
  FileArchive,
  FolderArchive,
  Info,
  ExternalLink,
  ArrowUpDown,
  Layers,
  LayoutGrid,
  List,
  ChevronRight,
  Check,
  RefreshCw,
  Eye,
} from "lucide-react";
import { useI18n } from "../i18n";
import styles from "./ContextMenu.module.css";

export interface ContextMenuProps {
  x: number;
  y: number;
  selectedItems: FileEntry[];
  hasClipboard: boolean;
  onClose: () => void;
  onOpen: () => void;
  onOpenWith: () => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onRename: () => void;
  onDelete: (permanent: boolean) => void;
  onCopyPath: () => void;
  onNewFolder: () => void;
  onNewFile: () => void;
  onCreateArchive: () => void;
  onExtractArchive: () => void;
  onProperties: () => void;
  onRefresh?: () => void;
  onQuickPreview?: () => void;
  viewMode?: "details" | "grid";
  onViewModeChange?: (mode: "details" | "grid") => void;
  prefs?: ViewPreferences;
  onPrefsChange?: (newPrefs: ViewPreferences) => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  selectedItems,
  hasClipboard,
  onClose,
  onOpen,
  onOpenWith,
  onCopy,
  onCut,
  onPaste,
  onRename,
  onDelete,
  onCopyPath,
  onNewFolder,
  onNewFile,
  onCreateArchive,
  onExtractArchive,
  onProperties,
  onRefresh,
  onQuickPreview,
  viewMode,
  onViewModeChange,
  prefs,
  onPrefsChange,
}) => {
  const { dict, dir } = useI18n();
  const [activeSubmenu, setActiveSubmenu] = useState<"view" | "sort" | "group" | null>(null);

  const isBackground = selectedItems.length === 0;
  const isSingle = selectedItems.length === 1;
  const isArchive =
    isSingle &&
    selectedItems[0].kind !== "directory" &&
    ["zip", "7z", "rar", "gz", "tar"].some((ext) =>
      selectedItems[0].name.toLowerCase().endsWith("." + ext)
    );

  // Position bounds safety check
  const menuWidth = 230;
  const menuHeight = isBackground ? 320 : 280;
  const adjustedX = Math.min(x, window.innerWidth - menuWidth - 10);
  const adjustedY = Math.min(y, window.innerHeight - menuHeight - 10);
  const flipHorizontal = adjustedX > window.innerWidth - menuWidth * 2;

  const menuStyle: React.CSSProperties = {
    top: Math.max(10, adjustedY),
    ...(dir === "rtl"
      ? { right: Math.max(10, window.innerWidth - adjustedX - menuWidth) }
      : { left: Math.max(10, adjustedX) }),
  };

  const sortFields: { id: SortField; label: string }[] = [
    { id: "name", label: dict.view.name },
    { id: "date_modified", label: dict.view.dateModified },
    { id: "extension", label: dict.view.type },
    { id: "size", label: dict.view.size },
    { id: "date_created", label: dict.view.dateCreated },
  ];

  const groupModes: { id: GroupMode; label: string }[] = [
    { id: "none", label: dict.view.none },
    { id: "name_range", label: dict.view.name },
    { id: "date_modified", label: dict.view.dateModified },
    { id: "extension", label: dict.view.type },
    { id: "size", label: dict.view.size },
  ];

  return (
    <div className={styles.overlay} onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }}>
      <div
        className={styles.menu}
        style={menuStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {!isBackground ? (
          <>
            <button className={styles.item} onClick={() => { onOpen(); onClose(); }}>
              <ExternalLink size={15} />
              <span>{dict.operations.openDefault}</span>
            </button>
            <button className={styles.item} onClick={() => { onOpenWith(); onClose(); }}>
              <span>{dict.operations.openWith}</span>
            </button>
            {isSingle && onQuickPreview && (
              <button className={styles.item} onClick={() => { onQuickPreview(); onClose(); }}>
                <Eye size={15} />
                <span>Quick Preview</span>
                <span className={styles.shortcut}>Space</span>
              </button>
            )}

            {isArchive && (
              <button className={styles.item} onClick={() => { onExtractArchive(); onClose(); }}>
                <FolderArchive size={15} />
                <span>{dict.operations.extractArchive}</span>
              </button>
            )}

            <div className={styles.separator} />

            <button className={styles.item} onClick={() => { onCut(); onClose(); }}>
              <Scissors size={15} />
              <span>{dict.common.cut}</span>
              <span className={styles.shortcut}>Ctrl+X</span>
            </button>
            <button className={styles.item} onClick={() => { onCopy(); onClose(); }}>
              <Copy size={15} />
              <span>{dict.common.copy}</span>
              <span className={styles.shortcut}>Ctrl+C</span>
            </button>
            <button className={styles.item} onClick={() => { onCopyPath(); onClose(); }}>
              <span>{dict.operations.copyPath}</span>
            </button>

            <div className={styles.separator} />

            <button className={styles.item} onClick={() => { onCreateArchive(); onClose(); }}>
              <FileArchive size={15} />
              <span>{dict.operations.createZip}</span>
            </button>

            {isSingle && (
              <button className={styles.item} onClick={() => { onRename(); onClose(); }}>
                <Edit2 size={15} />
                <span>{dict.common.rename}</span>
                <span className={styles.shortcut}>F2</span>
              </button>
            )}

            <button className={styles.item} onClick={() => { onDelete(false); onClose(); }}>
              <Trash2 size={15} />
              <span>{dict.common.delete}</span>
              <span className={styles.shortcut}>Del</span>
            </button>

            <div className={styles.separator} />

            <button className={styles.item} onClick={() => { onProperties(); onClose(); }}>
              <Info size={15} />
              <span>{dict.common.properties}</span>
              <span className={styles.shortcut}>Alt+Enter</span>
            </button>
          </>
        ) : (
          <>
            {/* View Submenu */}
            {viewMode && onViewModeChange && (
              <div
                className={styles.submenuTrigger}
                onMouseEnter={() => setActiveSubmenu("view")}
              >
                <button className={styles.item}>
                  <LayoutGrid size={15} />
                  <span>{dict.view.view}</span>
                  <ChevronRight size={13} className={`${styles.arrowRight} ${dir === "rtl" ? "rtlMirror" : ""}`} />
                </button>
                {activeSubmenu === "view" && (
                  <div className={`${styles.submenu} ${flipHorizontal ? styles.submenuLeft : ""}`}>
                    <button
                      className={styles.item}
                      onClick={() => {
                        onViewModeChange("details");
                        onClose();
                      }}
                    >
                      <span className={styles.checkIcon}>
                        {viewMode === "details" && <Check size={13} color="var(--accent)" />}
                      </span>
                      <List size={14} />
                      <span>{dict.view.details}</span>
                    </button>
                    <button
                      className={styles.item}
                      onClick={() => {
                        onViewModeChange("grid");
                        onClose();
                      }}
                    >
                      <span className={styles.checkIcon}>
                        {viewMode === "grid" && <Check size={13} color="var(--accent)" />}
                      </span>
                      <LayoutGrid size={14} />
                      <span>{dict.view.grid}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Sort by Submenu */}
            {prefs && onPrefsChange && (
              <div
                className={styles.submenuTrigger}
                onMouseEnter={() => setActiveSubmenu("sort")}
              >
                <button className={styles.item}>
                  <ArrowUpDown size={15} />
                  <span>{dict.view.sortBy}</span>
                  <ChevronRight size={13} className={`${styles.arrowRight} ${dir === "rtl" ? "rtlMirror" : ""}`} />
                </button>
                {activeSubmenu === "sort" && (
                  <div className={`${styles.submenu} ${flipHorizontal ? styles.submenuLeft : ""}`}>
                    {sortFields.map((f) => (
                      <button
                        key={f.id}
                        className={styles.item}
                        onClick={() => {
                          onPrefsChange({ ...prefs, sortField: f.id });
                          onClose();
                        }}
                      >
                        <span className={styles.checkIcon}>
                          {prefs.sortField === f.id && <Check size={13} color="var(--accent)" />}
                        </span>
                        <span>{f.label}</span>
                      </button>
                    ))}
                    <div className={styles.separator} />
                    <button
                      className={styles.item}
                      onClick={() => {
                        onPrefsChange({ ...prefs, sortDirection: "ascending" });
                        onClose();
                      }}
                    >
                      <span className={styles.checkIcon}>
                        {prefs.sortDirection === "ascending" && (
                          <Check size={13} color="var(--accent)" />
                        )}
                      </span>
                      <span>{dict.view.ascending}</span>
                    </button>
                    <button
                      className={styles.item}
                      onClick={() => {
                        onPrefsChange({ ...prefs, sortDirection: "descending" });
                        onClose();
                      }}
                    >
                      <span className={styles.checkIcon}>
                        {prefs.sortDirection === "descending" && (
                          <Check size={13} color="var(--accent)" />
                        )}
                      </span>
                      <span>{dict.view.descending}</span>
                    </button>
                    <div className={styles.separator} />
                    <button
                      className={styles.item}
                      onClick={() => {
                        onPrefsChange({ ...prefs, foldersFirst: !prefs.foldersFirst });
                        onClose();
                      }}
                    >
                      <span className={styles.checkIcon}>
                        {prefs.foldersFirst && <Check size={13} color="var(--accent)" />}
                      </span>
                      <span>{dict.view.foldersFirst}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Group by Submenu */}
            {prefs && onPrefsChange && (
              <div
                className={styles.submenuTrigger}
                onMouseEnter={() => setActiveSubmenu("group")}
              >
                <button className={styles.item}>
                  <Layers size={15} />
                  <span>{dict.view.groupBy}</span>
                  <ChevronRight size={13} className={`${styles.arrowRight} ${dir === "rtl" ? "rtlMirror" : ""}`} />
                </button>
                {activeSubmenu === "group" && (
                  <div className={`${styles.submenu} ${flipHorizontal ? styles.submenuLeft : ""}`}>
                    {groupModes.map((g) => (
                      <button
                        key={g.id}
                        className={styles.item}
                        onClick={() => {
                          onPrefsChange({ ...prefs, groupMode: g.id });
                          onClose();
                        }}
                      >
                        <span className={styles.checkIcon}>
                          {prefs.groupMode === g.id && <Check size={13} color="var(--accent)" />}
                        </span>
                        <span>{g.label}</span>
                      </button>
                    ))}
                    {prefs.groupMode !== "none" && (
                      <>
                        <div className={styles.separator} />
                        <button
                          className={styles.item}
                          onClick={() => {
                            onPrefsChange({ ...prefs, groupDirection: "ascending" });
                            onClose();
                          }}
                        >
                          <span className={styles.checkIcon}>
                            {prefs.groupDirection === "ascending" && (
                              <Check size={13} color="var(--accent)" />
                            )}
                          </span>
                          <span>{dict.view.ascending}</span>
                        </button>
                        <button
                          className={styles.item}
                          onClick={() => {
                            onPrefsChange({ ...prefs, groupDirection: "descending" });
                            onClose();
                          }}
                        >
                          <span className={styles.checkIcon}>
                            {prefs.groupDirection === "descending" && (
                              <Check size={13} color="var(--accent)" />
                            )}
                          </span>
                          <span>{dict.view.descending}</span>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {onRefresh && (
              <button
                className={styles.item}
                onClick={() => {
                  onRefresh();
                  onClose();
                }}
              >
                <RefreshCw size={15} />
                <span>{dict.common.refresh}</span>
                <span className={styles.shortcut}>F5</span>
              </button>
            )}

            <div className={styles.separator} />

            <button className={styles.item} onClick={() => { onNewFolder(); onClose(); }}>
              <FolderPlus size={15} />
              <span>{dict.operations.newFolder}</span>
              <span className={styles.shortcut}>Ctrl+Shift+N</span>
            </button>
            <button className={styles.item} onClick={() => { onNewFile(); onClose(); }}>
              <FilePlus size={15} />
              <span>{dict.operations.newFile}</span>
            </button>

            <div className={styles.separator} />

            <button
              className={styles.item}
              disabled={!hasClipboard}
              onClick={() => { onPaste(); onClose(); }}
            >
              <Clipboard size={15} />
              <span>{dict.common.paste}</span>
              <span className={styles.shortcut}>Ctrl+V</span>
            </button>

            <div className={styles.separator} />

            <button className={styles.item} onClick={() => { onProperties(); onClose(); }}>
              <Info size={15} />
              <span>{dict.common.properties}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
