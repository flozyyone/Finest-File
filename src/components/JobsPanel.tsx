import React from "react";
import { JobProgress } from "../types";
import { formatBytes } from "../utils/format";
import { X, CheckCircle, AlertCircle, Ban, Loader2, Trash } from "lucide-react";
import styles from "./JobsPanel.module.css";

interface JobsPanelProps {
  jobs: JobProgress[];
  isOpen: boolean;
  onClose: () => void;
  onCancelJob: (id: number) => void;
  onClearFinished: () => void;
}

export const JobsPanel: React.FC<JobsPanelProps> = ({
  jobs,
  isOpen,
  onClose,
  onCancelJob,
  onClearFinished,
}) => {
  if (!isOpen) return null;

  const getStateIcon = (state: JobProgress["state"]) => {
    switch (state) {
      case "running":
        return <Loader2 size={16} className={styles.spinner} />;
      case "completed":
        return <CheckCircle size={16} color="var(--status-success)" />;
      case "failed":
        return <AlertCircle size={16} color="var(--status-error)" />;
      case "cancelled":
        return <Ban size={16} color="var(--text-subtle)" />;
      default:
        return <Loader2 size={16} color="var(--text-muted)" />;
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>File Operations</span>
          <div className={styles.headerActions}>
            <button
              className={styles.headerBtn}
              onClick={onClearFinished}
              title="Clear finished"
            >
              <Trash size={14} />
              <span>Clear</span>
            </button>
            <button className={styles.closeBtn} onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div className={styles.body}>
          {jobs.length === 0 ? (
            <div className={styles.empty}>No recent file operations</div>
          ) : (
            jobs.map((job) => {
              const pct =
                job.bytesTotal > 0
                  ? Math.round((job.bytesDone / job.bytesTotal) * 100)
                  : job.itemsTotal > 0
                  ? Math.round((job.itemsDone / job.itemsTotal) * 100)
                  : 0;

              return (
                <div key={job.id} className={styles.jobItem}>
                  <div className={styles.jobTop}>
                    <div className={styles.jobTitleRow}>
                      {getStateIcon(job.state)}
                      <span className={styles.jobTitle}>{job.title}</span>
                    </div>
                    {job.state === "running" && (
                      <button
                        className={styles.cancelBtn}
                        onClick={() => onCancelJob(job.id)}
                      >
                        Cancel
                      </button>
                    )}
                  </div>

                  {job.current && (
                    <div className={styles.jobCurrent} title={job.current}>
                      {job.current}
                    </div>
                  )}

                  {job.state === "running" && (
                    <div className={styles.progressContainer}>
                      <div className={styles.progressBar}>
                        <div
                          className={styles.progressFill}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className={styles.progressText}>
                        <span>
                          {job.bytesTotal > 0
                            ? `${formatBytes(job.bytesDone)} / ${formatBytes(job.bytesTotal)}`
                            : `${job.itemsDone} / ${job.itemsTotal} items`}
                        </span>
                        <span>{pct}%</span>
                      </div>
                    </div>
                  )}

                  {job.error && (
                    <div className={styles.errorMessage}>{job.error.message}</div>
                  )}

                  {job.warningCount > 0 && (
                    <div className={styles.warningMessage}>
                      {job.warningCount} warning(s): {job.warnings.slice(0, 2).join("; ")}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
