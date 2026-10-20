import React, { useState, useRef, useEffect } from "react";
import {
  SortField,
  GroupMode,
  ViewPreferences,
  ViewMode,
} from "../types";
import {
  ArrowUpDown,
  Layers,
  LayoutGrid,
  List,
  Check,
  ChevronDown,
  RotateCcw,
  Minus,
  Plus,
  PanelRight,
  Scissors,
  Copy,
  ClipboardPaste,
  Edit3,
  Share2,
  Trash2,
  MoreHorizontal,
  FolderPlus,
  FilePlus,
  RotateCw,
  ExternalLink,
  Settings,
  Archive,
  Shield,
  Sliders,
  FolderSync,
} from "lucide-react";
import { useI18n } from "../i18n";
import styles from "./ViewToolbar.module.css";

export const WindowsLogo: React.FC<{ size?: number }> = ({ size = 15 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="currentColor"
    style={{ display: "inline-block", verticalAlign: "middle" }}
  >
    <path d="M0 0h7.2v7.2H0zm8.8 0H16v7.2H8.8zm-8.8 8.8h7.2V16H0zm8.8 0H16V16H8.8z" />
  </svg>
);

interface ViewToolbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  prefs: ViewPreferences;
  onPrefsChange: (newPrefs: ViewPreferences) => void;
  onResetView: () => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  previewPaneOpen: boolean;
  onTogglePreviewPane: () => void;
  // Windows Explorer Mode & Action Props
  windowsExplorerMode?: boolean;
  onToggleWindowsExplorerMode?: () => void;
  selectedCount?: number;
  hasClipboard?: boolean;
  onCut?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  onNewFolder?: () => void;
  onNewFile?: () => void;
  onRefresh?: () => void;
  onOpenInExplorer?: () => void;
  onOpenSettings?: () => void;
  showHiddenFiles?: boolean;
  onToggleShowHidden?: () => void;
  showExtensions?: boolean;
  onToggleShowExtensions?: () => void;
  onBakItUp?: () => void;
  onGroupTabs?: () => void;
  onAdminMode?: () => void;
  onChangeAttributes?: () => void;
}

