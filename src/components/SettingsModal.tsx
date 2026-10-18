import React, { useState } from "react";
import { AppSettings, IndexStatus } from "../types";
import { formatBytes } from "../utils/format";
import { X, Play, Square, RotateCcw, FolderCheck, ShieldAlert } from "lucide-react";
import styles from "./SettingsModal.module.css";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  indexStatus: IndexStatus | null;
  onStartIndexScan: () => void;
  onCancelIndexScan: () => void;
  onClearIndex: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  indexStatus,
  onStartIndexScan,
  onCancelIndexScan,
  onClearIndex,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<"general" | "indexing" | "about">("general");
  const [localSettings, setLocalSettings] = useState<AppSettings>({ ...settings });
  const [newRootPath, setNewRootPath] = useState("");

  const handleSave = () => {
    onSaveSettings(localSettings);
    onClose();
  };

  const handleAddRoot = () => {
    if (newRootPath.trim() && !localSettings.index.roots.includes(newRootPath.trim())) {
      setLocalSettings({
        ...localSettings,
        index: {
          ...localSettings.index,
          roots: [...localSettings.index.roots, newRootPath.trim()],
        },
      });
      setNewRootPath("");
    }
  };

  const handleRemoveRoot = (path: string) => {
    setLocalSettings({
      ...localSettings,
      index: {
        ...localSettings.index,
        roots: localSettings.index.roots.filter((r) => r !== path),
      },
    });
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>Settings</span>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.nav}>
            <button
              className={`${styles.navItem} ${activeTab === "general" ? styles.activeNav : ""}`}
              onClick={() => setActiveTab("general")}
            >
              General & Display
            </button>
            <button
              className={`${styles.navItem} ${activeTab === "indexing" ? styles.activeNav : ""}`}
              onClick={() => setActiveTab("indexing")}
            >
              File Indexing & Search
            </button>
            <button
              className={`${styles.navItem} ${activeTab === "about" ? styles.activeNav : ""}`}
              onClick={() => setActiveTab("about")}
            >
              About FinestFile
            </button>
          </div>

          <div className={styles.tabContent}>
            {activeTab === "general" && (
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Appearance & Theme</h3>
                <div className={styles.row}>
                  <label>Application Theme</label>
                  <select
                    value={localSettings.theme}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        theme: e.target.value as "system" | "light" | "dark",
                      })
                    }
                  >
                    <option value="system">Follow Windows System Theme</option>
                    <option value="light">Light Theme</option>
                    <option value="dark">Dark Theme (Charcoal)</option>
                  </select>
                </div>

                <div className={styles.row}>
                  <label>Default View Mode</label>
                  <select
                    value={localSettings.defaultViewMode}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        defaultViewMode: e.target.value as "details" | "grid",
                      })
                    }
                  >
                    <option value="details">Details List</option>
                    <option value="grid">Grid (Icons)</option>
                  </select>
                </div>

                <h3 className={styles.sectionTitle} style={{ marginTop: 20 }}>
                  Filesystem Display
                </h3>
                <div className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    id="showHidden"
                    checked={localSettings.showHiddenFiles}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        showHiddenFiles: e.target.checked,
                      })
                    }
                  />
                  <label htmlFor="showHidden">Show hidden files and system items</label>
                </div>

                <div className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    id="showExts"
                    checked={localSettings.showFileExtensions}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        showFileExtensions: e.target.checked,
                      })
                    }
                  />
                  <label htmlFor="showExts">Show file extensions for known file types</label>
                </div>

                <div className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    id="confirmDelete"
                    checked={localSettings.confirmDelete}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        confirmDelete: e.target.checked,
                      })
                    }
                  />
                  <label htmlFor="confirmDelete">
                    Confirm before moving items to the Recycle Bin
                  </label>
                </div>
              </div>
            )}

            {activeTab === "indexing" && (
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Local Metadata Indexing</h3>
                <p className={styles.desc}>
                  FinestFile can index directory metadata (file names, sizes, dates) into a
                  local SQLite database for instant searching. File contents are never indexed.
                </p>

                <div className={styles.checkboxRow} style={{ marginTop: 12 }}>
                  <input
                    type="checkbox"
                    id="enableIndex"
                    checked={localSettings.index.enabled}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        index: {
                          ...localSettings.index,
                          enabled: e.target.checked,
                        },
                      })
                    }
                  />
                  <label htmlFor="enableIndex">
                    <strong>Enable automatic background indexing</strong>
                  </label>
                </div>

                {indexStatus && (
                  <div className={styles.indexStatsBox}>
                    <div className={styles.statLine}>
                      <span>Indexed files:</span>
                      <strong>{indexStatus.totalFiles.toLocaleString()}</strong>
                    </div>
                    <div className={styles.statLine}>
                      <span>Indexed folders:</span>
                      <strong>{indexStatus.totalFolders.toLocaleString()}</strong>
                    </div>
                    <div className={styles.statLine}>
                      <span>Total indexed size:</span>
                      <strong>{formatBytes(indexStatus.totalBytes)}</strong>
                    </div>
                    {indexStatus.isScanning && (
                      <div className={styles.statLine} style={{ color: "var(--accent)" }}>
                        <span>Scanning now...</span>
                        <span>{indexStatus.scannedItems} scanned</span>
                      </div>
                    )}
                  </div>
                )}

                <div className={styles.btnRow} style={{ marginTop: 12 }}>
                  {indexStatus?.isScanning ? (
                    <button className={styles.actionBtn} onClick={onCancelIndexScan}>
                      <Square size={14} /> Stop Scan
                    </button>
                  ) : (
                    <button className={styles.actionBtn} onClick={onStartIndexScan}>
                      <Play size={14} /> Start Scan Now
                    </button>
                  )}
                  <button className={styles.actionBtn} onClick={onClearIndex}>
                    <RotateCcw size={14} /> Clear Index
                  </button>
                </div>

                <h4 style={{ fontSize: 12, marginTop: 18, marginBottom: 6 }}>
                  Configured Scan Roots
                </h4>
                <div className={styles.rootsList}>
                  {localSettings.index.roots.length === 0 ? (
                    <div className={styles.noRoots}>No specific roots configured.</div>
                  ) : (
                    localSettings.index.roots.map((r) => (
                      <div key={r} className={styles.rootItem}>
                        <span>{r}</span>
                        <button
                          className={styles.removeRootBtn}
                          onClick={() => handleRemoveRoot(r)}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div className={styles.addRootRow}>
                  <input
                    type="text"
                    placeholder="Enter folder path (e.g. C:\Users\Username\Documents)"
                    value={newRootPath}
                    onChange={(e) => setNewRootPath(e.target.value)}
                  />
                  <button onClick={handleAddRoot}>Add Location</button>
                </div>
              </div>
            )}

            {activeTab === "about" && (
              <div className={styles.section}>
                <div className={styles.aboutHeader}>
                  <img
                    src="/logo.svg"
                    alt="FinestFile logo"
                    width={48}
                    height={48}
                    style={{ borderRadius: 6 }}
                  />
                  <div>
                    <h2 style={{ fontSize: 16 }}>FinestFile</h2>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      Version 0.1.0 (Open-Source Desktop Utility)
                    </span>
                  </div>
                </div>

                <p className={styles.desc} style={{ marginTop: 14 }}>
                  FinestFile is a practical, lightweight, professional open-source file manager
                  and archive utility for Windows 10 and Windows 11.
                </p>

                <div className={styles.aboutFeatures}>
                  <div className={styles.featureItem}>
                    <FolderCheck size={16} color="var(--accent)" />
                    <span>Native Win32 filesystem engine built in Rust</span>
                  </div>
                  <div className={styles.featureItem}>
                    <ShieldAlert size={16} color="var(--accent)" />
                    <span>Safe ZIP extraction with path traversal protection</span>
                  </div>
                  <div className={styles.featureItem}>
                    <RotateCcw size={16} color="var(--accent)" />
                    <span>Transparent background operations with real progress</span>
                  </div>
                </div>

                <div className={styles.licenseInfo}>
                  Distributed under the permissive <strong>MIT License</strong>.
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button className={styles.saveBtn} onClick={handleSave}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
