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
  Music,
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
  "mp4", "mkv", "mov", "webm", "avi", "wmv", "m4v",
  "mp3", "flac", "m4a", "aac", "ogg", "wav", "wma", "aiff", "alac", "opus"
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
  const isAudio = ["mp3", "flac", "m4a", "aac", "ogg", "wav", "wma", "aiff", "alac", "opus"].includes(ext) || previewInfo?.mediaType === "audio";

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
            ) : isAudio ? (
              <Music size={18} color="var(--accent)" />
            ) : (
              <FileText size={18} color="var(--text-muted)" />
            )}
            <span className={`${styles.fileName} fileName`} title={currentEntry?.name} dir="ltr">
              {previewInfo?.title ? `${previewInfo.title}${previewInfo.artist ? ` - ${previewInfo.artist}` : ""}` : currentEntry?.name || "Preview"}
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
              src={previewInfo?.thumbnailUrl || mediaSrc || ""}
              alt={currentEntry?.name || ""}
              className={styles.imageElement}
              style={{
                transform: isFit
                  ? `rotate(${rotation}deg)`
                  : `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel}) rotate(${rotation}deg)`,
              }}
              draggable={false}
              onError={(e) => {
                if (previewInfo?.thumbnailUrl && e.currentTarget.src !== previewInfo.thumbnailUrl) {
                  e.currentTarget.src = previewInfo.thumbnailUrl;
                }
              }}
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
                key={currentPath}
                controls
                autoPlay
                playsInline
                preload="metadata"
                poster={previewInfo?.thumbnailUrl || undefined}
                className={styles.videoElement}
                src={mediaSrc}
                onError={() => setVideoError(true)}
              >
                Your player does not support this video.
              </video>
            )
          ) : isAudio ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
              {previewInfo?.thumbnailUrl ? (
                <img
                  src={previewInfo.thumbnailUrl}
                  alt={previewInfo?.title || currentEntry?.name}
                  style={{ maxHeight: 340, maxWidth: 340, borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.35)", objectFit: "contain" }}
                />
              ) : (
                <div style={{ width: 160, height: 160, borderRadius: "50%", background: "var(--bg-panel)", border: "2px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Music size={64} color="var(--accent)" strokeWidth={1.5} />
                </div>
              )}
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-main)", marginBottom: 4 }}>
                  {previewInfo?.title || currentEntry?.name}
                </div>
                {previewInfo?.artist && (
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    {previewInfo.artist} {previewInfo?.album ? `• ${previewInfo.album}` : ""}
                  </div>
                )}
              </div>
              <audio
                key={currentPath}
                controls
                autoPlay
                style={{ width: 320, maxWidth: "90%", outline: "none" }}
                src={mediaSrc}
                preload="metadata"
              />
            </div>
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
