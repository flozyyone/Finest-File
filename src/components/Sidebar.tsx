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
  Keyboard,
} from "lucide-react";
import { DriveInfo, KnownFolder } from "../types";
import { formatBytes } from "../utils/format";
import { useI18n } from "../i18n";
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
  const { dict } = useI18n();

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

  const getKnownFolderName = (kf: KnownFolder) => {
    switch (kf.id) {
      case "home":
        return dict.nav.thisPc;
      case "desktop":
        return dict.nav.desktop;
      case "documents":
        return dict.nav.documents;
      case "downloads":
        return dict.nav.downloads;
      case "pictures":
        return dict.nav.pictures;
      case "music":
        return dict.nav.music;
      case "videos":
        return dict.nav.videos;
      default:
        return kf.name;
    }
  };

  const isSelected = (p: string) =>
    currentPath.toLowerCase() === p.toLowerCase() ||
    currentPath.toLowerCase() === p.toLowerCase() + "\\";

  return (
    <aside className={styles.sidebar}>
      <div className={styles.navBody}>
        <div className={styles.section}>
          <div className={styles.sectionHeader}>{dict.nav.quickAccess}</div>
          {knownFolders.map((kf) => (
            <button
              key={kf.id}
              className={`${styles.item} ${isSelected(kf.path) ? styles.active : ""}`}
              onClick={() => onNavigate(kf.path)}
              title={kf.path}
            >
              <span className={styles.itemIcon}>{getKnownIcon(kf.id)}</span>
              <span className={styles.itemLabel}>{getKnownFolderName(kf)}</span>
            </button>
          ))}
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>{dict.nav.drives}</div>
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
                title={`${d.path} (${d.fileSystem || "drive"})\n${formatBytes(d.freeBytes)} / ${formatBytes(d.totalBytes)}`}
              >
                <div className={styles.driveRow}>
                  <span className={styles.itemIcon}>
                    <HardDrive size={16} />
                  </span>
                  <span className={`${styles.itemLabel} driveLetter`}>
                    {d.label ? `${d.label} (${d.letter}:)` : `${d.letter}:`}
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
                    <span className={`${styles.driveText} fileSize`}>
                      {formatBytes(d.freeBytes)}
                    </span>
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.footer}>
        <button className={styles.footerBtn} onClick={onOpenJobs} title={dict.jobs.title}>
          <Activity size={16} />
          <span>{dict.jobs.title}</span>
          {activeJobCount > 0 && (
            <span className={styles.badge}>{activeJobCount}</span>
          )}
        </button>
        {onOpenShortcuts && (
          <button className={styles.footerBtn} onClick={onOpenShortcuts} title={dict.shortcuts.title}>
            <Keyboard size={16} />
            <span>{dict.common.properties === "Properties" ? "Shortcuts" : dict.view.keyboardShortcuts}</span>
          </button>
        )}
        <button className={styles.footerBtn} onClick={onOpenSettings} title={dict.settings.title}>
          <Settings size={16} />
          <span>{dict.view.settings}</span>
        </button>
      </div>
    </aside>
  );
};
