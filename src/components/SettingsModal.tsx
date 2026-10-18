import React, { useState } from "react";
import { AppSettings, IndexStatus } from "../types";
import { formatBytes } from "../utils/format";
import { X, Play, Square, RotateCcw, FolderCheck, ShieldAlert } from "lucide-react";
import { useI18n, SUPPORTED_LANGUAGES } from "../i18n";
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
  const { dict, formatDateTime } = useI18n();

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
          <span className={styles.title}>{dict.settings.title}</span>
          <button className={styles.closeBtn} onClick={onClose} aria-label={dict.common.close}>
            <X size={18} />
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.nav}>
            <button
              className={`${styles.navItem} ${activeTab === "general" ? styles.activeNav : ""}`}
              onClick={() => setActiveTab("general")}
            >
              {dict.settings.generalTab}
            </button>
            <button
              className={`${styles.navItem} ${activeTab === "indexing" ? styles.activeNav : ""}`}
              onClick={() => setActiveTab("indexing")}
            >
              {dict.settings.indexingTab}
            </button>
            <button
              className={`${styles.navItem} ${activeTab === "about" ? styles.activeNav : ""}`}
              onClick={() => setActiveTab("about")}
            >
              FinestFile
            </button>
          </div>

          <div className={styles.tabContent}>
            {activeTab === "general" && (
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>{dict.settings.language}</h3>
                <div className={styles.row}>
                  <label>{dict.settings.language}</label>
                  <select
                    value={localSettings.language || "en"}
                    onChange={(e) => {
                      const updated = {
                        ...localSettings,
                        language: e.target.value as any,
                      };
                      setLocalSettings(updated);
                      // Apply language change immediately
                      onSaveSettings(updated);
                    }}
                  >
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.nativeName} ({lang.name})
                      </option>
                    ))}
                  </select>
                </div>

                <h3 className={styles.sectionTitle} style={{ marginTop: 18 }}>
                  {dict.settings.generalTab}
                </h3>
                <div className={styles.row}>
                  <label>{dict.settings.theme}</label>
                  <select
                    value={localSettings.theme}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        theme: e.target.value as "system" | "light" | "dark",
                      })
                    }
                  >
                    <option value="system">{dict.settings.systemTheme}</option>
                    <option value="light">{dict.settings.lightTheme}</option>
                    <option value="dark">{dict.settings.darkTheme}</option>
                  </select>
                </div>

                <div className={styles.row}>
                  <label>{dict.settings.accentColor}</label>
                  <select
                    value={localSettings.accentColor || "blue"}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        accentColor: e.target.value as any,
                      })
                    }
                  >
                    <option value="blue">{dict.settings.colors.blue}</option>
                    <option value="teal">{dict.settings.colors.teal}</option>
                    <option value="purple">{dict.settings.colors.purple}</option>
                    <option value="amber">{dict.settings.colors.amber}</option>
                    <option value="emerald">{dict.settings.colors.emerald}</option>
                    <option value="slate">{dict.settings.colors.slate}</option>
                  </select>
                </div>

                <div className={styles.row}>
                  <label>{dict.settings.fontFamily}</label>
                  <select
                    value={localSettings.fontFamily || "system"}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        fontFamily: e.target.value as any,
                      })
                    }
                  >
                    <option value="system">{dict.settings.fonts.system}</option>
                    <option value="segoe">{dict.settings.fonts.segoe}</option>
                    <option value="aptos">{dict.settings.fonts.aptos}</option>
                    <option value="cascadia">{dict.settings.fonts.cascadia}</option>
                    <option value="consolas">{dict.settings.fonts.consolas}</option>
                  </select>
                </div>

                <div className={styles.row}>
                  <label>{dict.settings.fontSize}</label>
                  <select
                    value={localSettings.fontSize || "medium"}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        fontSize: e.target.value as any,
                      })
                    }
                  >
                    <option value="small">{dict.settings.smallSize}</option>
                    <option value="medium">{dict.settings.mediumSize}</option>
                    <option value="large">{dict.settings.largeSize}</option>
                  </select>
                </div>

                <div className={styles.row}>
                  <label>{dict.view.view}</label>
                  <select
                    value={localSettings.defaultViewMode}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        defaultViewMode: e.target.value as "details" | "grid",
                      })
                    }
                  >
                    <option value="details">{dict.view.details}</option>
                    <option value="grid">{dict.view.grid}</option>
                  </select>
                </div>

                <h3 className={styles.sectionTitle} style={{ marginTop: 20 }}>
                  {dict.operations.deleteConfirmTitle}
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
                  <label htmlFor="showHidden">{dict.settings.showHidden}</label>
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
                  <label htmlFor="showExts">{dict.settings.showExtensions}</label>
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
                  <label htmlFor="confirmDelete">{dict.settings.confirmDelete}</label>
                </div>

                <div className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    id="dualPane"
                    checked={localSettings.dualPaneEnabled}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        dualPaneEnabled: e.target.checked,
                      })
                    }
                  />
                  <label htmlFor="dualPane">{dict.settings.dualPane}</label>
                </div>
              </div>
            )}

            {activeTab === "indexing" && (
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>{dict.indexing.title}</h3>
                <p className={styles.desc}>{dict.indexing.description}</p>

                <div className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    id="indexEnabled"
                    checked={localSettings.index.enabled}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        index: { ...localSettings.index, enabled: e.target.checked },
                      })
                    }
                  />
                  <label htmlFor="indexEnabled">{dict.indexing.enabled}</label>
                </div>

                <div className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    id="indexAutoWatch"
                    checked={localSettings.index.autoWatch}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        index: { ...localSettings.index, autoWatch: e.target.checked },
                      })
                    }
                  />
                  <label htmlFor="indexAutoWatch">{dict.indexing.autoWatch}</label>
                </div>

                <div className={styles.statusBox}>
                  <div className={styles.statusRow}>
                    <span>{dict.indexing.statusIdle}:</span>
                    <strong>
                      {indexStatus?.isScanning
                        ? dict.indexing.statusScanning
                        : dict.indexing.statusIdle}
                    </strong>
                  </div>
                  <div className={styles.statusRow}>
                    <span>{dict.indexing.totalFiles}:</span>
                    <strong className="fileSize">{indexStatus?.totalFiles?.toLocaleString() ?? 0}</strong>
                  </div>
                  <div className={styles.statusRow}>
                    <span>{dict.indexing.totalFolders}:</span>
                    <strong className="fileSize">{indexStatus?.totalFolders?.toLocaleString() ?? 0}</strong>
                  </div>
                  <div className={styles.statusRow}>
                    <span>{dict.indexing.totalSize}:</span>
                    <strong className="fileSize">{formatBytes(indexStatus?.totalBytes ?? 0)}</strong>
                  </div>
                  <div className={styles.statusRow}>
                    <span>{dict.indexing.lastScan}:</span>
                    <span>
                      {indexStatus?.lastScan
                        ? formatDateTime(indexStatus.lastScan)
                        : dict.indexing.never}
                    </span>
                  </div>
                </div>

                <div className={styles.indexActions}>
                  {indexStatus?.isScanning ? (
                    <button className={styles.actionBtn} onClick={onCancelIndexScan}>
                      <Square size={14} /> {dict.indexing.cancelScan}
                    </button>
                  ) : (
                    <button className={styles.actionBtnPrimary} onClick={onStartIndexScan}>
                      <Play size={14} /> {dict.indexing.startScan}
                    </button>
                  )}
                  <button className={styles.actionBtn} onClick={onClearIndex}>
                    <RotateCcw size={14} /> {dict.indexing.clearIndex}
                  </button>
                </div>

                <h4 style={{ fontSize: 12, marginTop: 18, marginBottom: 6 }}>
                  {dict.indexing.monitoredRoots}
                </h4>
                <div className={styles.rootsList}>
                  {localSettings.index.roots.length === 0 ? (
                    <div className={styles.noRoots}>No specific roots configured.</div>
                  ) : (
                    localSettings.index.roots.map((r) => (
                      <div key={r} className={styles.rootItem}>
                        <span className="filePath" dir="ltr">{r}</span>
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
                    className="filePath"
                    dir="ltr"
                    placeholder="C:\Users\Username\Documents"
                    value={newRootPath}
                    onChange={(e) => setNewRootPath(e.target.value)}
                  />
                  <button onClick={handleAddRoot}>{dict.common.apply}</button>
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
            {dict.common.cancel}
          </button>
          <button className={styles.saveBtn} onClick={handleSave}>
            {dict.common.save}
          </button>
        </div>
      </div>
    </div>
  );
};
