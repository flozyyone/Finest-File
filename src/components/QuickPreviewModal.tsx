import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Film,
  Image as ImageIcon,
  FileText,
} from "lucide-react";
import { FileEntry, MediaPreviewInfo } from "../types";
import { api } from "../api";
import { convertFileSrc } from "@tauri-apps/api/core";
import { formatBytes } from "../utils/format";
import { useI18n } from "../i18n";
import styles from "./QuickPreviewModal.module.css";

interface QuickPreviewModalProps {
  currentPath: string;
  allEntries: FileEntry[];
  onClose: () => void;
  onNavigate: (newPath: string) => void;
}

const MEDIA_EXTS = new Set([
  "jpg", "jpeg", "png", "webp", "bmp", "gif", "tiff", "tif", "svg",
  "mp4", "mkv", "mov", "webm", "avi", "wmv", "m4v"
]);

export const QuickPreviewModal: React.FC<QuickPreviewModalProps> = ({
  currentPath,
  allEntries,
  onClose,
  onNavigate,
}) => {
  const { dict, formatDateTime } = useI18n();

  // Filter navigable media files or all non-directory files
  const mediaList = useMemo(() => {
    const media = allEntries.filter(
      (e) => e.kind !== "directory" && MEDIA_EXTS.has(e.ext.toLowerCase())
    );
    return media.length > 0 ? media : allEntries.filter((e) => e.kind !== "directory");
  }, [allEntries]);

  const currentIndex = mediaList.findIndex((e) => e.path === currentPath);
  const currentEntry = mediaList[currentIndex] || allEntries.find((e) => e.path === currentPath);

  const [previewInfo, setPreviewInfo] = useState<MediaPreviewInfo | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFit, setIsFit] = useState(true);
  const [videoError, setVideoError] = useState(false);

  // Pan state
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Reset transforms on file navigation
  useEffect(() => {
    setZoomLevel(1);
    setRotation(0);
    setIsFit(true);
    setPan({ x: 0, y: 0 });
    setVideoError(false);

    if (currentPath) {
      api
        .getMediaPreview(currentPath)
        .then(setPreviewInfo)
        .catch(() => setPreviewInfo(null));
    }
  }, [currentPath]);

  const handleNext = () => {
    if (mediaList.length === 0) return;
    const nextIdx = (currentIndex + 1) % mediaList.length;
    onNavigate(mediaList[nextIdx].path);
  };

  const handlePrev = () => {
    if (mediaList.length === 0) return;
    const prevIdx = (currentIndex - 1 + mediaList.length) % mediaList.length;
    onNavigate(mediaList[prevIdx].path);
  };

  const handleZoomIn = () => {
    setIsFit(false);
    setZoomLevel((z) => Math.min(5, +(z + 0.25).toFixed(2)));
  };

  const handleZoomOut = () => {
    setIsFit(false);
    setZoomLevel((z) => Math.max(0.2, +(z - 0.25).toFixed(2)));
  };

  const handleFit = () => {
    setIsFit(true);
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
  };

  const handleRotateCw = () => {
    setRotation((r) => (r + 90) % 360);
  };

  const handleRotateCcw = () => {
    setRotation((r) => (r - 90 + 360) % 360);
  };

  // Keyboard navigation inside modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.code === "Space") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === "-") {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key.toLowerCase() === "r") {
        e.preventDefault();
        if (e.shiftKey) handleRotateCcw();
        else handleRotateCw();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, mediaList, onClose]);

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isFit || zoomLevel <= 1) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const ext = currentEntry?.ext.toLowerCase() || "";
  const isVideo = ["mp4", "mkv", "mov", "webm", "avi", "wmv", "m4v"].includes(ext);
  const isImage = ["jpg", "jpeg", "png", "webp", "bmp", "gif", "tiff", "tif", "svg"].includes(ext);

  const mediaSrc = currentPath ? convertFileSrc(currentPath) : "";

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modalWindow}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleArea}>
            {isVideo ? (
              <Film size={18} color="var(--accent)" />
            ) : isImage ? (
              <ImageIcon size={18} color="var(--accent)" />
            ) : (
              <FileText size={18} color="var(--text-muted)" />
            )}
            <span className={`${styles.fileName} fileName`} title={currentEntry?.name} dir="ltr">
              {currentEntry?.name || "Preview"}
            </span>
            {mediaList.length > 1 && (
              <span className={styles.badge}>
                {currentIndex + 1} / {mediaList.length}
              </span>
            )}
            {previewInfo?.width && previewInfo?.height && (
              <span className={styles.badge}>
                {previewInfo.width} × {previewInfo.height}
              </span>
            )}
          </div>

          <div className={styles.actions}>
            {isImage && (
              <>
                <button
                  className={styles.toolBtn}
                  onClick={handleZoomOut}
                  disabled={zoomLevel <= 0.25}
                  title={dict.view.zoomOut}
                >
                  <ZoomOut size={15} />
                </button>
                <button
                  className={styles.toolBtn}
                  onClick={handleZoomIn}
                  disabled={zoomLevel >= 5}
                  title={dict.view.zoomIn}
                >
                  <ZoomIn size={15} />
                </button>
                <button
                  className={`${styles.toolBtn} ${isFit ? styles.active : ""}`}
                  onClick={handleFit}
                  title={dict.view.fitToWindow}
                >
                  <Maximize2 size={15} />
                </button>
                <div className={styles.divider} />
                <button
                  className={styles.toolBtn}
                  onClick={handleRotateCcw}
                  title="Rotate Counter-Clockwise (Shift + R)"
                >
                  <RotateCcw size={15} />
                </button>
                <button
                  className={styles.toolBtn}
                  onClick={handleRotateCw}
                  title="Rotate Clockwise (R)"
                >
                  <RotateCw size={15} />
                </button>
                <div className={styles.divider} />
              </>
            )}

            <button
              className={styles.toolBtn}
              onClick={() => api.openItemDefault(currentPath)}
              title={dict.operations.openDefault}
            >
              <ExternalLink size={15} />
            </button>

            <button className={styles.toolBtn} onClick={onClose} title={dict.common.close}>
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Content Viewport */}
        <div
          className={`${styles.contentViewport} ${!isFit && zoomLevel > 1 ? styles.panning : ""}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {mediaList.length > 1 && (
            <>
              <button
                className={`${styles.navBtn} ${styles.navPrev}`}
                onClick={handlePrev}
                title="Previous (Left Arrow)"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                className={`${styles.navBtn} ${styles.navNext}`}
                onClick={handleNext}
                title="Next (Right Arrow)"
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}

          {isImage ? (
            <img
              src={mediaSrc || previewInfo?.thumbnailUrl || ""}
              alt={currentEntry?.name || ""}
              className={styles.imageElement}
              style={{
                transform: isFit
                  ? `rotate(${rotation}deg)`
                  : `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel}) rotate(${rotation}deg)`,
              }}
              draggable={false}
            />
          ) : isVideo ? (
            videoError ? (
              <div className={styles.videoErrorNotice}>
                <Film size={48} color="var(--accent)" />
                <p>This video format or codec requires a native media player.</p>
                <button
                  className={styles.openExternalBtn}
                  onClick={() => api.openItemDefault(currentPath)}
                >
                  <ExternalLink size={14} />
                  <span>Open in Windows Media Player</span>
                </button>
              </div>
            ) : (
              <video
                controls
                autoPlay
                className={styles.videoElement}
                src={mediaSrc}
                onError={() => setVideoError(true)}
              >
                Your player does not support this video.
              </video>
            )
          ) : (
            <div className={styles.videoErrorNotice}>
              <FileText size={48} color="var(--text-muted)" />
              <p>{currentEntry?.name}</p>
              <button
                className={styles.openExternalBtn}
                onClick={() => api.openItemDefault(currentPath)}
              >
                <ExternalLink size={14} />
                <span>{dict.operations.openDefault}</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer Bar */}
        <div className={styles.footerBar}>
          <div className={styles.metaText}>
            <span>{currentEntry ? formatBytes(currentEntry.size) : ""}</span>
            {currentEntry?.modified && (
              <span>{formatDateTime(currentEntry.modified)}</span>
            )}
            <span>{currentPath}</span>
          </div>
          <div>
            <span>Press Space or Esc to exit</span>
          </div>
        </div>
      </div>
    </div>
  );
};
