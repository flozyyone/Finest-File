import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  RotateCw,
  Search,
  ChevronRight,
  X,
} from "lucide-react";
import styles from "./AddressBar.module.css";

interface AddressBarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  canGoBack: boolean;
  canGoForward: boolean;
  onGoBack: () => void;
  onGoForward: () => void;
  onGoUp: () => void;
  onRefresh: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onClearSearch: () => void;
  isSearching: boolean;
  focusAddressTrigger?: number;
  focusSearchTrigger?: number;
}

export const AddressBar: React.FC<AddressBarProps> = ({
  currentPath,
  onNavigate,
  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward,
  onGoUp,
  onRefresh,
  searchQuery,
  onSearchChange,
  onClearSearch,
  isSearching,
  focusAddressTrigger,
  focusSearchTrigger,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(currentPath);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditText(currentPath);
  }, [currentPath]);

  useEffect(() => {
    if (focusAddressTrigger) {
      setIsEditing(true);
    }
  }, [focusAddressTrigger]);

  useEffect(() => {
    if (focusSearchTrigger && searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.select();
    }
  }, [focusSearchTrigger]);

  // Split path for breadcrumbs
  const getBreadcrumbs = () => {
    const parts = currentPath.split(/[/\\]+/).filter(Boolean);
    const crumbs: { name: string; path: string }[] = [];

    // On Windows, the first element might be "C:"
    let accumulated = "";
    for (let i = 0; i < parts.length; i++) {
      if (i === 0 && parts[i].endsWith(":")) {
        accumulated = parts[i] + "\\";
        crumbs.push({ name: parts[i], path: accumulated });
      } else {
        accumulated = accumulated.endsWith("\\")
          ? accumulated + parts[i]
          : accumulated + "\\" + parts[i];
        crumbs.push({ name: parts[i], path: accumulated });
      }
    }
    return crumbs;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setIsEditing(false);
      if (editText.trim() && editText !== currentPath) {
        onNavigate(editText.trim());
      }
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setEditText(currentPath);
    }
  };

  return (
    <div className={styles.bar}>
      <div className={styles.navButtons}>
        <button
          className={styles.iconBtn}
          disabled={!canGoBack}
          onClick={onGoBack}
          title="Back (Alt+Left Arrow)"
        >
          <ArrowLeft size={16} />
        </button>
        <button
          className={styles.iconBtn}
          disabled={!canGoForward}
          onClick={onGoForward}
          title="Forward (Alt+Right Arrow)"
        >
          <ArrowRight size={16} />
        </button>
        <button
          className={styles.iconBtn}
          onClick={onGoUp}
          title="Up one level (Alt+Up Arrow)"
        >
          <ArrowUp size={16} />
        </button>
        <button
          className={styles.iconBtn}
          onClick={onRefresh}
          title="Refresh (F5, Ctrl+R)"
        >
          <RotateCw size={15} />
        </button>
      </div>

      <div
        className={styles.addressBox}
        onClick={() => {
          if (!isEditing) setIsEditing(true);
        }}
      >
        {isEditing ? (
          <input
            type="text"
            className={styles.addressInput}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => setIsEditing(false)}
            autoFocus
            spellCheck={false}
          />
        ) : (
          <div className={styles.breadcrumbs}>
            {getBreadcrumbs().map((c, i, arr) => (
              <React.Fragment key={c.path}>
                <button
                  className={styles.crumbBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate(c.path);
                  }}
                >
                  {c.name}
                </button>
                {i < arr.length - 1 && (
                  <ChevronRight size={12} className={styles.separator} />
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      <div className={styles.searchBox}>
        <Search size={15} className={styles.searchIcon} />
        <input
          ref={searchInputRef}
          type="text"
          className={styles.searchInput}
          placeholder="Search folder (Ctrl+F, F3)"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          spellCheck={false}
        />
        {searchQuery ? (
          <button className={styles.clearSearchBtn} onClick={onClearSearch}>
            <X size={14} />
          </button>
        ) : null}
      </div>
    </div>
  );
};
