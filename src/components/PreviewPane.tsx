import React, { useState, useEffect, useRef } from "react";
import {
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  RotateCw,
  Play,
  FileText,
  Folder,
  Film,
  Music,
  ExternalLink,
} from "lucide-react";
import { FileEntry, MediaPreviewInfo } from "../types";
import { api } from "../api";
import { convertFileSrc } from "@tauri-apps/api/core";
import { formatBytes, formatDuration } from "../utils/format";
import { useI18n } from "../i18n";
import styles from "./PreviewPane.module.css";

interface PreviewPaneProps {
  selectedEntry: FileEntry | null;
  onClose: () => void;
  onOpenQuickPreview?: () => void;
}

export const PreviewPane: React.FC<PreviewPaneProps> = ({
  selectedEntry,
  onClose,
  onOpenQuickPreview,
}) => {
  const { dict, formatDateTime } = useI18n();
  const [previewInfo, setPreviewInfo] = useState<MediaPreviewInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = fit
  const [rotation, setRotation] = useState(0);
  const [isFit, setIsFit] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const [videoMeta, setVideoMeta] = useState<{ width?: number; height?: number; duration?: number } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Pan state
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setVideoError(false);
    setVideoMeta(null);

    if (!selectedEntry || selectedEntry.kind === "directory") {
      setPreviewInfo(null);
      return;
    }

    let active = true;
    setLoading(true);
    setZoomLevel(1);
    setRotation(0);
    setIsFit(true);
    setPan({ x: 0, y: 0 });

    api
      .getMediaPreview(selectedEntry.path)
      .then((info) => {
        if (active) {
          setPreviewInfo(info);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          console.error("Failed to load preview info:", err);
          setPreviewInfo(null);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedEntry?.path, selectedEntry?.kind]);

  const handleZoomIn = () => {
    setIsFit(false);
    setZoomLevel((z) => Math.min(4, +(z + 0.25).toFixed(2)));
  };

  const handleZoomOut = () => {
    setIsFit(false);
    setZoomLevel((z) => Math.max(0.25, +(z - 0.25).toFixed(2)));
  };

  const handleFit = () => {
    setIsFit(true);
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
  };

  const handleActualSize = () => {
    setIsFit(false);
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
  };

  const handleRotateCw = () => {
    setRotation((r) => (r + 90) % 360);
  };

  const handleRotateCcw = () => {
    setRotation((r) => (r - 90 + 360) % 360);
  };

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

  if (!selectedEntry) {
    return (
      <aside className={styles.previewPane}>
        <div className={styles.header}>
          <span className={styles.headerTitle}>{dict.view.previewPane}</span>
          <button className={styles.closeBtn} onClick={onClose} title={dict.common.close}>
            <X size={15} />
          </button>
        </div>
        <div className={styles.emptyPreview}>
          <FileText size={36} strokeWidth={1.5} />
          <span>{dict.view.noPreview}</span>
        </div>
      </aside>
    );
  }

  const isDirectory = selectedEntry.kind === "directory";
  const ext = selectedEntry.ext.toLowerCase();
  const isImage = ["jpg", "jpeg", "png", "webp", "bmp", "gif", "tiff", "tif", "svg"].includes(ext) || previewInfo?.mediaType === "image";
  const isVideo = ["mp4", "mkv", "mov", "webm", "avi", "wmv", "m4v"].includes(ext) || previewInfo?.mediaType === "video";
  const isAudio = ["mp3", "flac", "m4a", "aac", "ogg", "wav", "wma", "aiff", "alac", "opus"].includes(ext) || previewInfo?.mediaType === "audio";

  const assetUrl = selectedEntry.path ? convertFileSrc(selectedEntry.path) : "";

  return (
    <aside className={styles.previewPane}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>{dict.view.previewPane}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {onOpenQuickPreview && (
            <button
              className={styles.closeBtn}
              onClick={onOpenQuickPreview}
              title="Full Preview (Space)"
            >
              <Maximize2 size={13} />
            </button>
          )}
          <button className={styles.closeBtn} onClick={onClose} title={dict.common.close}>
            <X size={15} />
          </button>
        </div>
      </div>

      <div className={styles.content}>
        {/* Media Viewport */}
        {isDirectory ? (
          <div className={styles.mediaViewport}>
            <Folder size={64} color="var(--accent)" strokeWidth={1.5} />
          </div>
        ) : isImage ? (
          <>
            <div
              className={`${styles.mediaViewport} ${!isFit && zoomLevel > 1 ? styles.panning : ""}`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <img
                src={previewInfo?.thumbnailUrl || assetUrl || ""}
                alt={selectedEntry.name}
                className={styles.imagePreview}
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
            </div>

            {/* Image Preview Toolbar */}
            <div className={styles.previewToolbar}>
              <button
                className={styles.previewToolBtn}
                onClick={handleZoomOut}
                disabled={zoomLevel <= 0.25}
                title={dict.view.zoomOut}
              >
                <ZoomOut size={14} />
              </button>

              <span className={styles.zoomLevelText}>
                {Math.round(zoomLevel * 100)}%
              </span>

              <button
                className={styles.previewToolBtn}
                onClick={handleZoomIn}
                disabled={zoomLevel >= 4}
                title={dict.view.zoomIn}
              >
                <ZoomIn size={14} />
              </button>

              <button
                className={`${styles.previewToolBtn} ${isFit ? styles.active : ""}`}
                onClick={handleFit}
                title={dict.view.fitToWindow}
              >
                <Maximize2 size={13} />
              </button>

              <button
                className={styles.previewToolBtn}
                onClick={handleRotateCw}
                title="Rotate Clockwise"
              >
                <RotateCw size={13} />
              </button>

              <button
                className={styles.previewToolBtn}
                onClick={handleActualSize}
                title={dict.view.actualSize}
              >
                <RotateCcw size={13} />
              </button>
            </div>
          </>
        ) : isVideo ? (
          <div className={styles.mediaViewport}>
            {videoError ? (
              <div style={{ textAlign: "center", padding: 16 }}>
                <Film size={40} color="var(--accent)" />
                <p style={{ fontSize: 12, margin: "8px 0", color: "var(--text-muted)" }}>
                  Bu video formatı veya çözücüsü yerleşik oynatıcıda desteklenmiyor.
                </p>
                <button
                  className={styles.previewToolBtn}
                  style={{ width: "auto", padding: "4px 8px" }}
                  onClick={() => api.openItemDefault(selectedEntry.path)}
                >
                  <ExternalLink size={13} />
                  <span style={{ marginLeft: 4 }}>{dict.operations.openDefault}</span>
                </button>
              </div>
            ) : (
              <video
                key={selectedEntry.path}
                ref={videoRef}
                controls
                playsInline
                preload="metadata"
                poster={previewInfo?.thumbnailUrl || undefined}
                className={styles.videoElement}
                src={assetUrl}
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  setVideoMeta({
                    width: v.videoWidth,
                    height: v.videoHeight,
                    duration: v.duration,
                  });
                }}
                onError={() => setVideoError(true)}
              >
                {dict.errors.unexpected}
              </video>
            )}
          </div>
        ) : isAudio ? (
          <>
            <div className={styles.mediaViewport}>
              {previewInfo?.thumbnailUrl ? (
                <div className={styles.audioCoverContainer}>
                  <img
                    src={previewInfo.thumbnailUrl}
                    alt={previewInfo.title || selectedEntry.name}
                    className={styles.imagePreview}
                  />
                </div>
              ) : (
                <div className={styles.audioDefaultCover}>
                  <Music size={54} color="var(--accent)" strokeWidth={1.5} />
                  <span className={styles.audioDefaultText}>
                    {selectedEntry.ext.toUpperCase()} Audio
                  </span>
                </div>
              )}
            </div>
            <audio
              key={selectedEntry.path}
              ref={audioRef}
              controls
              className={styles.audioElement}
              src={assetUrl}
              preload="metadata"
            />
          </>
        ) : (
          <div className={styles.mediaViewport}>
            <FileText size={54} color="var(--text-muted)" strokeWidth={1.5} />
          </div>
        )}

        {/* Metadata Section */}
        <div className={styles.metaSection}>
          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>{dict.view.name}</span>
            <span className={`${styles.metaValue} fileName`} dir="ltr">
              {selectedEntry.name}
            </span>
          </div>

          {previewInfo?.title ? (
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Title</span>
              <span className={`${styles.metaValue} fileName`} dir="ltr">
                {previewInfo.title}
              </span>
            </div>
          ) : null}

          {previewInfo?.artist ? (
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Artist</span>
              <span className={styles.metaValue}>{previewInfo.artist}</span>
            </div>
          ) : null}

          {previewInfo?.album ? (
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Album</span>
              <span className={styles.metaValue}>{previewInfo.album}</span>
            </div>
          ) : null}

          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>{dict.view.type}</span>
            <span className={styles.metaValue}>
              {isDirectory
                ? "File Folder"
                : isAudio
                ? `${selectedEntry.ext.toUpperCase()} Audio`
                : selectedEntry.ext
                ? `${selectedEntry.ext.toUpperCase()} File`
                : "File"}
            </span>
          </div>

          {(videoMeta?.duration || previewInfo?.durationSecs) ? (
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Duration</span>
              <span className={`${styles.metaValue} fileSize`} dir="ltr">
                {formatDuration(videoMeta?.duration || previewInfo?.durationSecs)}
              </span>
            </div>
          ) : null}

          {!isDirectory && selectedEntry.size !== undefined && (
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>{dict.view.size}</span>
              <span className={`${styles.metaValue} fileSize`} dir="ltr">
                {formatBytes(selectedEntry.size)}
              </span>
            </div>
          )}

          {previewInfo?.year ? (
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Year</span>
              <span className={styles.metaValue}>{previewInfo.year}</span>
            </div>
          ) : null}

          {previewInfo?.genre ? (
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Genre</span>
              <span className={styles.metaValue}>{previewInfo.genre}</span>
            </div>
          ) : null}

          {(videoMeta?.width || previewInfo?.width) && (videoMeta?.height || previewInfo?.height) && !isAudio ? (
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>{dict.view.dimensions}</span>
              <span className={`${styles.metaValue} fileSize`} dir="ltr">
                {(videoMeta?.width || previewInfo?.width)} × {(videoMeta?.height || previewInfo?.height)} px
              </span>
            </div>
          ) : null}

          {selectedEntry.modified ? (
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>{dict.view.dateModified}</span>
              <span className={styles.metaValue}>
                {formatDateTime(selectedEntry.modified)}
              </span>
            </div>
          ) : null}

          {!isDirectory && (
            <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
              <button
                className={styles.previewToolBtn}
                style={{ width: "100%", height: 28, fontSize: 11.5, gap: 6, display: "flex", alignItems: "center", justifyContent: "center" }}
                onClick={() => api.openItemDefault(selectedEntry.path)}
                title={dict.operations.openDefault}
              >
                <ExternalLink size={13} />
                <span>{dict.operations.openDefault}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
