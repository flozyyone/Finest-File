import React, { useState, useRef, useEffect } from "react";
import { FileEntry, FileGroup, SortField, ViewPreferences } from "../types";
import { FileIcon } from "./FileIcon";
import { formatBytes } from "../utils/format";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useI18n } from "../i18n";
import styles from "./FileList.module.css";

interface FileListProps {
  groups: FileGroup[];
  viewMode: "details" | "grid";
  prefs: ViewPreferences;
  onSortChange: (field: SortField) => void;
  selectedPaths: string[];
  onSelect: (entry: FileEntry, multi: boolean, range: boolean) => void;
  onOpen: (entry: FileEntry) => void;
  onContextMenu: (e: React.MouseEvent, entry?: FileEntry) => void;
  renamingPath: string | null;
  onRenameSubmit: (newName: string) => void;
  onRenameCancel: () => void;
  showExtensions: boolean;
  showHidden: boolean;
  gridZoom?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onGoUp?: () => void;
}

export const FileList: React.FC<FileListProps> = ({
  groups,
  viewMode,
  prefs,
  onSortChange,
  selectedPaths,
  onSelect,
  onOpen,
  onContextMenu,
  renamingPath,
  onRenameSubmit,
  onRenameCancel,
  showExtensions,
  showHidden,
  gridZoom = 96,
  onZoomIn,
  onZoomOut,
  onGoUp,
}) => {
  const { dict, formatDateTime, dir } = useI18n();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const renderDisplayName = (entry: FileEntry) => {
    if (entry.kind === "directory" || showExtensions || !entry.ext) {
      return entry.name;
    }
    const dotIndex = entry.name.lastIndexOf(".");
    return dotIndex > 0 ? entry.name.substring(0, dotIndex) : entry.name;
  };

  const processedGroups = groups.map((g) => ({
    ...g,
    items: g.items.filter((item) => showHidden || !item.hidden),
  }));

  const allItems = processedGroups.flatMap((g) => g.items);
  const totalItemsCount = allItems.length;

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, [selectedPaths]);

  const handleRowClick = (e: React.MouseEvent, entry: FileEntry) => {
    e.stopPropagation();
    const isMulti = e.ctrlKey || e.metaKey;
    const isRange = e.shiftKey;
    onSelect(entry, isMulti, isRange);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (renamingPath !== null) return;

    if (e.key === "Enter") {
      if (selectedPaths.length === 1) {
        const found = allItems.find((en) => en.path === selectedPaths[0]);
        if (found) {
          e.preventDefault();
          onOpen(found);
        }
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (allItems.length === 0) return;
      if (selectedPaths.length === 0) {
        onSelect(allItems[0], false, false);
      } else {
        const lastSelected = selectedPaths[selectedPaths.length - 1];
        const curIdx = allItems.findIndex((en) => en.path === lastSelected);
        const nextIdx = Math.min(allItems.length - 1, curIdx + 1);
        onSelect(allItems[nextIdx], e.ctrlKey, e.shiftKey);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (allItems.length === 0) return;
      if (selectedPaths.length === 0) {
        onSelect(allItems[0], false, false);
      } else {
        const lastSelected = selectedPaths[selectedPaths.length - 1];
        const curIdx = allItems.findIndex((en) => en.path === lastSelected);
        const prevIdx = Math.max(0, curIdx - 1);
        onSelect(allItems[prevIdx], e.ctrlKey, e.shiftKey);
      }
    } else if (e.key === "Home") {
      e.preventDefault();
      if (allItems.length > 0) onSelect(allItems[0], false, false);
    } else if (e.key === "End") {
      e.preventDefault();
      if (allItems.length > 0) onSelect(allItems[allItems.length - 1], false, false);
    } else if (e.key === "Backspace") {
      if (onGoUp) {
        e.preventDefault();
        onGoUp();
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      if (e.deltaY < 0 && onZoomIn) {
        onZoomIn();
      } else if (e.deltaY > 0 && onZoomOut) {
        onZoomOut();
      }
    }
  };

  if (totalItemsCount === 0) {
    return (
      <div
        className={styles.emptyContainer}
        onContextMenu={(e) => onContextMenu(e)}
      >
        <span className={styles.emptyText}>{dict.errors.emptyFolder}</span>
      </div>
    );
  }

  const isGrouped = prefs.groupMode !== "none" && processedGroups.length > 0;
  const iconSize = Math.max(28, Math.min(84, Math.round(gridZoom * 0.44)));

  const renderGridItem = (entry: FileEntry) => {
    const isSelected = selectedPaths.includes(entry.path);
    const isRenaming = renamingPath === entry.path;

    return (
      <div
        key={entry.path}
        className={`${styles.gridItem} ${isSelected ? styles.selected : ""}`}
        onClick={(e) => handleRowClick(e, entry)}
        onDoubleClick={() => onOpen(entry)}
        onContextMenu={(e) => {
          e.stopPropagation();
          if (!isSelected) onSelect(entry, false, false);
          onContextMenu(e, entry);
        }}
        title={entry.name}
      >
        <div className={styles.gridIcon}>
          <FileIcon kind={entry.kind} ext={entry.ext} size={iconSize} />
        </div>

        {isRenaming ? (
          <input
            type="text"
            className={`${styles.inlineRenameInput} fileName`}
            defaultValue={entry.name}
            autoFocus
            dir="ltr"
            onFocus={(e) => {
              const dot = entry.name.lastIndexOf(".");
              if (dot > 0 && entry.kind === "file") {
                e.target.setSelectionRange(0, dot);
              } else {
                e.target.select();
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") onRenameSubmit(e.currentTarget.value);
              if (e.key === "Escape") onRenameCancel();
            }}
            onBlur={(e) => onRenameSubmit(e.currentTarget.value)}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={`${styles.gridLabel} fileName`} dir="ltr">
            {renderDisplayName(entry)}
          </span>
        )}
      </div>
    );
  };

  const renderDetailRow = (entry: FileEntry) => {
    const isSelected = selectedPaths.includes(entry.path);
    const isRenaming = renamingPath === entry.path;

    return (
      <div
        key={entry.path}
        className={`${styles.row} ${isSelected ? styles.selected : ""}`}
        onClick={(e) => handleRowClick(e, entry)}
        onDoubleClick={() => onOpen(entry)}
        onContextMenu={(e) => {
          e.stopPropagation();
          if (!isSelected) onSelect(entry, false, false);
          onContextMenu(e, entry);
        }}
      >
        <div className={`${styles.cell} ${styles.colName}`}>
          <FileIcon kind={entry.kind} ext={entry.ext} size={16} />
          {isRenaming ? (
            <input
              type="text"
              className={`${styles.inlineRenameInput} fileName`}
              defaultValue={entry.name}
              autoFocus
              dir="ltr"
              onFocus={(e) => {
                const dot = entry.name.lastIndexOf(".");
                if (dot > 0 && entry.kind === "file") {
                  e.target.setSelectionRange(0, dot);
                } else {
                  e.target.select();
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") onRenameSubmit(e.currentTarget.value);
                if (e.key === "Escape") onRenameCancel();
              }}
              onBlur={(e) => onRenameSubmit(e.currentTarget.value)}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className={`${styles.nameText} ${entry.hidden ? styles.hiddenEntry : ""} fileName`}
              dir="ltr"
            >
              {renderDisplayName(entry)}
            </span>
          )}
        </div>

        <div className={`${styles.cell} ${styles.colDate}`}>
          {entry.modified ? formatDateTime(entry.modified) : "—"}
        </div>

        <div className={`${styles.cell} ${styles.colType}`}>
          {entry.kind === "directory" ? "Folder" : entry.ext ? entry.ext.toUpperCase() + " File" : "File"}
        </div>

        <div className={`${styles.cell} ${styles.colSize} fileSize`} dir="ltr">
          {entry.kind === "directory" ? "" : formatBytes(entry.size)}
        </div>
      </div>
    );
  };

  return (
    <div
      className={styles.container}
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onWheel={handleWheel}
      onContextMenu={(e) => onContextMenu(e)}
    >
      {/* Details View Header */}
      {viewMode === "details" && (
        <div className={styles.header}>
          <div
            className={`${styles.headerCell} ${styles.colName}`}
            onClick={() => onSortChange("name")}
            title={dict.view.name}
          >
            <span>{dict.view.name}</span>
            {prefs.sortField === "name" && (
              <span className={styles.sortIndicator}>
                {prefs.sortDirection === "ascending" ? " ▲" : " ▼"}
              </span>
            )}
          </div>
          <div
            className={`${styles.headerCell} ${styles.colDate}`}
            onClick={() => onSortChange("date_modified")}
            title={dict.view.dateModified}
          >
            <span>{dict.view.dateModified}</span>
            {prefs.sortField === "date_modified" && (
              <span className={styles.sortIndicator}>
                {prefs.sortDirection === "ascending" ? " ▲" : " ▼"}
              </span>
            )}
          </div>
          <div
            className={`${styles.headerCell} ${styles.colType}`}
            onClick={() => onSortChange("extension")}
            title={dict.view.type}
          >
            <span>{dict.view.type}</span>
            {prefs.sortField === "extension" && (
              <span className={styles.sortIndicator}>
                {prefs.sortDirection === "ascending" ? " ▲" : " ▼"}
              </span>
            )}
          </div>
          <div
            className={`${styles.headerCell} ${styles.colSize}`}
            onClick={() => onSortChange("size")}
            title={dict.view.size}
          >
            <span>{dict.view.size}</span>
            {prefs.sortField === "size" && (
              <span className={styles.sortIndicator}>
                {prefs.sortDirection === "ascending" ? " ▲" : " ▼"}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Render groups */}
      <div className={styles.contentBody}>
        {processedGroups.map((group) => {
          const isCollapsed = !!collapsedGroups[group.key];

          return (
            <div key={group.key} className={styles.groupSection}>
              {/* Group Header */}
              {isGrouped && (
                <div
                  className={styles.groupHeader}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleGroup(group.key);
                  }}
                  title="Click to collapse / expand group"
                >
                  <button className={styles.groupToggleBtn} aria-label="Toggle group">
                    {isCollapsed ? (
                      <ChevronRight size={14} className={`${styles.chevron} ${dir === "rtl" ? "rtlMirror" : ""}`} />
                    ) : (
                      <ChevronDown size={14} className={styles.chevron} />
                    )}
                  </button>
                  <span className={styles.groupTitle}>{group.title}</span>
                  <span className={styles.groupCount}>({group.items.length})</span>
                  {group.totalBytes > 0 && (
                    <span className={`${styles.groupSizeTotal} fileSize`} dir="ltr">
                      {formatBytes(group.totalBytes)}
                    </span>
                  )}
                  <div className={styles.groupDivider} />
                </div>
              )}

              {/* Group Items */}
              {!isCollapsed && (
                <>
                  {viewMode === "grid" ? (
                    <div
                      className={styles.gridSubContainer}
                      style={{
                        gridTemplateColumns: `repeat(auto-fill, minmax(${gridZoom}px, 1fr))`,
                        gridAutoRows: `${gridZoom}px`,
                      }}
                    >
                      {group.items.map((entry) => renderGridItem(entry))}
                    </div>
                  ) : (
                    <div className={styles.rowsSubContainer}>
                      {group.items.map((entry) => renderDetailRow(entry))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
