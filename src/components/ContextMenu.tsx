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
} from "lucide-react";
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
  viewMode,
  onViewModeChange,
  prefs,
  onPrefsChange,
}) => {
  const [activeSubmenu, setActiveSubmenu] = useState<"view" | "sort" | "group" | null>(null);

  const isBackground = selectedItems.length === 0;
  const isSingle = selectedItems.length === 1;
  const single = isSingle ? selectedItems[0] : null;
  const isArchive = single && ["zip", "7z", "rar", "tar", "gz"].includes(single.ext.toLowerCase());

  // Keep menu within viewport bounds
  const flipHorizontal = x > window.innerWidth - 440;
  const menuStyle = {
    top: Math.min(y, window.innerHeight - 380),
    left: Math.min(x, window.innerWidth - 220),
  };

  const sortFields: { id: SortField; label: string }[] = [
    { id: "name", label: "Name" },
    { id: "date_modified", label: "Date modified" },
    { id: "extension", label: "Type" },
    { id: "size", label: "Size" },
    { id: "date_created", label: "Date created" },
    { id: "date_accessed", label: "Date last accessed" },
    { id: "attributes", label: "Attributes" },
  ];

  const groupModes: { id: GroupMode; label: string }[] = [
    { id: "none", label: "(None)" },
    { id: "name_range", label: "Name" },
    { id: "date_modified", label: "Date modified" },
    { id: "extension", label: "Type" },
    { id: "size", label: "Size" },
    { id: "date_created", label: "Date created" },
    { id: "attributes", label: "Attributes" },
  ];

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div
        className={styles.menu}
        style={menuStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {!isBackground ? (
          <>
            <button className={styles.item} onClick={() => { onOpen(); onClose(); }}>
              <ExternalLink size={15} />
              <span>Open</span>
            </button>
            <button className={styles.item} onClick={() => { onOpenWith(); onClose(); }}>
              <span>Open with...</span>
            </button>

            {isArchive && (
              <button className={styles.item} onClick={() => { onExtractArchive(); onClose(); }}>
                <FolderArchive size={15} />
                <span>Extract All...</span>
              </button>
            )}

            <div className={styles.separator} />

            <button className={styles.item} onClick={() => { onCut(); onClose(); }}>
              <Scissors size={15} />
              <span>Cut</span>
              <span className={styles.shortcut}>Ctrl+X</span>
            </button>
            <button className={styles.item} onClick={() => { onCopy(); onClose(); }}>
              <Copy size={15} />
              <span>Copy</span>
              <span className={styles.shortcut}>Ctrl+C</span>
            </button>
            <button className={styles.item} onClick={() => { onCopyPath(); onClose(); }}>
              <span>Copy as path</span>
            </button>

            <div className={styles.separator} />

            <button className={styles.item} onClick={() => { onCreateArchive(); onClose(); }}>
              <FileArchive size={15} />
              <span>Compress to ZIP</span>
            </button>

            {isSingle && (
              <button className={styles.item} onClick={() => { onRename(); onClose(); }}>
                <Edit2 size={15} />
                <span>Rename</span>
                <span className={styles.shortcut}>F2</span>
              </button>
            )}

            <button className={styles.item} onClick={() => { onDelete(false); onClose(); }}>
              <Trash2 size={15} />
              <span>Delete</span>
              <span className={styles.shortcut}>Del</span>
            </button>

            <div className={styles.separator} />

            <button className={styles.item} onClick={() => { onProperties(); onClose(); }}>
              <Info size={15} />
              <span>Properties</span>
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
                  <span>View</span>
                  <ChevronRight size={13} className={styles.arrowRight} />
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
                      <span>Details</span>
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
                      <span>Grid</span>
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
                  <span>Sort by</span>
                  <ChevronRight size={13} className={styles.arrowRight} />
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
                      <span>Ascending</span>
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
                      <span>Descending</span>
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
                      <span>Keep folders on top</span>
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
                  <span>Group by</span>
                  <ChevronRight size={13} className={styles.arrowRight} />
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
                          <span>Ascending</span>
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
                          <span>Descending</span>
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
                <span>Refresh</span>
                <span className={styles.shortcut}>F5</span>
              </button>
            )}

            <div className={styles.separator} />

            <button className={styles.item} onClick={() => { onNewFolder(); onClose(); }}>
              <FolderPlus size={15} />
              <span>New folder</span>
              <span className={styles.shortcut}>Ctrl+Shift+N</span>
            </button>
            <button className={styles.item} onClick={() => { onNewFile(); onClose(); }}>
              <FilePlus size={15} />
              <span>New text document</span>
            </button>

            <div className={styles.separator} />

            <button
              className={styles.item}
              disabled={!hasClipboard}
              onClick={() => { onPaste(); onClose(); }}
            >
              <Clipboard size={15} />
              <span>Paste</span>
              <span className={styles.shortcut}>Ctrl+V</span>
            </button>

            <div className={styles.separator} />

            <button className={styles.item} onClick={() => { onProperties(); onClose(); }}>
              <Info size={15} />
              <span>Properties</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
