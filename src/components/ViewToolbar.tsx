import React, { useState, useRef, useEffect } from "react";
import {
  SortField,
  SortDirection,
  GroupMode,
  ViewPreferences,
} from "../types";
import {
  ArrowUpDown,
  Layers,
  LayoutGrid,
  List,
  Check,
  ChevronDown,
  RotateCcw,
} from "lucide-react";
import styles from "./ViewToolbar.module.css";

interface ViewToolbarProps {
  viewMode: "details" | "grid";
  onViewModeChange: (mode: "details" | "grid") => void;
  prefs: ViewPreferences;
  onPrefsChange: (newPrefs: ViewPreferences) => void;
  onResetView: () => void;
}

export const ViewToolbar: React.FC<ViewToolbarProps> = ({
  viewMode,
  onViewModeChange,
  prefs,
  onPrefsChange,
  onResetView,
}) => {
  const [sortOpen, setSortOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);

  const sortRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
      if (groupRef.current && !groupRef.current.contains(e.target as Node)) {
        setGroupOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const sortFields: { id: SortField; label: string }[] = [
    { id: "name", label: "Name" },
    { id: "date_modified", label: "Date modified" },
    { id: "extension", label: "Type" },
    { id: "size", label: "Size" },
    { id: "date_created", label: "Date created" },
    { id: "date_accessed", label: "Date last accessed" },
    { id: "attributes", label: "Attributes" },
  ];

  const groupModes: { id: GroupMode; label: string }[] = [
    { id: "none", label: "(None)" },
    { id: "name_range", label: "Name" },
    { id: "date_modified", label: "Date modified" },
    { id: "extension", label: "Type" },
    { id: "size", label: "Size" },
    { id: "date_created", label: "Date created" },
    { id: "attributes", label: "Attributes" },
  ];

  return (
    <div className={styles.toolbar}>
      {/* View Switcher (Details vs Grid) */}
      <div className={styles.buttonGroup}>
        <button
          className={`${styles.toolBtn} ${viewMode === "details" ? styles.active : ""}`}
          onClick={() => onViewModeChange("details")}
          title="Details view"
        >
          <List size={15} />
          <span>Details</span>
        </button>
        <button
          className={`${styles.toolBtn} ${viewMode === "grid" ? styles.active : ""}`}
          onClick={() => onViewModeChange("grid")}
          title="Grid view"
        >
          <LayoutGrid size={15} />
          <span>Grid</span>
        </button>
      </div>

      <div className={styles.divider} />

      {/* Sort By Dropdown */}
      <div className={styles.dropdownContainer} ref={sortRef}>
        <button
          className={`${styles.toolBtn} ${sortOpen ? styles.open : ""}`}
          onClick={() => {
            setSortOpen(!sortOpen);
            setGroupOpen(false);
          }}
          title="Sort by..."
        >
          <ArrowUpDown size={15} />
          <span>Sort</span>
          <ChevronDown size={12} className={styles.chevron} />
        </button>

        {sortOpen && (
          <div className={styles.menu}>
            <div className={styles.menuHeader}>Sort by</div>
            {sortFields.map((f) => {
              const isSelected = prefs.sortField === f.id;
              return (
                <button
                  key={f.id}
                  className={styles.menuItem}
                  onClick={() => {
                    onPrefsChange({ ...prefs, sortField: f.id });
                    setSortOpen(false);
                  }}
                >
                  <span className={styles.menuCheck}>
                    {isSelected && <Check size={13} color="var(--accent)" />}
                  </span>
                  <span>{f.label}</span>
                </button>
              );
            })}

            <div className={styles.menuDivider} />

            <button
              className={styles.menuItem}
              onClick={() => {
                onPrefsChange({ ...prefs, sortDirection: "ascending" });
                setSortOpen(false);
              }}
            >
              <span className={styles.menuCheck}>
                {prefs.sortDirection === "ascending" && (
                  <Check size={13} color="var(--accent)" />
                )}
              </span>
              <span>Ascending</span>
            </button>
            <button
              className={styles.menuItem}
              onClick={() => {
                onPrefsChange({ ...prefs, sortDirection: "descending" });
                setSortOpen(false);
              }}
            >
              <span className={styles.menuCheck}>
                {prefs.sortDirection === "descending" && (
                  <Check size={13} color="var(--accent)" />
                )}
              </span>
              <span>Descending</span>
            </button>

            <div className={styles.menuDivider} />

            <button
              className={styles.menuItem}
              onClick={() => {
                onPrefsChange({ ...prefs, foldersFirst: !prefs.foldersFirst });
                setSortOpen(false);
              }}
            >
              <span className={styles.menuCheck}>
                {prefs.foldersFirst && <Check size={13} color="var(--accent)" />}
              </span>
              <span>Keep folders on top</span>
            </button>
          </div>
        )}
      </div>

      {/* Group By Dropdown */}
      <div className={styles.dropdownContainer} ref={groupRef}>
        <button
          className={`${styles.toolBtn} ${prefs.groupMode !== "none" ? styles.hasGroup : ""} ${
            groupOpen ? styles.open : ""
          }`}
          onClick={() => {
            setGroupOpen(!groupOpen);
            setSortOpen(false);
          }}
          title="Group by..."
        >
          <Layers size={15} />
          <span>
            Group
            {prefs.groupMode !== "none" ? ` (${prefs.groupMode.replace("_", " ")})` : ""}
          </span>
          <ChevronDown size={12} className={styles.chevron} />
        </button>

        {groupOpen && (
          <div className={styles.menu}>
            <div className={styles.menuHeader}>Group by</div>
            {groupModes.map((g) => {
              const isSelected = prefs.groupMode === g.id;
              return (
                <button
                  key={g.id}
                  className={styles.menuItem}
                  onClick={() => {
                    onPrefsChange({ ...prefs, groupMode: g.id });
                    setGroupOpen(false);
                  }}
                >
                  <span className={styles.menuCheck}>
                    {isSelected && <Check size={13} color="var(--accent)" />}
                  </span>
                  <span>{g.label}</span>
                </button>
              );
            })}

            {prefs.groupMode !== "none" && (
              <>
                <div className={styles.menuDivider} />

                <button
                  className={styles.menuItem}
                  onClick={() => {
                    onPrefsChange({ ...prefs, groupDirection: "ascending" });
                    setGroupOpen(false);
                  }}
                >
                  <span className={styles.menuCheck}>
                    {prefs.groupDirection === "ascending" && (
                      <Check size={13} color="var(--accent)" />
                    )}
                  </span>
                  <span>Ascending</span>
                </button>
                <button
                  className={styles.menuItem}
                  onClick={() => {
                    onPrefsChange({ ...prefs, groupDirection: "descending" });
                    setGroupOpen(false);
                  }}
                >
                  <span className={styles.menuCheck}>
                    {prefs.groupDirection === "descending" && (
                      <Check size={13} color="var(--accent)" />
                    )}
                  </span>
                  <span>Descending</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className={styles.divider} />

      {/* Reset View Button */}
      <button
        className={styles.toolBtn}
        onClick={onResetView}
        title="Reset view to default sorting and grouping"
      >
        <RotateCcw size={14} />
        <span>Reset view</span>
      </button>
    </div>
  );
};