export const ViewToolbar: React.FC<ViewToolbarProps> = ({
  viewMode,
  onViewModeChange,
  prefs,
  onPrefsChange,
  onResetView,
  zoom,
  onZoomChange,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  previewPaneOpen,
  onTogglePreviewPane,
  windowsExplorerMode = false,
  onToggleWindowsExplorerMode,
  selectedCount = 0,
  hasClipboard = false,
  onCut,
  onCopy,
  onPaste,
  onRename,
  onDelete,
  onShare,
  onNewFolder,
  onNewFile,
  onRefresh,
  onOpenInExplorer,
  onOpenSettings,
  showHiddenFiles = false,
  onToggleShowHidden,
  showExtensions = true,
  onToggleShowExtensions,
  onBakItUp,
  onGroupTabs,
  onAdminMode,
  onChangeAttributes,
}) => {
  const { dict } = useI18n();
  const [sortOpen, setSortOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const sortRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const newRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
      if (groupRef.current && !groupRef.current.contains(e.target as Node)) {
        setGroupOpen(false);
      }
      if (viewRef.current && !viewRef.current.contains(e.target as Node)) {
        setViewOpen(false);
      }
      if (newRef.current && !newRef.current.contains(e.target as Node)) {
        setNewOpen(false);
      }
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const sortFields: { id: SortField; label: string }[] = [
    { id: "name", label: dict.view.name },
    { id: "date_modified", label: dict.view.dateModified },
    { id: "extension", label: dict.view.type },
    { id: "size", label: dict.view.size },
    { id: "date_created", label: dict.view.dateCreated },
    { id: "date_accessed", label: dict.view.dateAccessed },
    { id: "attributes", label: dict.view.attributes },
  ];

  const groupModes: { id: GroupMode; label: string }[] = [
    { id: "none", label: dict.view.none },
    { id: "name_range", label: dict.view.name },
    { id: "date_modified", label: dict.view.dateModified },
    { id: "extension", label: dict.view.type },
    { id: "size", label: dict.view.size },
    { id: "date_created", label: dict.view.dateCreated },
    { id: "attributes", label: dict.view.attributes },
  ];

  const explorerViewModes: { id: ViewMode; label: string; shortcut: string }[] = [
    { id: "extra-large-icons", label: "Extra large icons", shortcut: "Ctrl+Shift+1" },
    { id: "large-icons", label: "Large icons", shortcut: "Ctrl+Shift+2" },
    { id: "medium-icons", label: "Medium icons", shortcut: "Ctrl+Shift+3" },
    { id: "small-icons", label: "Small icons", shortcut: "Ctrl+Shift+4" },
    { id: "list", label: "List", shortcut: "Ctrl+Shift+5" },
    { id: "details", label: "Details", shortcut: "Ctrl+Shift+6" },
    { id: "tiles", label: "Tiles", shortcut: "Ctrl+Shift+7" },
    { id: "content", label: "Content", shortcut: "Ctrl+Shift+8" },
  ];

  const activeGroupLabel =
    groupModes.find((g) => g.id === prefs.groupMode)?.label || prefs.groupMode;

  // Render Windows 11 File Explorer Command Bar
  if (windowsExplorerMode) {
    return (
      <div className={styles.commandBar}>
        {/* + New Dropdown Button */}
        <div className={styles.dropdownContainer} ref={newRef}>
          <button
            className={`${styles.commandBtn} ${newOpen ? styles.active : ""}`}
            onClick={() => setNewOpen(!newOpen)}
            title="Create new item"
          >
            <Plus size={16} />
            <span>New</span>
            <ChevronDown size={12} className={styles.chevron} />
          </button>

          {newOpen && (
            <div className={styles.menu}>
              <button
                className={styles.menuItem}
                onClick={() => {
                  setNewOpen(false);
                  onNewFolder?.();
                }}
              >
                <FolderPlus size={16} />
                <span>Folder</span>
                <span className={styles.shortcutLabel}>Ctrl+Shift+N</span>
              </button>
              <button
                className={styles.menuItem}
                onClick={() => {
                  setNewOpen(false);
                  onNewFile?.();
                }}
              >
                <FilePlus size={16} />
                <span>Text Document</span>
              </button>
            </div>
          )}
        </div>

        <div className={styles.commandDivider} />

        {/* Action Glyphs: Cut, Copy, Paste, Rename, Share, Delete */}
        <button
          className={`${styles.commandBtn} ${styles.iconOnlyBtn}`}
          onClick={onCut}
          disabled={selectedCount === 0}
          title="Cut (Ctrl+X)"
          aria-label="Cut"
        >
          <Scissors size={16} />
        </button>

        <button
          className={`${styles.commandBtn} ${styles.iconOnlyBtn}`}
          onClick={onCopy}
          disabled={selectedCount === 0}
          title="Copy (Ctrl+C)"
          aria-label="Copy"
        >
          <Copy size={16} />
        </button>

        <button
          className={`${styles.commandBtn} ${styles.iconOnlyBtn}`}
          onClick={onPaste}
          disabled={!hasClipboard}
          title="Paste (Ctrl+V)"
          aria-label="Paste"
        >
          <ClipboardPaste size={16} />
        </button>

        <button
          className={`${styles.commandBtn} ${styles.iconOnlyBtn}`}
          onClick={onRename}
          disabled={selectedCount !== 1}
          title="Rename (F2)"
          aria-label="Rename"
        >
          <Edit3 size={16} />
        </button>

        <button
          className={`${styles.commandBtn} ${styles.iconOnlyBtn}`}
          onClick={onShare}
          disabled={selectedCount === 0}
          title="Share"
          aria-label="Share"
        >
          <Share2 size={16} />
        </button>

        <button
          className={`${styles.commandBtn} ${styles.iconOnlyBtn}`}
          onClick={onDelete}
          disabled={selectedCount === 0}
          title="Delete (Del)"
          aria-label="Delete"
        >
          <Trash2 size={16} />
        </button>

        <div className={styles.commandDivider} />

        {/* Sort Dropdown */}
        <div className={styles.dropdownContainer} ref={sortRef}>
          <button
            className={`${styles.commandBtn} ${sortOpen ? styles.active : ""}`}
            onClick={() => {
              setSortOpen(!sortOpen);
              setViewOpen(false);
              setNewOpen(false);
              setMoreOpen(false);
            }}
            title="Sort options"
          >
            <ArrowUpDown size={15} />
            <span>Sort</span>
            <ChevronDown size={12} className={styles.chevron} />
          </button>

          {sortOpen && (
            <div className={styles.menu}>
              <div className={styles.menuHeader}>Sort by</div>
              {sortFields.map((f) => {
                const isSelected = prefs.sortField === f.id;
                return (
                  <button
                    key={f.id}
                    className={styles.menuItem}
                    onClick={() => {
                      onPrefsChange({ ...prefs, sortField: f.id });
                      setSortOpen(false);
                    }}
                  >
                    <span className={styles.menuCheck}>
                      {isSelected && <Check size={13} color="var(--accent)" />}
                    </span>
                    <span>{f.label}</span>
                  </button>
                );
              })}

              <div className={styles.menuDivider} />

              <button
                className={styles.menuItem}
                onClick={() => {
                  onPrefsChange({ ...prefs, sortDirection: "ascending" });
                  setSortOpen(false);
                }}
              >
                <span className={styles.menuCheck}>
                  {prefs.sortDirection === "ascending" && (
                    <Check size={13} color="var(--accent)" />
                  )}
                </span>
                <span>{dict.view.ascending}</span>
              </button>
              <button
                className={styles.menuItem}
                onClick={() => {
                  onPrefsChange({ ...prefs, sortDirection: "descending" });
                  setSortOpen(false);
                }}
              >
                <span className={styles.menuCheck}>
                  {prefs.sortDirection === "descending" && (
                    <Check size={13} color="var(--accent)" />
                  )}
                </span>
                <span>{dict.view.descending}</span>
              </button>

              <div className={styles.menuDivider} />

              <div className={styles.menuHeader}>Group by</div>
              {groupModes.map((g) => {
                const isSelected = prefs.groupMode === g.id;
                return (
                  <button
                    key={g.id}
                    className={styles.menuItem}
                    onClick={() => {
                      onPrefsChange({ ...prefs, groupMode: g.id });
                      setSortOpen(false);
                    }}
                  >
                    <span className={styles.menuCheck}>
                      {isSelected && <Check size={13} color="var(--accent)" />}
                    </span>
                    <span>{g.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* View Dropdown (all 8 Windows File Explorer modes) */}
        <div className={styles.dropdownContainer} ref={viewRef}>
          <button
            className={`${styles.commandBtn} ${viewOpen ? styles.active : ""}`}
            onClick={() => {
              setViewOpen(!viewOpen);
              setSortOpen(false);
              setNewOpen(false);
              setMoreOpen(false);
            }}
            title="View options"
          >
            <LayoutGrid size={15} />
            <span>View</span>
            <ChevronDown size={12} className={styles.chevron} />
          </button>

          {viewOpen && (
            <div className={styles.menu} style={{ minWidth: 240 }}>
              {explorerViewModes.map((m) => {
                const isSelected = viewMode === m.id;
                return (
                  <button
                    key={m.id}
                    className={styles.menuItem}
                    onClick={() => {
                      onViewModeChange(m.id);
                      setViewOpen(false);
                    }}
                  >
                    <span className={styles.menuCheck}>
                      {isSelected && <Check size={13} color="var(--accent)" />}
                    </span>
                    <span>{m.label}</span>
                    <span className={styles.shortcutLabel}>{m.shortcut}</span>
                  </button>
                );
              })}

              <div className={styles.menuDivider} />

              <button
                className={styles.menuItem}
                onClick={() => {
                  onToggleShowHidden?.();
                  setViewOpen(false);
                }}
              >
                <span className={styles.menuCheck}>
                  {showHiddenFiles && <Check size={13} color="var(--accent)" />}
                </span>
                <span>Show hidden items</span>
              </button>

              <button
                className={styles.menuItem}
                onClick={() => {
                  onToggleShowExtensions?.();
                  setViewOpen(false);
                }}
              >
                <span className={styles.menuCheck}>
                  {showExtensions && <Check size={13} color="var(--accent)" />}
                </span>
                <span>Show file name extensions</span>
              </button>

              <button
                className={styles.menuItem}
                onClick={() => {
                  onTogglePreviewPane();
                  setViewOpen(false);
                }}
              >
                <span className={styles.menuCheck}>
                  {previewPaneOpen && <Check size={13} color="var(--accent)" />}
                </span>
                <span>Preview pane</span>
                <span className={styles.shortcutLabel}>Alt+P</span>
              </button>
            </div>
          )}
        </div>

        {/* Preview Pane Quick Toggle */}
        <button
          className={`${styles.commandBtn} ${styles.iconOnlyBtn} ${
            previewPaneOpen ? styles.active : ""
          }`}
          onClick={onTogglePreviewPane}
          title="Preview pane (Alt+P)"
          aria-label="Preview pane"
        >
          <PanelRight size={16} />
        </button>

        {/* See More (...) */}
        <div className={styles.dropdownContainer} ref={moreRef}>
          <button
            className={`${styles.commandBtn} ${styles.iconOnlyBtn} ${
              moreOpen ? styles.active : ""
            }`}
            onClick={() => setMoreOpen(!moreOpen)}
            title="See more"
            aria-label="See more"
          >
            <MoreHorizontal size={16} />
          </button>

          {moreOpen && (
            <div className={styles.menu} style={{ minWidth: 230 }}>
              <button
                className={styles.menuItem}
                onClick={() => {
                  setMoreOpen(false);
                  onOpenInExplorer?.();
                }}
              >
                <ExternalLink size={15} />
                <span>Open in Windows File Explorer</span>
              </button>

              <button
                className={styles.menuItem}
                onClick={() => {
                  setMoreOpen(false);
                  onRefresh?.();
                }}
              >
                <RotateCw size={15} />
                <span>Refresh</span>
                <span className={styles.shortcutLabel}>F5</span>
              </button>

              <div className={styles.menuDivider} />

              {onBakItUp && (
                <button
                  className={styles.menuItem}
                  onClick={() => {
                    setMoreOpen(false);
                    onBakItUp();
                  }}
                >
                  <Archive size={15} />
                  <span>{dict.operations.bakItUp}</span>
                </button>
              )}

              {onGroupTabs && (
                <button
                  className={styles.menuItem}
                  onClick={() => {
                    setMoreOpen(false);
                    onGroupTabs();
                  }}
                >
                  <FolderSync size={15} />
                  <span>{dict.operations.groupTabs}</span>
                </button>
              )}

              {onChangeAttributes && (
                <button
                  className={styles.menuItem}
                  onClick={() => {
                    setMoreOpen(false);
                    onChangeAttributes();
                  }}
                  disabled={selectedCount === 0}
                >
                  <Sliders size={15} />
                  <span>{dict.operations.changeAttributes}</span>
                </button>
              )}

              {onAdminMode && (
                <button
                  className={styles.menuItem}
                  onClick={() => {
                    setMoreOpen(false);
                    onAdminMode();
                  }}
                >
                  <Shield size={15} />
                  <span>{dict.operations.adminMode}</span>
                </button>
              )}

              <div className={styles.menuDivider} />

              <button
                className={styles.menuItem}
                onClick={() => {
                  setMoreOpen(false);
                  onOpenSettings?.();
                }}
              >
                <Settings size={15} />
                <span>Options / Settings</span>
              </button>
            </div>
          )}
        </div>

        <div className={styles.spacer} />

        {/* Windows Explorer Mode Active Indicator & Toggle */}
        {onToggleWindowsExplorerMode && (
          <button
            className={`${styles.modeSwitcherBtn} ${styles.active}`}
            onClick={onToggleWindowsExplorerMode}
            title="Click to switch back to FinestFile Standard Mode"
          >
            <span className={styles.winIcon}>
              <WindowsLogo size={13} />
            </span>
            <span>Windows Explorer Mode</span>
          </button>
        )}
      </div>
    );
  }

  // Render Standard FinestFile Toolbar
  return (
    <div className={styles.toolbar}>
      {/* View Switcher (Details vs Grid) */}
      <div className={styles.buttonGroup}>
        <button
          className={`${styles.toolBtn} ${viewMode === "details" ? styles.active : ""}`}
          onClick={() => onViewModeChange("details")}
          title={dict.view.details}
        >
          <List size={15} />
          <span>{dict.view.details}</span>
        </button>
        <button
          className={`${styles.toolBtn} ${viewMode === "grid" || viewMode === "large-icons" ? styles.active : ""}`}
          onClick={() => onViewModeChange("grid")}
          title={dict.view.grid}
        >
          <LayoutGrid size={15} />
          <span>{dict.view.grid}</span>
        </button>
      </div>

      {/* Size / Zoom Control aligned seamlessly to the left next to view controls */}
      <div className={styles.zoomGroup} title={dict.view.view}>
        <button
          className={styles.zoomBtn}
          onClick={onZoomOut}
          disabled={zoom <= 32}
          title={dict.view.zoomOut}
          aria-label={dict.view.zoomOut}
        >
          <Minus size={13} />
        </button>

        <input
          type="range"
          className={styles.zoomSlider}
          min={32}
          max={320}
          step={8}
          value={zoom}
          onChange={(e) => onZoomChange(Number(e.target.value))}
          title={`${zoom} px`}
          aria-label={dict.view.view}
        />

        <button
          className={styles.zoomBtn}
          onClick={onZoomIn}
          disabled={zoom >= 320}
          title={dict.view.zoomIn}
          aria-label={dict.view.zoomIn}
        >
          <Plus size={13} />
        </button>

        <button
          className={styles.zoomIndicator}
          onClick={onZoomReset}
          title={dict.view.resetZoom}
        >
          {zoom} px
        </button>
      </div>

      <div className={styles.divider} />

      {/* Sort By Dropdown */}
      <div className={styles.dropdownContainer} ref={sortRef}>
        <button
          className={`${styles.toolBtn} ${sortOpen ? styles.open : ""}`}
          onClick={() => {
            setSortOpen(!sortOpen);
            setGroupOpen(false);
          }}
          title={dict.view.sortBy}
        >
          <ArrowUpDown size={15} />
          <span>{dict.view.sortBy}</span>
          <ChevronDown size={12} className={styles.chevron} />
        </button>

        {sortOpen && (
          <div className={styles.menu}>
            <div className={styles.menuHeader}>{dict.view.sortBy}</div>
            {sortFields.map((f) => {
              const isSelected = prefs.sortField === f.id;
              return (
                <button
                  key={f.id}
                  className={styles.menuItem}
                  onClick={() => {
                    onPrefsChange({ ...prefs, sortField: f.id });
                    setSortOpen(false);
                  }}
                >
                  <span className={styles.menuCheck}>
                    {isSelected && <Check size={13} color="var(--accent)" />}
                  </span>
                  <span>{f.label}</span>
                </button>
              );
            })}

            <div className={styles.menuDivider} />

            <button
              className={styles.menuItem}
              onClick={() => {
                onPrefsChange({ ...prefs, sortDirection: "ascending" });
                setSortOpen(false);
              }}
            >
              <span className={styles.menuCheck}>
                {prefs.sortDirection === "ascending" && (
                  <Check size={13} color="var(--accent)" />
                )}
              </span>
              <span>{dict.view.ascending}</span>
            </button>
            <button
              className={styles.menuItem}
              onClick={() => {
                onPrefsChange({ ...prefs, sortDirection: "descending" });
                setSortOpen(false);
              }}
            >
              <span className={styles.menuCheck}>
                {prefs.sortDirection === "descending" && (
                  <Check size={13} color="var(--accent)" />
                )}
              </span>
              <span>{dict.view.descending}</span>
            </button>

            <div className={styles.menuDivider} />

            <button
              className={styles.menuItem}
              onClick={() => {
                onPrefsChange({ ...prefs, foldersFirst: !prefs.foldersFirst });
                setSortOpen(false);
              }}
            >
              <span className={styles.menuCheck}>
                {prefs.foldersFirst && <Check size={13} color="var(--accent)" />}
              </span>
              <span>{dict.view.foldersFirst}</span>
            </button>
          </div>
        )}
      </div>

      {/* Group By Dropdown */}
      <div className={styles.dropdownContainer} ref={groupRef}>
        <button
          className={`${styles.toolBtn} ${prefs.groupMode !== "none" ? styles.hasGroup : ""} ${
            groupOpen ? styles.open : ""
          }`}
          onClick={() => {
            setGroupOpen(!groupOpen);
            setSortOpen(false);
          }}
          title={dict.view.groupBy}
        >
          <Layers size={15} />
          <span>
            {dict.view.groupBy}
            {prefs.groupMode !== "none" ? ` (${activeGroupLabel})` : ""}
          </span>
          <ChevronDown size={12} className={styles.chevron} />
        </button>

        {groupOpen && (
          <div className={styles.menu}>
            <div className={styles.menuHeader}>{dict.view.groupBy}</div>
            {groupModes.map((g) => {
              const isSelected = prefs.groupMode === g.id;
              return (
                <button
                  key={g.id}
                  className={styles.menuItem}
                  onClick={() => {
                    onPrefsChange({ ...prefs, groupMode: g.id });
                    setGroupOpen(false);
                  }}
                >
                  <span className={styles.menuCheck}>
                    {isSelected && <Check size={13} color="var(--accent)" />}
                  </span>
                  <span>{g.label}</span>
                </button>
              );
            })}

            {prefs.groupMode !== "none" && (
              <>
                <div className={styles.menuDivider} />

                <button
                  className={styles.menuItem}
                  onClick={() => {
                    onPrefsChange({ ...prefs, groupDirection: "ascending" });
                    setGroupOpen(false);
                  }}
                >
                  <span className={styles.menuCheck}>
                    {prefs.groupDirection === "ascending" && (
                      <Check size={13} color="var(--accent)" />
                    )}
                  </span>
                  <span>{dict.view.ascending}</span>
                </button>
                <button
                  className={styles.menuItem}
                  onClick={() => {
                    onPrefsChange({ ...prefs, groupDirection: "descending" });
                    setGroupOpen(false);
                  }}
                >
                  <span className={styles.menuCheck}>
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

      {/* Bak-it-Up! Button */}
      {onBakItUp && (
        <button
          className={`${styles.toolBtn} ${styles.bakItUpBtn}`}
          onClick={onBakItUp}
          title={dict.operations.bakItUp}
        >
          <Archive size={14} />
          <span>{dict.operations.bakItUp}</span>
        </button>
      )}

      {/* Grupla Tab Grouping Button */}
      {onGroupTabs && (
        <button
          className={styles.toolBtn}
          onClick={onGroupTabs}
          title={dict.operations.groupTabs}
        >
          <FolderSync size={14} />
          <span>{dict.operations.groupTabs}</span>
        </button>
      )}

      {/* Change Attributes Button */}
      {onChangeAttributes && (
        <button
          className={styles.toolBtn}
          onClick={onChangeAttributes}
          disabled={selectedCount === 0}
          title={dict.operations.changeAttributes}
        >
          <Sliders size={14} />
          <span>{dict.operations.changeAttributes}</span>
        </button>
      )}

      {/* Administrator Mode Button */}
      {onAdminMode && (
        <button
          className={styles.toolBtn}
          onClick={onAdminMode}
          title={dict.operations.adminMode}
        >
          <Shield size={14} />
          <span>{dict.operations.adminMode}</span>
        </button>
      )}

      <div className={styles.divider} />

      {/* Preview Pane Toggle Button */}
      <button
        className={`${styles.toolBtn} ${previewPaneOpen ? styles.active : ""}`}
        onClick={onTogglePreviewPane}
        title={`${dict.view.previewPane} (Alt + P)`}
      >
        <PanelRight size={15} />
        <span>{dict.view.previewPane}</span>
      </button>

      <div className={styles.divider} />

      {/* Reset View Button */}
      <button
        className={styles.toolBtn}
        onClick={onResetView}
        title={dict.view.resetView}
      >
        <RotateCcw size={14} />
        <span>{dict.view.resetView}</span>
      </button>

      <div className={styles.spacer} />

      {/* Switch to Windows Explorer Mode Toggle Button */}
      {onToggleWindowsExplorerMode && (
        <button
          className={styles.modeSwitcherBtn}
          onClick={onToggleWindowsExplorerMode}
          title="Switch to authentic Windows 11 File Explorer view"
        >
          <span className={styles.winIcon}>
            <WindowsLogo size={13} />
          </span>
          <span>Switch to Windows View</span>
        </button>
      )}
    </div>
  );
};
