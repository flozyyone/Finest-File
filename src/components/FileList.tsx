import React, { useState } from "react";
import { FileEntry, FileGroup, SortField, ViewPreferences } from "../types";
import { FileIcon } from "./FileIcon";
import { formatBytes, formatDate } from "../utils/format";
import { ChevronDown, ChevronRight } from "lucide-react";
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
}) => {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

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
    const lastDot = entry.name.lastIndexOf(".");
    return lastDot > 0 ? entry.name.substring(0, lastDot) : entry.name;
  };

  const handleRowClick = (e: React.MouseEvent, entry: FileEntry) => {
    e.stopPropagation();
    onSelect(entry, e.ctrlKey || e.metaKey, e.shiftKey);
  };

  // Filter hidden files per group
  const processedGroups = groups.map((g) => ({
    ...g,
    items: g.items.filter((e) => {
      if (!showHidden && (e.hidden || e.system)) return false;
      return true;
    }),
  })).filter((g) => g.items.length > 0);

  const totalItemsCount = processedGroups.reduce((acc, g) => acc + g.items.length, 0);

  if (totalItemsCount === 0) {
    return (
      <div
        className={styles.emptyContainer}
        onContextMenu={(e) => onContextMenu(e)}
      >
        <span className={styles.emptyText}>This folder is empty.</span>
      </div>
    );
  }

  const isGrouped = prefs.groupMode !== "none" && processedGroups.length > 0;

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
          <FileIcon kind={entry.kind} ext={entry.ext} size={42} />
        </div>

        {isRenaming ? (
          <input
            type="text"
            className={styles.inlineRenameInput}
            defaultValue={entry.name}
            autoFocus
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
          <span className={styles.gridLabel}>{renderDisplayName(entry)}</span>
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
              className={styles.inlineRenameInput}
              defaultValue={entry.name}
              autoFocus
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
            <span className={styles.cellText}>{renderDisplayName(entry)}</span>
          )}
        </div>

        <div className={`${styles.cell} ${styles.colModified}`}>
          <span className={styles.cellSubtle}>{formatDate(entry.modified)}</span>
        </div>

        <div className={`${styles.cell} ${styles.colType}`}>
          <span className={styles.cellSubtle}>
            {entry.kind === "directory"
              ? "File folder"
              : entry.ext
              ? `${entry.ext.toUpperCase()} File`
              : "File"}
          </span>
        </div>

        <div className={`${styles.cell} ${styles.colSize}`}>
          <span className={styles.cellSubtle}>
            {entry.kind === "directory" ? "" : formatBytes(entry.size)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div
      className={styles.listContainer}
      onContextMenu={(e) => onContextMenu(e)}
      onClick={() => onSelect({} as FileEntry, false, false)}
    >
      {/* Details View Column Headers (Only sticky in details view) */}
      {viewMode === "details" && (
        <div className={styles.headerRow}>
          <div
            className={`${styles.headerCell} ${styles.colName}`}
            onClick={() => onSortChange("name")}
            title="Sort by Name"
          >
            <span>Name</span>
            {prefs.sortField === "name" && (
              <span className={styles.sortIndicator}>
                {prefs.sortDirection === "ascending" ? " ▲" : " ▼"}
              </span>
            )}
          </div>
          <div
            className={`${styles.headerCell} ${styles.colModified}`}
            onClick={() => onSortChange("date_modified")}
            title="Sort by Date modified"
          >
            <span>Date modified</span>
            {prefs.sortField === "date_modified" && (
              <span className={styles.sortIndicator}>
                {prefs.sortDirection === "ascending" ? " ▲" : " ▼"}
              </span>
            )}
          </div>
          <div
            className={`${styles.headerCell} ${styles.colType}`}
            onClick={() => onSortChange("extension")}
            title="Sort by Type"
          >
            <span>Type</span>
            {prefs.sortField === "extension" && (
              <span className={styles.sortIndicator}>
                {prefs.sortDirection === "ascending" ? " ▲" : " ▼"}
              </span>
            )}
          </div>
          <div
            className={`${styles.headerCell} ${styles.colSize}`}
            onClick={() => onSortChange("size")}
            title="Sort by Size"
          >
            <span>Size</span>
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
              {/* Group Header (shown when groupMode != none) */}
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
                      <ChevronRight size={14} className={styles.chevron} />
                    ) : (
                      <ChevronDown size={14} className={styles.chevron} />
                    )}
                  </button>
                  <span className={styles.groupTitle}>{group.title}</span>
                  <span className={styles.groupCount}>({group.items.length})</span>
                  {group.totalBytes > 0 && (
                    <span className={styles.groupSizeTotal}>
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
                    <div className={styles.gridSubContainer}>
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
