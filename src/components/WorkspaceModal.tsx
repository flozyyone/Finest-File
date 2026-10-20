import React, { useState, useEffect } from "react";
import { X, FolderSync, Trash2, Check, Download, Upload } from "lucide-react";
import { api } from "../api";
import { Workspace } from "../types";
import styles from "./WorkspaceModal.module.css";

interface WorkspaceModalProps {
  onClose: () => void;
  onRestoreWorkspace: (workspace: Workspace) => void;
}

export const WorkspaceModal: React.FC<WorkspaceModalProps> = ({
  onClose,
  onRestoreWorkspace,
}) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadList();
  }, []);

  const loadList = async () => {
    try {
      const list = await api.listWorkspaces();
      setWorkspaces(list);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this saved workspace?")) return;
    try {
      await api.deleteWorkspace(id);
      loadList();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.headerTitle}>
            <FolderSync size={18} color="var(--accent)" />
            <span>Saved Workspaces & Tab Groups</span>
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className={styles.modalBody}>
          {workspaces.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 24 }}>
              No saved workspaces yet. Press "Grupla" on the toolbar or tab bar to group and save your current tabs!
            </div>
          ) : (
            workspaces.map((ws) => (
              <div key={ws.id} className={styles.workspaceItem}>
                <div className={styles.wsInfo}>
                  <span className={styles.wsTitle}>{ws.name}</span>
                  <span className={styles.wsTabs}>
                    {ws.tabs.length} tabs: {ws.tabs.map((t) => t.title || t.path).join(", ")}
                  </span>
                </div>

                <div className={styles.actions}>
                  <button
                    className={`${styles.btn} ${styles.primaryBtn}`}
                    onClick={() => {
                      onRestoreWorkspace(ws);
                      onClose();
                    }}
                  >
                    Open
                  </button>

                  <button
                    className={`${styles.btn} ${styles.dangerBtn}`}
                    onClick={() => handleDelete(ws.id)}
                    title="Delete workspace"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
