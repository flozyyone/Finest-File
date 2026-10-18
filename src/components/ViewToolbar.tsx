import React, { useState, useRef, useEffect } from "react";
import {
  SortField,
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
  Minus,
  Plus,
  PanelRight,
} from "lucide-react";
import { useI18n } from "../i18n";
import styles from "./ViewToolbar.module.css";

interface ViewToolbarProps {
  viewMode: "details" | "grid";
  onViewModeChange: (mode: "details" | "grid") => void;
  prefs: ViewPreferences;
  onPrefsChange: (newPrefs: ViewPreferences) => void;
  onResetView: () => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  previewPaneOpen: boolean;
  onTogglePreviewPane: () => void;
}

export const ViewToolbar: React.FC<ViewToolbarProps> = ({
  viewMode,
  onViewModeChange,
  prefs,
  onPrefsChange,
  onResetView,
  zoom,
  onZoomChange,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  previewPaneOpen,
  onTogglePreviewPane,
}) => {
  const { dict } = useI18n();
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
    { id: "name", label: dict.view.name },
    { id: "date_modified", label: dict.view.dateModified },
    { id: "extension", label: dict.view.type },
    { id: "size", label: dict.view.size },
    { id: "date_created", label: dict.view.dateCreated },
    { id: "date_accessed", label: dict.view.dateAccessed },
    { id: "attributes", label: dict.view.attributes },
  ];

  const groupModes: { id: GroupMode; label: string }[] = [
    { id: "none", label: dict.view.none },
    { id: "name_range", label: dict.view.name },
    { id: "date_modified", label: dict.view.dateModified },
    { id: "extension", label: dict.view.type },
    { id: "size", label: dict.view.size },
    { id: "date_created", label: dict.view.dateCreated },
    { id: "attributes", label: dict.view.attributes },
  ];

  const activeGroupLabel =
    groupModes.find((g) => g.id === prefs.groupMode)?.label || prefs.groupMode;

  return (
    <div className={styles.toolbar}>
      {/* View Switcher (Details vs Grid) */}
      <div className={styles.buttonGroup}>
        <button
          className={`${styles.toolBtn} ${viewMode === "details" ? styles.active : ""}`}
          onClick={() => onViewModeChange("details")}
          title={dict.view.details}
        >
          <List size={15} />
          <span>{dict.view.details}</span>
        </button>
        <button
          className={`${styles.toolBtn} ${viewMode === "grid" ? styles.active : ""}`}
          onClick={() => onViewModeChange("grid")}
          title={dict.view.grid}
        >
          <LayoutGrid size={15} />
          <span>{dict.view.grid}</span>
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
          title={dict.view.sortBy}
        >
          <ArrowUpDown size={15} />
          <span>{dict.view.sortBy}</span>
          <ChevronDown size={12} className={styles.chevron} />
        </button>

        {sortOpen && (
          <div className={styles.menu}>
            <div className={styles.menuHeader}>{dict.view.sortBy}</div>
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
              <span>{dict.view.ascending}</span>
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
              <span>{dict.view.descending}</span>
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
              <span>{dict.view.foldersFirst}</span>
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
          title={dict.view.groupBy}
        >
          <Layers size={15} />
          <span>
            {dict.view.groupBy}
            {prefs.groupMode !== "none" ? ` (${activeGroupLabel})` : ""}
          </span>
          <ChevronDown size={12} className={styles.chevron} />
        </button>

        {groupOpen && (
          <div className={styles.menu}>
            <div className={styles.menuHeader}>{dict.view.groupBy}</div>
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
                  <span>{dict.view.ascending}</span>
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
                  <span>{dict.view.descending}</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className={styles.divider} />

      {/* Size / Zoom Control */}
      <div className={styles.zoomGroup} title={dict.view.view}>
        <button
          className={styles.zoomBtn}
          onClick={onZoomOut}
          disabled={zoom <= 32}
          title={dict.view.zoomOut}
          aria-label={dict.view.zoomOut}
        >
          <Minus size={13} />
        </button>

        <input
          type="range"
          className={styles.zoomSlider}
          min={32}
          max={320}
          step={8}
          value={zoom}
          onChange={(e) => onZoomChange(Number(e.target.value))}
          title={`${zoom} px`}
          aria-label={dict.view.view}
        />

        <button
          className={styles.zoomBtn}
          onClick={onZoomIn}
          disabled={zoom >= 320}
          title={dict.view.zoomIn}
          aria-label={dict.view.zoomIn}
        >
          <Plus size={13} />
        </button>

        <button
          className={styles.zoomIndicator}
          onClick={onZoomReset}
          title={dict.view.resetZoom}
        >
          {zoom} px
        </button>
      </div>

      <div className={styles.divider} />

      {/* Preview Pane Toggle Button */}
      <button
        className={`${styles.toolBtn} ${previewPaneOpen ? styles.active : ""}`}
        onClick={onTogglePreviewPane}
        title={`${dict.view.previewPane} (Alt + P)`}
      >
        <PanelRight size={15} />
        <span>{dict.view.previewPane}</span>
      </button>

      <div className={styles.divider} />

      {/* Reset View Button */}
      <button
        className={styles.toolBtn}
        onClick={onResetView}
        title={dict.view.resetView}
      >
        <RotateCcw size={14} />
        <span>{dict.view.resetView}</span>
      </button>
    </div>
  );
};
