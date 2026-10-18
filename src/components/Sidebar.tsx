import React from "react";
import {
  Home,
  Monitor,
  FileText,
  Download,
  Image,
  Video,
  Music,
  HardDrive,
  Settings,
  Activity,
  Layers,
  Keyboard,
} from "lucide-react";
import { DriveInfo, KnownFolder } from "../types";
import { formatBytes } from "../utils/format";
import styles from "./Sidebar.module.css";

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  drives: DriveInfo[];
  knownFolders: KnownFolder[];
  onOpenSettings: () => void;
  onOpenJobs: () => void;
  onOpenShortcuts?: () => void;
  activeJobCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPath,
  onNavigate,
  drives,
  knownFolders,
  onOpenSettings,
  onOpenJobs,
  onOpenShortcuts,
  activeJobCount,
}) => {
  const getKnownIcon = (id: string) => {
    switch (id) {
      case "home":
        return <Home size={16} />;
      case "desktop":
        return <Monitor size={16} />;
      case "documents":
        return <FileText size={16} />;
      case "downloads":
        return <Download size={16} />;
      case "pictures":
        return <Image size={16} />;
      case "videos":
        return <Video size={16} />;
      case "music":
        return <Music size={16} />;
      default:
        return <FileText size={16} />;
    }
  };

  const isSelected = (p: string) =>
    currentPath.toLowerCase() === p.toLowerCase() ||
    currentPath.toLowerCase() === p.toLowerCase() + "\\";

  return (
    <aside className={styles.sidebar}>
      <div className={styles.section}>
        <div className={styles.sectionHeader}>Quick access</div>
        {knownFolders.map((kf) => (
          <button
            key={kf.id}
            className={`${styles.item} ${isSelected(kf.path) ? styles.active : ""}`}
            onClick={() => onNavigate(kf.path)}
            title={kf.path}
          >
            <span className={styles.itemIcon}>{getKnownIcon(kf.id)}</span>
            <span className={styles.itemLabel}>{kf.name}</span>
          </button>
        ))}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>Drives</div>
        {drives.map((d) => {
          const usedPct =
            d.totalBytes && d.freeBytes
              ? Math.round(((d.totalBytes - d.freeBytes) / d.totalBytes) * 100)
              : 0;

          return (
            <button
              key={d.path}
              className={`${styles.driveItem} ${isSelected(d.path) ? styles.active : ""}`}
              onClick={() => onNavigate(d.path)}
              title={`${d.path} (${d.fileSystem || "drive"})\n${formatBytes(d.freeBytes)} free of ${formatBytes(d.totalBytes)}`}
            >
              <div className={styles.driveRow}>
                <span className={styles.itemIcon}>
                  <HardDrive size={16} />
                </span>
                <span className={styles.itemLabel}>
                  {d.label ? `${d.label} (${d.letter}:)` : `Local Disk (${d.letter}:)`}
                </span>
              </div>
              {d.totalBytes ? (
                <div className={styles.driveCapacity}>
                  <div className={styles.driveBar}>
                    <div
                      className={styles.driveFill}
                      style={{
                        width: `${usedPct}%`,
                        backgroundColor: usedPct > 90 ? "var(--status-error)" : "var(--accent)",
                      }}
                    />
                  </div>
                  <span className={styles.driveText}>
                    {formatBytes(d.freeBytes)} free
                  </span>
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className={styles.footer}>
        <button className={styles.footerBtn} onClick={onOpenJobs} title="Background Operations">
          <Activity size={16} />
          <span>Operations</span>
          {activeJobCount > 0 && (
            <span className={styles.badge}>{activeJobCount}</span>
          )}
        </button>
        {onOpenShortcuts && (
          <button className={styles.footerBtn} onClick={onOpenShortcuts} title="Keyboard Shortcuts (F1)">
            <Keyboard size={16} />
            <span>Shortcuts</span>
          </button>
        )}
        <button className={styles.footerBtn} onClick={onOpenSettings} title="Settings">
          <Settings size={16} />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
};
