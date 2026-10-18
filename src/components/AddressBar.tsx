import React, { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  RotateCw,
  Search,
  ChevronRight,
  X,
} from "lucide-react";
import { useI18n } from "../i18n";
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
  focusAddressTrigger,
  focusSearchTrigger,
}) => {
  const { dict, dir } = useI18n();
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(currentPath);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  const getBreadcrumbs = () => {
    const parts = currentPath.split(/[/\\]+/).filter(Boolean);
    const crumbs: { name: string; path: string }[] = [];

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
          className={`${styles.iconBtn} ${dir === "rtl" ? "rtlMirror" : ""}`}
          disabled={!canGoBack}
          onClick={onGoBack}
          title={`${dict.common.back} (Alt+Left)`}
        >
          <ArrowLeft size={16} />
        </button>
        <button
          className={`${styles.iconBtn} ${dir === "rtl" ? "rtlMirror" : ""}`}
          disabled={!canGoForward}
          onClick={onGoForward}
          title={`${dict.common.forward} (Alt+Right)`}
        >
          <ArrowRight size={16} />
        </button>
        <button
          className={styles.iconBtn}
          onClick={onGoUp}
          title={`${dict.common.up} (Alt+Up, Backspace)`}
        >
          <ArrowUp size={16} />
        </button>
        <button
          className={styles.iconBtn}
          onClick={onRefresh}
          title={`${dict.common.refresh} (F5, Ctrl+R)`}
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
            className={`${styles.addressInput} addressInput filePath`}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => setIsEditing(false)}
            autoFocus
            spellCheck={false}
            dir="ltr"
          />
        ) : (
          <div className={`${styles.breadcrumbs} filePath`} dir="ltr">
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
          placeholder={dict.nav.searchPlaceholder}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          spellCheck={false}
        />
        {searchQuery ? (
          <button className={styles.clearSearchBtn} onClick={onClearSearch} title={dict.common.clear}>
            <X size={14} />
          </button>
        ) : null}
      </div>
    </div>
  );
};
