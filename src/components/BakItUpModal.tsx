import React, { useState, useEffect } from "react";
import { X, Archive, CheckCircle2, AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";
import { api } from "../api";
import { BackupManifest, RestorePreview, RestorePolicy } from "../types";
import styles from "./BakItUpModal.module.css";

interface BakItUpModalProps {
  selectedPaths: string[];
  currentDirectory: string;
  onClose: () => void;
  onRefresh?: () => void;
}

export const BakItUpModal: React.FC<BakItUpModalProps> = ({
  selectedPaths,
  currentDirectory,
  onClose,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<"create" | "history">("create");
  const [backupName, setBackupName] = useState("");
  const [targetDir, setTargetDir] = useState(currentDirectory);
  const [isSingleFileBak, setIsSingleFileBak] = useState(true);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // History & Restore state
  const [backups, setBackups] = useState<BackupManifest[]>([]);
  const [selectedBackup, setSelectedBackup] = useState<BackupManifest | null>(null);
  const [restoreDir, setRestoreDir] = useState(currentDirectory);
  const [restorePreview, setRestorePreview] = useState<RestorePreview | null>(null);
  const [restorePolicy, setRestorePolicy] = useState<RestorePolicy>("overwrite_all");
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadBackups();
  }, []);

  const loadBackups = async () => {
    try {
      const list = await api.listAllBackups();
      setBackups(list);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateBackup = async () => {
    const sources = selectedPaths.length > 0 ? selectedPaths : [currentDirectory];
    setLoading(true);
    setStatusMsg(null);
    try {
      const manifest = await api.createBackup(
        sources,
        targetDir,
        backupName.trim() || undefined,
        isSingleFileBak
      );
      setStatusMsg(`Backup "${manifest.name}" completed successfully! (${manifest.totalFiles} files, ${manifest.totalSize} bytes)`);
      loadBackups();
      onRefresh?.();
    } catch (e: any) {
      setStatusMsg(`Error creating backup: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (manifest: BackupManifest) => {
    setVerifyingId(manifest.backupId);
    try {
      const res = await api.verifyBackup(manifest.backupRootDir);
      setVerificationStatus((prev) => ({ ...prev, [manifest.backupId]: res.isValid }));
    } catch (e) {
      setVerificationStatus((prev) => ({ ...prev, [manifest.backupId]: false }));
    } finally {
      setVerifyingId(null);
    }
  };

  const handleSelectForRestore = async (manifest: BackupManifest) => {
    setSelectedBackup(manifest);
    try {
      const preview = await api.previewRestore(manifest.backupRootDir, restoreDir);
      setRestorePreview(preview);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRestore = async () => {
    if (!selectedBackup) return;
    setLoading(true);
    try {
      const count = await api.restoreBackup(selectedBackup.backupRootDir, restoreDir, restorePolicy);
      setStatusMsg(`Restored ${count} files successfully!`);
      setSelectedBackup(null);
      setRestorePreview(null);
      onRefresh?.();
    } catch (e: any) {
      setStatusMsg(`Error restoring: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  const targets = selectedPaths.length > 0 ? selectedPaths : [currentDirectory];

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.headerTitle}>
            <Archive size={18} color="var(--accent)" />
            <span>Bak-it-Up! Backup System</span>
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className={styles.tabs}>
          <button
            className={`${styles.tabBtn} ${activeTab === "create" ? styles.active : ""}`}
            onClick={() => setActiveTab("create")}
          >
            Create Backup
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === "history" ? styles.active : ""}`}
            onClick={() => {
              setActiveTab("history");
              loadBackups();
            }}
          >
            Backup History & Restore ({backups.length})
          </button>
        </div>

        <div className={styles.modalBody}>
          {statusMsg && (
            <div className={styles.conflictWarning}>
              {statusMsg}
            </div>
          )}

          {activeTab === "create" && (
            <>
              <div className={styles.formGroup}>
                <span className={styles.label}>Items to Back Up ({targets.length}):</span>
                <div className={styles.sourceList}>
                  {targets.map((p, idx) => (
                    <div key={idx} className={styles.sourceItem} title={p}>
                      {p}
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Backup Label / Name (optional):</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="e.g. Project_Draft_Release"
                  value={backupName}
                  onChange={(e) => setBackupName(e.target.value)}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Destination Folder:</label>
                <input
                  type="text"
                  className={styles.input}
                  value={targetDir}
                  onChange={(e) => setTargetDir(e.target.value)}
                />
              </div>

              {targets.length === 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <input
                    type="checkbox"
                    id="singleFileBak"
                    checked={isSingleFileBak}
                    onChange={(e) => setIsSingleFileBak(e.target.checked)}
                  />
                  <label htmlFor="singleFileBak">
                    Standard structured .bak package with SHA-256 verification manifest
                  </label>
                </div>
              )}
            </>
          )}

          {activeTab === "history" && !selectedBackup && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {backups.length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 24 }}>
                  No previous backups recorded yet.
                </div>
              ) : (
                backups.map((b) => (
                  <div key={b.backupId} className={styles.historyItem}>
                    <div className={styles.historyInfo}>
                      <span className={styles.historyName}>{b.name}</span>
                      <span className={styles.historyMeta}>
                        {new Date(b.createdAtMs).toLocaleString()} • {b.totalFiles} files • {(b.totalSize / 1024).toFixed(1)} KB
                      </span>
                      <span className={styles.historyMeta} style={{ wordBreak: "break-all" }}>
                        {b.backupRootDir}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {verificationStatus[b.backupId] !== undefined && (
                        <span
                          className={`${styles.badge} ${
                            verificationStatus[b.backupId] ? styles.badgeSuccess : styles.badgeDanger
                          }`}
                        >
                          {verificationStatus[b.backupId] ? "SHA-256 Verified" : "Corrupt"}
                        </span>
                      )}

                      <button
                        className={styles.btn}
                        onClick={() => handleVerify(b)}
                        disabled={verifyingId === b.backupId}
                        title="Verify SHA-256 file hashes"
                      >
                        <RefreshCw size={12} className={verifyingId === b.backupId ? "spin" : ""} />
                        Verify
                      </button>

                      <button
                        className={`${styles.btn} ${styles.primaryBtn}`}
                        onClick={() => handleSelectForRestore(b)}
                      >
                        <RotateCcw size={12} />
                        Restore
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "history" && selectedBackup && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>
                Restoring: {selectedBackup.name} ({selectedBackup.totalFiles} files)
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Restore Destination:</label>
                <input
                  type="text"
                  className={styles.input}
                  value={restoreDir}
                  onChange={(e) => {
                    setRestoreDir(e.target.value);
                    api.previewRestore(selectedBackup.backupRootDir, e.target.value)
                      .then(setRestorePreview)
                      .catch(console.error);
                  }}
                />
              </div>

              {restorePreview && restorePreview.conflictsCount > 0 && (
                <div className={styles.conflictWarning}>
                  <AlertTriangle size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                  Warning: {restorePreview.conflictsCount} existing destination files collide with this backup set!
                </div>
              )}

              <div className={styles.formGroup}>
                <label className={styles.label}>Conflict Resolution Policy:</label>
                <select
                  className={styles.input}
                  value={restorePolicy}
                  onChange={(e) => setRestorePolicy(e.target.value as RestorePolicy)}
                >
                  <option value="overwrite_all">Overwrite Existing Files</option>
                  <option value="skip_existing">Skip Existing Files</option>
                  <option value="keep_both">Keep Both (Restore with '(restored)' suffix)</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className={styles.btn} onClick={() => setSelectedBackup(null)}>
                  Back to List
                </button>
                <button
                  className={`${styles.btn} ${styles.primaryBtn}`}
                  onClick={handleRestore}
                  disabled={loading}
                >
                  Confirm & Restore
                </button>
              </div>
            </div>
          )}
        </div>

        {activeTab === "create" && (
          <div className={styles.modalFooter}>
            <button className={styles.btn} onClick={onClose}>
              Cancel
            </button>
            <button
              className={`${styles.btn} ${styles.primaryBtn}`}
              onClick={handleCreateBackup}
              disabled={loading}
            >
              {loading ? "Backing up..." : "Start Bak-it-Up!"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
