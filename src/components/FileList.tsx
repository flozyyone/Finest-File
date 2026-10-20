import React, { useState, useRef, useEffect, useMemo } from "react";
import { FileEntry, FileGroup, SortField, ViewPreferences, ViewMode } from "../types";
import { FileIcon } from "./FileIcon";
import { formatBytes } from "../utils/format";
import { ChevronDown, ChevronRight, Film, Music } from "lucide-react";
import { useI18n } from "../i18n";
import { api } from "../api";
import { convertFileSrc } from "@tauri-apps/api/core";
import styles from "./FileList.module.css";

const VIDEO_EXTS = new Set([
  "mp4", "mkv", "mov", "webm", "avi", "wmv", "m4v", "3gp"
]);

const IMAGE_EXTS = new Set([
  "jpg", "jpeg", "png", "webp", "bmp", "gif", "tiff", "tif", "svg"
]);

const AUDIO_EXTS = new Set([
  "mp3", "flac", "m4a", "aac", "ogg", "wav", "wma", "aiff", "alac", "opus"
]);

const THUMBNAIL_EXTS = new Set([...VIDEO_EXTS, ...IMAGE_EXTS, ...AUDIO_EXTS]);

interface FileListProps {
  groups: FileGroup[];
  viewMode: ViewMode;
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
  currentPath?: string;
  windowsExplorerMode?: boolean;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onGoUp?: () => void;
  onSpacePress?: (path: string) => void;
}

