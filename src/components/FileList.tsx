import React, { useState } from "react";
import { FileEntry } from "../types";
import { FileIcon } from "./FileIcon";
import { formatBytes, formatDate } from "../utils/format";
import styles from "./FileList.module.css";

interface FileListProps {
  entries: FileEntry[];
  viewMode: "details" | "grid";
  selectedPaths: string[];
  onSelect: (entry: FileEntry, multi: boolean, range: boolean) => void;
  onOpen: (entry: FileEntry) => void;
  onContextMenu: (e: React.MouseEvent, entry?: FileEntry) => void;
  renamingPath: string | null;
  onRenameSubmit: (newName: string) => void;
  onRenameCancel: () => void;
  sortBy: "name" | "size" | "type" | "modified";
  sortOrder: "asc" | "desc";
  onSortChange: (column: "name" | "size" | "type" | "modified") => void;
  showExtensions: boolean;
  showHidden: boolean;
}

export const FileList: React.FC<FileListProps> = ({
  entries,
  viewMode,
  selectedPaths,
  onSelect,
  onOpen,
  onContextMenu,
  renamingPath,
  onRenameSubmit,
  onRenameCancel,
  sortBy,
  sortOrder,
  onSortChange,
  showExtensions,
  showHidden,
}) => {
  const [renameText, setRenameText] = useState("");

  const visibleEntries = entries.filter((e) => {
    if (!showHidden && (e.hidden || e.system)) return false;
    return true;
  });

  const sortedEntries = [...visibleEntries].sort((a, b) => {
    // Folders always on top (matching Windows File Explorer)
    const aIsDir = a.kind === "directory" || a.linkToDir;
    const bIsDir = b.kind === "directory" || b.linkToDir;
    if (aIsDir && !bIsDir) return -1;
    if (!aIsDir && bIsDir) return 1;

    let res = 0;
    if (sortBy === "name") {
      res = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
    } else if (sortBy === "size") {
      res = (a.size || 0) - (b.size || 0);
    } else if (sortBy === "type") {
      res = a.ext.localeCompare(b.ext);
    } else if (sortBy === "modified") {
      res = (a.modified || 0) - (b.modified || 0);
    }

    return sortOrder === "asc" ? res : -res;
  });

  const renderDisplayName = (entry: FileEntry) => {
    if (entry.kind === "directory" || showExtensions || !entry.ext) {
      return entry.name;
    }
    // Hide extension if setting disabled
    const lastDot = entry.name.lastIndexOf(".");
    return lastDot > 0 ? entry.name.substring(0, lastDot) : entry.name;
  };

  const handleRowClick = (e: React.MouseEvent, entry: FileEntry) => {
    e.stopPropagation();
    onSelect(entry, e.ctrlKey || e.metaKey, e.shiftKey);
  };

  if (sortedEntries.length === 0) {
    return (
      <div
        className={styles.emptyContainer}
        onContextMenu={(e) => onContextMenu(e)}
      >
        <span className={styles.emptyText}>This folder is empty.</span>
      </div>
    );
  }

  if (viewMode === "grid") {
    return (
      <div
        className={styles.gridContainer}
        onContextMenu={(e) => onContextMenu(e)}
        onClick={() => onSelect({} as FileEntry, false, false)}
      >
        {sortedEntries.map((entry) => {
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
        })}
      </div>
    );
  }

  // Details List View
  return (
    <div
      className={styles.listContainer}
      onContextMenu={(e) => onContextMenu(e)}
      onClick={() => onSelect({} as FileEntry, false, false)}
    >
      <div className={styles.headerRow}>
        <div
          className={`${styles.headerCell} ${styles.colName}`}
          onClick={() => onSortChange("name")}
        >
          <span>Name</span>
          {sortBy === "name" && (
            <span className={styles.sortIndicator}>{sortOrder === "asc" ? " ▲" : " ▼"}</span>
          )}
        </div>
        <div
          className={`${styles.headerCell} ${styles.colModified}`}
          onClick={() => onSortChange("modified")}
        >
          <span>Date modified</span>
          {sortBy === "modified" && (
            <span className={styles.sortIndicator}>{sortOrder === "asc" ? " ▲" : " ▼"}</span>
          )}
        </div>
        <div
          className={`${styles.headerCell} ${styles.colType}`}
          onClick={() => onSortChange("type")}
        >
          <span>Type</span>
          {sortBy === "type" && (
            <span className={styles.sortIndicator}>{sortOrder === "asc" ? " ▲" : " ▼"}</span>
          )}
        </div>
        <div
          className={`${styles.headerCell} ${styles.colSize}`}
          onClick={() => onSortChange("size")}
        >
          <span>Size</span>
          {sortBy === "size" && (
            <span className={styles.sortIndicator}>{sortOrder === "asc" ? " ▲" : " ▼"}</span>
          )}
        </div>
      </div>

      <div className={styles.rowsBody}>
        {sortedEntries.map((entry) => {
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
                  {entry.kind === "directory" ? "File folder" : entry.ext ? `${entry.ext.toUpperCase()} File` : "File"}
                </span>
              </div>

              <div className={`${styles.cell} ${styles.colSize}`}>
                <span className={styles.cellSubtle}>
                  {entry.kind === "directory" ? "" : formatBytes(entry.size)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
