import React from "react";
import { FileEntry } from "../types";
import {
  FolderPlus,
  FilePlus,
  Copy,
  Scissors,
  Clipboard,
  Trash2,
  Edit2,
  FileArchive,
  FolderArchive,
  Info,
  ExternalLink,
} from "lucide-react";
import styles from "./ContextMenu.module.css";

export interface ContextMenuProps {
  x: number;
  y: number;
  selectedItems: FileEntry[];
  hasClipboard: boolean;
  onClose: () => void;
  onOpen: () => void;
  onOpenWith: () => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onRename: () => void;
  onDelete: (permanent: boolean) => void;
  onCopyPath: () => void;
  onNewFolder: () => void;
  onNewFile: () => void;
  onCreateArchive: () => void;
  onExtractArchive: () => void;
  onProperties: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  selectedItems,
  hasClipboard,
  onClose,
  onOpen,
  onOpenWith,
  onCopy,
  onCut,
  onPaste,
  onRename,
  onDelete,
  onCopyPath,
  onNewFolder,
  onNewFile,
  onCreateArchive,
  onExtractArchive,
  onProperties,
}) => {
  const isBackground = selectedItems.length === 0;
  const isSingle = selectedItems.length === 1;
  const single = isSingle ? selectedItems[0] : null;
  const isArchive = single && ["zip", "7z", "rar", "tar", "gz"].includes(single.ext.toLowerCase());

  // Keep menu within viewport bounds
  const menuStyle = {
    top: Math.min(y, window.innerHeight - 320),
    left: Math.min(x, window.innerWidth - 220),
  };

  return (
    <div className={styles.overlay} onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }}>
      <div
        className={styles.menu}
        style={menuStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {!isBackground ? (
          <>
            <button className={styles.item} onClick={() => { onOpen(); onClose(); }}>
              <ExternalLink size={15} />
              <span>Open</span>
            </button>
            <button className={styles.item} onClick={() => { onOpenWith(); onClose(); }}>
              <span>Open with...</span>
            </button>

            {isArchive && (
              <button className={styles.item} onClick={() => { onExtractArchive(); onClose(); }}>
                <FolderArchive size={15} />
                <span>Extract All...</span>
              </button>
            )}

            <div className={styles.separator} />

            <button className={styles.item} onClick={() => { onCut(); onClose(); }}>
              <Scissors size={15} />
              <span>Cut</span>
              <span className={styles.shortcut}>Ctrl+X</span>
            </button>
            <button className={styles.item} onClick={() => { onCopy(); onClose(); }}>
              <Copy size={15} />
              <span>Copy</span>
              <span className={styles.shortcut}>Ctrl+C</span>
            </button>
            <button className={styles.item} onClick={() => { onCopyPath(); onClose(); }}>
              <span>Copy as path</span>
            </button>

            <div className={styles.separator} />

            <button className={styles.item} onClick={() => { onCreateArchive(); onClose(); }}>
              <FileArchive size={15} />
              <span>Compress to ZIP</span>
            </button>

            {isSingle && (
              <button className={styles.item} onClick={() => { onRename(); onClose(); }}>
                <Edit2 size={15} />
                <span>Rename</span>
                <span className={styles.shortcut}>F2</span>
              </button>
            )}

            <button className={styles.item} onClick={() => { onDelete(false); onClose(); }}>
              <Trash2 size={15} />
              <span>Delete</span>
              <span className={styles.shortcut}>Del</span>
            </button>

            <div className={styles.separator} />

            <button className={styles.item} onClick={() => { onProperties(); onClose(); }}>
              <Info size={15} />
              <span>Properties</span>
              <span className={styles.shortcut}>Alt+Enter</span>
            </button>
          </>
        ) : (
          <>
            <button className={styles.item} onClick={() => { onNewFolder(); onClose(); }}>
              <FolderPlus size={15} />
              <span>New folder</span>
              <span className={styles.shortcut}>Ctrl+Shift+N</span>
            </button>
            <button className={styles.item} onClick={() => { onNewFile(); onClose(); }}>
              <FilePlus size={15} />
              <span>New text document</span>
            </button>

            <div className={styles.separator} />

            <button
              className={styles.item}
              disabled={!hasClipboard}
              onClick={() => { onPaste(); onClose(); }}
            >
              <Clipboard size={15} />
              <span>Paste</span>
              <span className={styles.shortcut}>Ctrl+V</span>
            </button>

            <div className={styles.separator} />

            <button className={styles.item} onClick={() => { onProperties(); onClose(); }}>
              <Info size={15} />
              <span>Properties</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