function extractVideoFrame(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    try {
      video.src = convertFileSrc(filePath);
    } catch (err) {
      reject(err);
      return;
    }
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.currentTime = 0.5;

    let resolved = false;
    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
    };

    video.onseeked = () => {
      if (resolved) return;
      resolved = true;
      try {
        const canvas = document.createElement("canvas");
        const aspect = (video.videoWidth && video.videoHeight) ? video.videoWidth / video.videoHeight : 16 / 9;
        canvas.width = 320;
        canvas.height = Math.round(320 / aspect);
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          cleanup();
          resolve(dataUrl);
          return;
        }
      } catch {
        // ignore
      }
      cleanup();
      reject(new Error("Canvas draw failed"));
    };

    video.onerror = () => {
      if (resolved) return;
      resolved = true;
      cleanup();
      reject(new Error("Video load failed"));
    };

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        reject(new Error("Video timeout"));
      }
    }, 2500);
  });
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
  currentPath,
  windowsExplorerMode = false,
  onZoomIn,
  onZoomOut,
  onGoUp,
  onSpacePress,
}) => {
  const { dict, formatDateTime, dir } = useI18n();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const loadedPathsRef = useRef<Set<string>>(new Set());
  const fetchingPathsRef = useRef<Set<string>>(new Set());

  // Clear cached thumbnails when navigating to a different folder
  useEffect(() => {
    loadedPathsRef.current.clear();
    fetchingPathsRef.current.clear();
    setThumbnails({});
  }, [currentPath]);

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

  const processedGroups = useMemo(() => {
    return groups.map((g) => ({
      ...g,
      items: g.items.filter((item) => showHidden || !item.hidden),
    }));
  }, [groups, showHidden]);

  const allItems = useMemo(() => {
    return processedGroups.flatMap((g) => g.items);
  }, [processedGroups]);

  const totalItemsCount = allItems.length;

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, [selectedPaths]);

  // Fast offline thumbnail loader for media items
  // Note: Runs for all thumbnail-capable view modes (grid, tiles, content, large/extra-large/medium icons)
  useEffect(() => {
    if (viewMode === "details" || viewMode === "list") return;

    let active = true;
    const itemsToFetch = allItems.filter(
      (item) =>
        item.kind !== "directory" &&
        THUMBNAIL_EXTS.has(item.ext.toLowerCase()) &&
        !loadedPathsRef.current.has(item.path) &&
        !fetchingPathsRef.current.has(item.path)
    );

    if (itemsToFetch.length === 0) return;

    // For standard webview images, convertFileSrc is instant offline!
    const newThumbs: Record<string, string> = {};
    const remainingToFetch: typeof itemsToFetch = [];

    for (const item of itemsToFetch) {
      const ext = item.ext.toLowerCase();
      if (["jpg", "jpeg", "png", "webp", "gif", "svg", "bmp"].includes(ext)) {
        try {
          const src = convertFileSrc(item.path);
          newThumbs[item.path] = src;
          loadedPathsRef.current.add(item.path);
        } catch {
          remainingToFetch.push(item);
        }
      } else {
        remainingToFetch.push(item);
      }
    }

    if (Object.keys(newThumbs).length > 0) {
      setThumbnails((prev) => ({ ...prev, ...newThumbs }));
    }

    // For remaining items (videos, TIFF, etc.), query getFileThumbnail with video frame fallback
    // Process smoothly in bounded concurrent chunks of 6 with batched state updates
    let isCancelled = false;
    (async () => {
      for (let i = 0; i < remainingToFetch.length; i += 6) {
        if (!active || isCancelled) break;
        const chunk = remainingToFetch.slice(i, i + 6);
        const chunkResults: Record<string, string> = {};

        await Promise.all(
          chunk.map(async (item) => {
            if (!active || isCancelled) return;
            fetchingPathsRef.current.add(item.path);
            const isVideo = VIDEO_EXTS.has(item.ext.toLowerCase());

            try {
              const res = await api.getFileThumbnail(item.path, 256);
              fetchingPathsRef.current.delete(item.path);
              if (active && !isCancelled && res?.dataUrl) {
                loadedPathsRef.current.add(item.path);
                chunkResults[item.path] = res.dataUrl;
                return;
              }
            } catch {
              // fallback below
            }

            if (isVideo) {
              try {
                const frameUrl = await extractVideoFrame(item.path);
                fetchingPathsRef.current.delete(item.path);
                if (active && !isCancelled && frameUrl) {
                  loadedPathsRef.current.add(item.path);
                  chunkResults[item.path] = frameUrl;
                  return;
                }
              } catch {
                fetchingPathsRef.current.delete(item.path);
                loadedPathsRef.current.add(item.path);
              }
            } else {
              fetchingPathsRef.current.delete(item.path);
              loadedPathsRef.current.add(item.path);
            }
          })
        );

        if (active && !isCancelled && Object.keys(chunkResults).length > 0) {
          setThumbnails((prev) => ({ ...prev, ...chunkResults }));
        }
      }
    })();

    return () => {
      active = false;
      isCancelled = true;
    };
  }, [allItems, viewMode]);

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
    } else if (e.code === "Space") {
      if (selectedPaths.length > 0 && onSpacePress) {
        e.preventDefault();
        onSpacePress(selectedPaths[0]);
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

  let effectiveGridZoom = gridZoom;
  if (viewMode === "extra-large-icons") effectiveGridZoom = 256;
  else if (viewMode === "large-icons") effectiveGridZoom = 96;
  else if (viewMode === "medium-icons") effectiveGridZoom = 48;
  else if (viewMode === "small-icons") effectiveGridZoom = 24;

  const iconSize = Math.max(20, Math.min(128, Math.round(effectiveGridZoom * 0.48)));
  const detailsRowHeight = Math.max(26, Math.min(44, Math.round(28 + (gridZoom - 96) * 0.08)));
  const detailsIconSize = Math.max(14, Math.min(22, Math.round(16 + (gridZoom - 96) * 0.04)));

  const renderGridItem = (entry: FileEntry) => {
    const isSelected = selectedPaths.includes(entry.path);
    const isRenaming = renamingPath === entry.path;
    const thumbUrl = thumbnails[entry.path];
    const thumbBoxHeight = Math.max(24, Math.round(effectiveGridZoom * 0.72));
    const isVideo = entry.kind !== "directory" && VIDEO_EXTS.has(entry.ext.toLowerCase());
    const isImage = entry.kind !== "directory" && IMAGE_EXTS.has(entry.ext.toLowerCase());
    const isAudio = entry.kind !== "directory" && AUDIO_EXTS.has(entry.ext.toLowerCase());
    const filmstripWidth = Math.min(effectiveGridZoom - 6, Math.round(thumbBoxHeight * 1.38));

    return (
      <div
        key={entry.path}
        className={`${styles.gridItem} ${isSelected ? styles.selected : ""}`}
        style={{ height: `${effectiveGridZoom + 30}px`, minHeight: `${effectiveGridZoom + 30}px` }}
        onClick={(e) => handleRowClick(e, entry)}
        onDoubleClick={() => onOpen(entry)}
        onContextMenu={(e) => {
          e.stopPropagation();
          if (!isSelected) onSelect(entry, false, false);
          onContextMenu(e, entry);
        }}
        title={entry.name}
      >
        <div
          className={styles.gridIcon}
          style={{ width: "100%", height: `${thumbBoxHeight}px` }}
        >
          {isVideo ? (
            windowsExplorerMode ? (
              <div className={styles.cleanVideoPoster}>
                {thumbUrl ? (
                  <img
                    src={thumbUrl}
                    alt={entry.name}
                    className={styles.cleanVideoImg}
                  />
                ) : (
                  <Film size={Math.max(16, Math.round(iconSize * 0.5))} color="#8a8a8a" />
                )}
                <div className={styles.videoBadge} title="Video">
                  <Film size={10} color="#ffffff" />
                </div>
              </div>
            ) : (
              <div
                className={styles.videoFilmstrip}
                style={{
                  width: `${filmstripWidth}px`,
                  maxWidth: "100%",
                  height: `${thumbBoxHeight}px`,
                }}
              >
                <div className={styles.sprocketColumn}>
                  <div className={styles.sprocketHole} />
                  <div className={styles.sprocketHole} />
                  <div className={styles.sprocketHole} />
                  <div className={styles.sprocketHole} />
                </div>

                <div className={styles.videoPosterBox}>
                  {thumbUrl ? (
                    <img
                      src={thumbUrl}
                      alt={entry.name}
                      className={styles.videoPosterImg}
                    />
                  ) : (
                    <Film size={Math.max(16, Math.round(iconSize * 0.5))} color="#8a8a8a" />
                  )}
                  <div className={styles.videoBadge} title="Video">
                    <Film size={10} color="#ffffff" />
                  </div>
                </div>

                <div className={styles.sprocketColumn}>
                  <div className={styles.sprocketHole} />
                  <div className={styles.sprocketHole} />
                  <div className={styles.sprocketHole} />
                  <div className={styles.sprocketHole} />
                </div>
              </div>
            )
          ) : isImage && thumbUrl ? (
            <img
              src={thumbUrl}
              alt={entry.name}
              className={styles.thumbnailImg}
              loading="lazy"
              onError={() => {
                setThumbnails((prev) => {
                  const copy = { ...prev };
                  delete copy[entry.path];
                  return copy;
                });
              }}
            />
          ) : isAudio && thumbUrl ? (
            <div className={styles.cleanVideoPoster}>
              <img
                src={thumbUrl}
                alt={entry.name}
                className={styles.cleanVideoImg}
                loading="lazy"
              />
              <div className={styles.videoBadge} title="Music">
                <Music size={10} color="#ffffff" />
              </div>
            </div>
          ) : (
            <FileIcon kind={entry.kind} ext={entry.ext} size={iconSize} />
          )}
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

  const renderTileItem = (entry: FileEntry) => {
    const isSelected = selectedPaths.includes(entry.path);
    const isRenaming = renamingPath === entry.path;
    const thumbUrl = thumbnails[entry.path];
    const isVideo = entry.kind !== "directory" && VIDEO_EXTS.has(entry.ext.toLowerCase());
    const isImage = entry.kind !== "directory" && IMAGE_EXTS.has(entry.ext.toLowerCase());
    const isAudio = entry.kind !== "directory" && AUDIO_EXTS.has(entry.ext.toLowerCase());

    return (
      <div
        key={entry.path}
        className={`${styles.tileItem} ${isSelected ? styles.selected : ""}`}
        onClick={(e) => handleRowClick(e, entry)}
        onDoubleClick={() => onOpen(entry)}
        onContextMenu={(e) => {
          e.stopPropagation();
          if (!isSelected) onSelect(entry, false, false);
          onContextMenu(e, entry);
        }}
        title={entry.name}
      >
        <div className={styles.tileIcon}>
          {isVideo && thumbUrl ? (
            <div className={styles.cleanVideoPoster}>
              <img src={thumbUrl} alt={entry.name} className={styles.cleanVideoImg} />
              <div className={styles.videoBadge}>
                <Film size={9} color="#ffffff" />
              </div>
            </div>
          ) : isAudio && thumbUrl ? (
            <div className={styles.cleanVideoPoster}>
              <img src={thumbUrl} alt={entry.name} className={styles.cleanVideoImg} />
              <div className={styles.videoBadge}>
                <Music size={9} color="#ffffff" />
              </div>
            </div>
          ) : isImage && thumbUrl ? (
            <img src={thumbUrl} alt={entry.name} className={styles.thumbnailImg} />
          ) : (
            <FileIcon kind={entry.kind} ext={entry.ext} size={36} />
          )}
        </div>

        <div className={styles.tileText}>
          {isRenaming ? (
            <input
              type="text"
              className={`${styles.inlineRenameInput} fileName`}
              defaultValue={entry.name}
              autoFocus
              dir="ltr"
              onKeyDown={(e) => {
                if (e.key === "Enter") onRenameSubmit(e.currentTarget.value);
                if (e.key === "Escape") onRenameCancel();
              }}
              onBlur={(e) => onRenameSubmit(e.currentTarget.value)}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className={`${styles.tileName} fileName`} dir="ltr">
              {renderDisplayName(entry)}
            </span>
          )}
          <span className={styles.tileDetails}>
            {entry.kind === "directory"
              ? "File folder"
              : `${formatBytes(entry.size)} • ${entry.ext.toUpperCase() || "File"}`}
          </span>
        </div>
      </div>
    );
  };

  const renderListItem = (entry: FileEntry) => {
    const isSelected = selectedPaths.includes(entry.path);
    const isRenaming = renamingPath === entry.path;

    return (
      <div
        key={entry.path}
        className={`${styles.listItem} ${isSelected ? styles.selected : ""}`}
        onClick={(e) => handleRowClick(e, entry)}
        onDoubleClick={() => onOpen(entry)}
        onContextMenu={(e) => {
          e.stopPropagation();
          if (!isSelected) onSelect(entry, false, false);
          onContextMenu(e, entry);
        }}
        title={entry.name}
      >
        <FileIcon kind={entry.kind} ext={entry.ext} size={16} />
        {isRenaming ? (
          <input
            type="text"
            className={`${styles.inlineRenameInput} fileName`}
            defaultValue={entry.name}
            autoFocus
            dir="ltr"
            onKeyDown={(e) => {
              if (e.key === "Enter") onRenameSubmit(e.currentTarget.value);
              if (e.key === "Escape") onRenameCancel();
            }}
            onBlur={(e) => onRenameSubmit(e.currentTarget.value)}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={`${styles.listName} fileName`} dir="ltr">
            {renderDisplayName(entry)}
          </span>
        )}
      </div>
    );
  };

  const renderContentItem = (entry: FileEntry) => {
    const isSelected = selectedPaths.includes(entry.path);
    const isRenaming = renamingPath === entry.path;
    const thumbUrl = thumbnails[entry.path];
    const isVideo = entry.kind !== "directory" && VIDEO_EXTS.has(entry.ext.toLowerCase());
    const isImage = entry.kind !== "directory" && IMAGE_EXTS.has(entry.ext.toLowerCase());
    const isAudio = entry.kind !== "directory" && AUDIO_EXTS.has(entry.ext.toLowerCase());

    return (
      <div
        key={entry.path}
        className={`${styles.contentItem} ${isSelected ? styles.selected : ""}`}
        onClick={(e) => handleRowClick(e, entry)}
        onDoubleClick={() => onOpen(entry)}
        onContextMenu={(e) => {
          e.stopPropagation();
          if (!isSelected) onSelect(entry, false, false);
          onContextMenu(e, entry);
        }}
        title={entry.name}
      >
        <div className={styles.contentIcon}>
          {isVideo && thumbUrl ? (
            <div className={styles.cleanVideoPoster}>
              <img src={thumbUrl} alt={entry.name} className={styles.cleanVideoImg} />
            </div>
          ) : isAudio && thumbUrl ? (
            <div className={styles.cleanVideoPoster}>
              <img src={thumbUrl} alt={entry.name} className={styles.cleanVideoImg} />
            </div>
          ) : isImage && thumbUrl ? (
            <img src={thumbUrl} alt={entry.name} className={styles.thumbnailImg} />
          ) : (
            <FileIcon kind={entry.kind} ext={entry.ext} size={28} />
          )}
        </div>

        <div className={styles.contentMetaList}>
          {isRenaming ? (
            <input
              type="text"
              className={`${styles.inlineRenameInput} fileName`}
              defaultValue={entry.name}
              autoFocus
              dir="ltr"
              onKeyDown={(e) => {
                if (e.key === "Enter") onRenameSubmit(e.currentTarget.value);
                if (e.key === "Escape") onRenameCancel();
              }}
              onBlur={(e) => onRenameSubmit(e.currentTarget.value)}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className={`${styles.contentTitle} fileName`} dir="ltr">
              {renderDisplayName(entry)}
            </span>
          )}
          <span className={styles.contentMetaRow}>
            {entry.modified ? formatDateTime(entry.modified) : "—"}
          </span>
          <span className={`${styles.contentMetaRow} fileSize`}>
            {entry.kind === "directory"
              ? "File folder"
              : `${formatBytes(entry.size)} • ${entry.ext.toUpperCase() || "File"}`}
          </span>
        </div>
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
        style={{ height: `${detailsRowHeight}px` }}
        onClick={(e) => handleRowClick(e, entry)}
        onDoubleClick={() => onOpen(entry)}
        onContextMenu={(e) => {
          e.stopPropagation();
          if (!isSelected) onSelect(entry, false, false);
          onContextMenu(e, entry);
        }}
      >
        <div className={`${styles.cell} ${styles.colName}`}>
          <FileIcon kind={entry.kind} ext={entry.ext} size={detailsIconSize} />
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
                  {viewMode === "details" ? (
                    <div className={styles.rowsSubContainer}>
                      {group.items.map((entry) => renderDetailRow(entry))}
                    </div>
                  ) : viewMode === "tiles" ? (
                    <div className={styles.tilesSubContainer}>
                      {group.items.map((entry) => renderTileItem(entry))}
                    </div>
                  ) : viewMode === "list" ? (
                    <div className={styles.listSubContainer}>
                      {group.items.map((entry) => renderListItem(entry))}
                    </div>
                  ) : viewMode === "content" ? (
                    <div className={styles.contentSubContainer}>
                      {group.items.map((entry) => renderContentItem(entry))}
                    </div>
                  ) : (
                    <div
                      className={styles.gridSubContainer}
                      style={{
                        gridTemplateColumns: `repeat(auto-fill, minmax(${effectiveGridZoom}px, 1fr))`,
                        gridAutoRows: `${effectiveGridZoom + 30}px`,
                      }}
                    >
                      {group.items.map((entry) => renderGridItem(entry))}
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
