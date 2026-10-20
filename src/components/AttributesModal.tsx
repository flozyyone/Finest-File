import React, { useState } from "react";
import { X, Sliders } from "lucide-react";
import { api } from "../api";
import { FileEntry } from "../types";
import styles from "./AttributesModal.module.css";

interface AttributesModalProps {
  selectedItems: FileEntry[];
  onClose: () => void;
  onRefresh?: () => void;
}

export const AttributesModal: React.FC<AttributesModalProps> = ({
  selectedItems,
  onClose,
  onRefresh,
}) => {
  const primaryItem = selectedItems[0];

  // Attribute flags
  const [readOnly, setReadOnly] = useState<boolean>(primaryItem ? primaryItem.readonly : false);
  const [hidden, setHidden] = useState<boolean>(primaryItem ? primaryItem.hidden : false);
  const [system, setSystem] = useState<boolean>(primaryItem ? primaryItem.system : false);
  const [archive, setArchive] = useState<boolean>(
    primaryItem ? (primaryItem.attributes & 0x20) !== 0 : true
  );

  // Times in ISO strings for datetime-local input
  const formatForInput = (ms?: number) => {
    if (!ms) return "";
    const d = new Date(ms);
    // Pad to local ISO YYYY-MM-DDTHH:mm
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  };

  const [createdTime, setCreatedTime] = useState<string>(formatForInput(primaryItem?.created));
  const [modifiedTime, setModifiedTime] = useState<string>(formatForInput(primaryItem?.modified));
  const [accessedTime, setAccessedTime] = useState<string>(formatForInput(primaryItem?.accessed));
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      const createdMs = createdTime ? new Date(createdTime).getTime() : undefined;
      const modifiedMs = modifiedTime ? new Date(modifiedTime).getTime() : undefined;
      const accessedMs = accessedTime ? new Date(accessedTime).getTime() : undefined;

      for (const item of selectedItems) {
        await api.setFileAttributes({
          path: item.path,
          readonly: readOnly,
          hidden,
          system,
          archive,
        });

        await api.setFileTimes({
          path: item.path,
          createdMs,
          modifiedMs,
          accessedMs,
        });
      }

      onRefresh?.();
      onClose();
    } catch (e) {
      console.error(e);
      alert(`Error saving attributes: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.headerTitle}>
            <Sliders size={18} color="var(--accent)" />
            <span>
              Attributes & Times {selectedItems.length > 1 ? `(${selectedItems.length} items)` : ""}
            </span>
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Windows File Attributes</div>
            <div className={styles.checkboxGrid}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={readOnly}
                  onChange={(e) => setReadOnly(e.target.checked)}
                />
                <span>Read-only (R)</span>
              </label>

              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={hidden}
                  onChange={(e) => setHidden(e.target.checked)}
                />
                <span>Hidden (H)</span>
              </label>

              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={archive}
                  onChange={(e) => setArchive(e.target.checked)}
                />
                <span>Archive (A)</span>
              </label>

              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={system}
                  onChange={(e) => setSystem(e.target.checked)}
                />
                <span>System (S)</span>
              </label>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>File Timestamps (Local Timezone)</div>
            <div className={styles.timeRow}>
              <span className={styles.timeLabel}>Created:</span>
              <input
                type="datetime-local"
                className={styles.timeInput}
                value={createdTime}
                onChange={(e) => setCreatedTime(e.target.value)}
              />
            </div>

            <div className={styles.timeRow}>
              <span className={styles.timeLabel}>Modified:</span>
              <input
                type="datetime-local"
                className={styles.timeInput}
                value={modifiedTime}
                onChange={(e) => setModifiedTime(e.target.value)}
              />
            </div>

            <div className={styles.timeRow}>
              <span className={styles.timeLabel}>Accessed:</span>
              <input
                type="datetime-local"
                className={styles.timeInput}
                value={accessedTime}
                onChange={(e) => setAccessedTime(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button
            className={`${styles.btn} ${styles.primaryBtn}`}
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? "Applying..." : "Apply Changes"}
          </button>
        </div>
      </div>
    </div>
  );
};
