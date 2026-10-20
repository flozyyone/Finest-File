import React, { useState, useEffect, useCallback } from "react";
import { List, LayoutGrid } from "lucide-react";
import { api } from "./api";
import { ViewToolbar } from "./components/ViewToolbar";
import {
  FileEntry,
  FileGroup,
  SortField,
  ViewPreferences,
  SystemInfo,
  AppSettings,
  JobProgress,
  IndexStatus,
  ViewMode,
} from "./types";
import { Sidebar } from "./components/Sidebar";
import { TabBar, TabItem } from "./components/TabBar";
import { AddressBar } from "./components/AddressBar";
import { FileList } from "./components/FileList";
import { ContextMenu } from "./components/ContextMenu";
import { JobsPanel } from "./components/JobsPanel";
import { SettingsModal } from "./components/SettingsModal";
import { ShortcutModal } from "./components/ShortcutModal";
import { PreviewPane } from "./components/PreviewPane";
import { QuickPreviewModal } from "./components/QuickPreviewModal";
import { BakItUpModal } from "./components/BakItUpModal";
import { AttributesModal } from "./components/AttributesModal";
import { WorkspaceModal } from "./components/WorkspaceModal";
import { Workspace } from "./types";
import { isInputFocused, matchesShortcutId } from "./shortcuts/registry";
import { undoStack } from "./utils/undoStack";
import { formatBytes } from "./utils/format";
import { I18nProvider, detectInitialLanguage, getLanguageInfo, getDictionary } from "./i18n";
import type { SupportedLanguage } from "./i18n/types";
import styles from "./App.module.css";

const defaultViewPreferences: ViewPreferences = {
  sortField: "name",
  sortDirection: "ascending",
  groupMode: "none",
  groupDirection: "ascending",
  foldersFirst: true,
};

export const App: React.FC = () => {
  const [systemInfo, setSystemInfo] = useState<SystemInfo>({
    drives: [],
    knownFolders: [],
  });
  const [settings, setSettings] = useState<AppSettings>({
    theme: "system",
    accentColor: "blue",
    fontFamily: "system",
    fontSize: "medium",
    language: detectInitialLanguage(),
    showHiddenFiles: false,
    showFileExtensions: true,
    defaultViewMode: "details",
    dualPaneEnabled: false,
    confirmDelete: true,
    viewPreferences: defaultViewPreferences,
    index: {
      enabled: false,
      roots: [],
      excludedPatterns: [],
      autoWatch: false,
    },
  });

  // Tab management
  const [tabs, setTabs] = useState<TabItem[]>([
    {
      id: "tab-1",
      path: "C:\\",
      title: "Local Disk (C:)",
      history: ["C:\\"],
      historyIndex: 0,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>("tab-1");
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  // Directory listing & entries
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [groupedFiles, setGroupedFiles] = useState<FileGroup[]>([]);
  const [viewPreferences, setViewPreferences] = useState<ViewPreferences>(defaultViewPreferences);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("details");

  // Clipboard for cut/copy
  const [clipboard, setClipboard] = useState<{
    paths: string[];
    mode: "copy" | "move";
  } | null>(null);

  // Background jobs & indexing
  const [jobs, setJobs] = useState<JobProgress[]>([]);
  const [isJobsOpen, setIsJobsOpen] = useState(false);
  const [indexStatus, setIndexStatus] = useState<IndexStatus | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const activeJobCount = jobs.filter((j) => j.state === "running" || j.state === "queued").length;

  // Context Menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    selected: FileEntry[];
  } | null>(null);

  // Shortcut & Focus triggers
  const [focusAddressTrigger, setFocusAddressTrigger] = useState(0);
  const [focusSearchTrigger, setFocusSearchTrigger] = useState(0);
  const [isShortcutModalOpen, setIsShortcutModalOpen] = useState(false);
  const [gridZoom, setGridZoom] = useState(96);
  const [previewPaneOpen, setPreviewPaneOpen] = useState(false);
  const [quickPreviewPath, setQuickPreviewPath] = useState<string | null>(null);
  const [isBakItUpOpen, setIsBakItUpOpen] = useState(false);
  const [isAttributesOpen, setIsAttributesOpen] = useState(false);
  const [isWorkspacesOpen, setIsWorkspacesOpen] = useState(false);

  const MIN_ZOOM = 32;
  const MAX_ZOOM = 320;
  const DEFAULT_ZOOM = 96;
  const ZOOM_STEP = 16;
  // Discrete zoom steps matching Windows File Explorer
  const EXPLORER_STEPS = [48, 72, 96, 128, 192, 256];

  const handleZoomIn = useCallback(() => {
    setSettings((s) => {
      if (s.windowsExplorerMode) {
        setViewMode((current) => {
          let nextMode: ViewMode = current;
          if (current === "details") nextMode = "list";
          else if (current === "list") nextMode = "tiles";
          else if (current === "tiles") nextMode = "content";
          else if (current === "content") nextMode = "medium-icons";
          else if (current === "medium-icons") nextMode = "large-icons";
          else if (current === "large-icons") nextMode = "extra-large-icons";
          else if (current === "small-icons") nextMode = "medium-icons";
          else if (current === "extra-large-icons") nextMode = "extra-large-icons";
          else nextMode = "large-icons";

          const updatedSettings = { ...s, defaultViewMode: nextMode };
          api.updateSettings(updatedSettings).catch(console.error);
          return nextMode;
        });
        return s;
      }

      setViewMode("grid");
      setGridZoom((z) => {
        const next = EXPLORER_STEPS.find((st) => st > z) ?? Math.min(MAX_ZOOM, z + ZOOM_STEP);
        const clamped = Math.min(MAX_ZOOM, next);
        const updatedSettings = { ...s, gridPixelSize: clamped, defaultViewMode: "grid" as const };
        api.updateSettings(updatedSettings).catch(console.error);
        return clamped;
      });
      return s;
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    setSettings((s) => {
      if (s.windowsExplorerMode) {
        setViewMode((current) => {
          let prevMode: ViewMode = current;
          if (current === "extra-large-icons") prevMode = "large-icons";
          else if (current === "large-icons") prevMode = "medium-icons";
          else if (current === "medium-icons") prevMode = "content";
          else if (current === "content") prevMode = "tiles";
          else if (current === "tiles") prevMode = "list";
          else if (current === "list") prevMode = "details";
          else if (current === "small-icons") prevMode = "details";
          else if (current === "details") prevMode = "details";
          else prevMode = "details";

          const updatedSettings = { ...s, defaultViewMode: prevMode };
          api.updateSettings(updatedSettings).catch(console.error);
          return prevMode;
        });
        return s;
      }

      setGridZoom((z) => {
        const prevSteps = EXPLORER_STEPS.filter((st) => st < z);
        const prev = prevSteps.length > 0 ? prevSteps[prevSteps.length - 1] : z - ZOOM_STEP;
        if (prev < 48) {
          setViewMode("details");
          const updatedSettings = { ...s, defaultViewMode: "details" as const };
          api.updateSettings(updatedSettings).catch(console.error);
          return MIN_ZOOM;
        }
        const clamped = Math.max(MIN_ZOOM, prev);
        const updatedSettings = { ...s, gridPixelSize: clamped };
        api.updateSettings(updatedSettings).catch(console.error);
        return clamped;
      });
      return s;
    });
  }, []);

  const handleZoomReset = useCallback(() => {
    setViewMode("grid");
    setGridZoom(DEFAULT_ZOOM);
    setSettings((s) => {
      const newSettings = { ...s, gridPixelSize: DEFAULT_ZOOM, defaultViewMode: "grid" as const };
      api.updateSettings(newSettings).catch(console.error);
      return newSettings;
    });
  }, []);

  const handleZoomChange = useCallback((newZoom: number) => {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
    if (clamped > MIN_ZOOM) {
      setViewMode("grid");
    }
    setGridZoom(clamped);
    setSettings((s) => {
      const newSettings = { ...s, gridPixelSize: clamped };
      api.updateSettings(newSettings).catch(console.error);
      return newSettings;
    });
  }, []);

  const togglePreviewPane = useCallback(() => {
    setPreviewPaneOpen((open) => {
      const updated = !open;
      setSettings((s) => {
        const newSettings = { ...s, previewPaneOpen: updated };
        api.updateSettings(newSettings).catch(console.error);
        return newSettings;
      });
      return updated;
    });
  }, []);

  // Globally intercept Ctrl + Mouse Wheel for instant pixel-based zoom across the file view
  // and prevent browser/webview whole-window viewport zoom
  useEffect(() => {
    let lastWheelTime = 0;

    const handleGlobalWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        // Prevent default browser/webview whole-window zoom
        e.preventDefault();

        const now = Date.now();
        // 60ms throttle prevents runaway zoom from free-spinning inertia wheels while triggering on every single physical notch
        if (now - lastWheelTime < 60) return;
        lastWheelTime = now;

        if (e.deltaY < 0) {
          handleZoomIn();
        } else if (e.deltaY > 0) {
          handleZoomOut();
        }
      }
    };

    // Single capture listener on window
    window.addEventListener("wheel", handleGlobalWheel, { passive: false, capture: true });

    return () => {
      window.removeEventListener("wheel", handleGlobalWheel, { capture: true });
    };
  }, [handleZoomIn, handleZoomOut]);

  // Load system info & settings on startup
  useEffect(() => {
    api.getSystemInfo().then((info) => {
      setSystemInfo(info);
      if (info.knownFolders.length > 0) {
        const home = info.knownFolders.find((f) => f.id === "home");
        if (home) {
          updateCurrentTabPath(home.path, home.name);
        }
      }
    });

    api.getSettings().then((s) => {
      const lang: SupportedLanguage = s.language || detectInitialLanguage();
      const updated = { ...s, language: lang };
      setSettings(updated);
      setViewMode(updated.defaultViewMode);
      if (updated.viewPreferences) {
        setViewPreferences(updated.viewPreferences);
      }
      if (s.gridPixelSize) setGridZoom(s.gridPixelSize);
      if (s.previewPaneOpen !== undefined) setPreviewPaneOpen(s.previewPaneOpen);
      applyTheme(
        updated.theme,
        updated.accentColor,
        updated.fontFamily,
        updated.fontSize,
        lang,
        updated.windowsExplorerMode
      );
    });

    api.listJobs().then(setJobs);
    api.getIndexStatus().then(setIndexStatus);

    const unlistenPromise = api.onJobProgress((prog) => {
      setJobs((prev) => {
        const idx = prev.findIndex((j) => j.id === prog.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = prog;
          return updated;
        }
        return [prog, ...prev];
      });

      // Refresh if the active folder was affected
      if (
        prog.state === "completed" &&
        prog.affectedDirs.some((d) => d.toLowerCase() === activeTab.path.toLowerCase())
      ) {
        refreshCurrentDir();
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  const applyTheme = (
    theme: "system" | "light" | "dark",
    accentColor?: string,
    fontFamily?: string,
    fontSize?: string,
    language?: SupportedLanguage,
    windowsExplorerMode?: boolean
  ) => {
    if (theme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.setAttribute("data-theme", prefersDark ? "dark" : "light");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }

    if (accentColor) {
      document.documentElement.setAttribute("data-accent", accentColor);
    }
    if (fontFamily) {
      document.documentElement.setAttribute("data-font", fontFamily);
    }
    if (fontSize) {
      document.documentElement.setAttribute("data-size", fontSize);
    }

    document.documentElement.setAttribute(
      "data-explorer-mode",
      windowsExplorerMode ? "true" : "false"
    );

    if (language) {
      const langInfo = getLanguageInfo(language);
      document.documentElement.setAttribute("lang", langInfo.code);
      document.documentElement.setAttribute("dir", langInfo.dir);
    }
  };

  const toggleWindowsExplorerMode = useCallback(() => {
    setSettings((s) => {
      const updated = !s.windowsExplorerMode;
      const targetMode: ViewMode = updated ? "details" : s.defaultViewMode;
      const newSettings: AppSettings = {
        ...s,
        windowsExplorerMode: updated,
        defaultViewMode: targetMode,
      };
      setViewMode(targetMode);
      applyTheme(
        newSettings.theme,
        newSettings.accentColor,
        newSettings.fontFamily,
        newSettings.fontSize,
        newSettings.language,
        updated
      );
      api.updateSettings(newSettings).catch(console.error);
      return newSettings;
    });
  }, []);

  const loadDirectory = useCallback((path: string) => {
    api
      .listDirectory(path)
      .then((res) => {
        setEntries(res.entries);
        setSelectedPaths([]);
      })
      .catch((err) => {
        console.error("List dir failed:", err);
      });
  }, []);

  useEffect(() => {
    if (activeTab?.path) {
      if (searchQuery.trim()) {
        api
          .searchFiles(
            {
              query: searchQuery,
              scopePath: activeTab.path,
            },
            settings.index.enabled
          )
          .then((res) => {
            setEntries(res.map((r) => r.entry));
            setSelectedPaths([]);
          });
      } else {
        loadDirectory(activeTab.path);
      }
    }
  }, [activeTab?.path, searchQuery, loadDirectory, settings.index.enabled]);

  // Group and sort files whenever entries or view preferences change
  useEffect(() => {
    if (entries.length === 0) {
      setGroupedFiles([]);
      return;
    }
    let active = true;
    api
      .groupAndSortFiles(entries, viewPreferences)
      .then((res) => {
        if (active) {
          setGroupedFiles(res);
        }
      })
      .catch((err) => {
        console.error("Failed to group and sort files:", err);
      });
    return () => {
      active = false;
    };
  }, [entries, viewPreferences]);

  const handlePrefsChange = (newPrefs: ViewPreferences) => {
    setViewPreferences(newPrefs);
    setSettings((prev) => {
      const updated: AppSettings = { ...prev, viewPreferences: newPrefs };
      api.updateSettings(updated).catch(console.error);
      return updated;
    });
  };

  const handleResetView = () => {
    handlePrefsChange(defaultViewPreferences);
  };

  const handleSortChange = (field: SortField) => {
    if (viewPreferences.sortField === field) {
      handlePrefsChange({
        ...viewPreferences,
        sortDirection:
          viewPreferences.sortDirection === "ascending" ? "descending" : "ascending",
      });
    } else {
      handlePrefsChange({
        ...viewPreferences,
        sortField: field,
        sortDirection: "ascending",
      });
    }
  };

  const updateCurrentTabPath = (newPath: string, title?: string) => {
    const parts = newPath.split(/[/\\]+/).filter(Boolean);
    const computedTitle = title || parts[parts.length - 1] || newPath;

    setTabs((prev) =>
      prev.map((t) => {
        if (t.id === activeTabId) {
          const newHistory = t.history.slice(0, t.historyIndex + 1);
          newHistory.push(newPath);
          return {
            ...t,
            path: newPath,
            title: computedTitle,
            history: newHistory,
            historyIndex: newHistory.length - 1,
          };
        }
        return t;
      })
    );
  };

  const navigateBack = () => {
    if (activeTab.historyIndex > 0) {
      const prevIdx = activeTab.historyIndex - 1;
      const prevPath = activeTab.history[prevIdx];
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId
            ? { ...t, path: prevPath, historyIndex: prevIdx }
            : t
        )
      );
    }
  };

  const navigateForward = () => {
    if (activeTab.historyIndex < activeTab.history.length - 1) {
      const nextIdx = activeTab.historyIndex + 1;
      const nextPath = activeTab.history[nextIdx];
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId
            ? { ...t, path: nextPath, historyIndex: nextIdx }
            : t
        )
      );
    }
  };

  const navigateUp = () => {
    const p = activeTab.path.replace(/[/\\]+$/, "");
    const lastSlash = Math.max(p.lastIndexOf("\\"), p.lastIndexOf("/"));
    if (lastSlash > 0) {
      const parent = p.substring(0, lastSlash);
      updateCurrentTabPath(parent.endsWith(":") ? parent + "\\" : parent);
    }
  };

  const refreshCurrentDir = () => {
    loadDirectory(activeTab.path);
  };

  const handleUndo = () => {
    const action = undoStack.popUndo();
    if (!action) return;
    if (action.type === "rename" && action.payload.newPath) {
      const originalName = action.payload.originalPath.split(/[/\\]+/).pop() || "";
      api.renameItem(action.payload.newPath, originalName).then(() => refreshCurrentDir());
    } else if (action.type === "create") {
      api.trashItems([action.payload.originalPath]).then(() => refreshCurrentDir());
    }
  };

  const handleRedo = () => {
    const action = undoStack.popRedo();
    if (!action) return;
    if (action.type === "rename" && action.payload.newPath) {
      const newName = action.payload.newPath.split(/[/\\]+/).pop() || "";
      api.renameItem(action.payload.originalPath, newName).then(() => refreshCurrentDir());
    }
  };

  const handleSelectAll = () => {
    setSelectedPaths(entries.map((e) => e.path));
  };

  const handleCopyPath = () => {
    if (selectedPaths.length > 0) {
      navigator.clipboard.writeText(selectedPaths.join("\n"));
    }
  };

  // Centralized keyboard navigation & shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isTriggered = (shortcutId: string) =>
        matchesShortcutId(e, shortcutId, settings.customShortcuts);

      const inInput = isInputFocused(e.target);

      // Handle shortcuts that work even while typing in an input
      if (inInput) {
        if (isTriggered("help.shortcuts")) {
          e.preventDefault();
          setIsShortcutModalOpen(true);
        } else if (isTriggered("nav.refresh") || isTriggered("nav.refresh_ctrl_r")) {
          e.preventDefault();
          refreshCurrentDir();
        } else if (isTriggered("nav.back")) {
          e.preventDefault();
          navigateBack();
        } else if (isTriggered("nav.forward")) {
          e.preventDefault();
          navigateForward();
        } else if (isTriggered("nav.up")) {
          e.preventDefault();
          navigateUp();
        } else if (
          isTriggered("nav.focus_address") ||
          isTriggered("nav.focus_address_ctrl_l") ||
          isTriggered("nav.focus_address_f4")
        ) {
          e.preventDefault();
          setFocusAddressTrigger((n) => n + 1);
        } else if (
          isTriggered("nav.focus_search") ||
          isTriggered("nav.focus_search_f") ||
          isTriggered("nav.focus_search_f3")
        ) {
          e.preventDefault();
          setFocusSearchTrigger((n) => n + 1);
        } else if (isTriggered("nav.escape")) {
          if (searchQuery) setSearchQuery("");
          (e.target as HTMLElement)?.blur();
        }
        return; // Don't intercept normal typing, Ctrl+C, Ctrl+V, etc. inside text inputs
      }

      // Help Modal
      if (isTriggered("help.shortcuts")) {
        e.preventDefault();
        setIsShortcutModalOpen(true);
      }
      // Refresh
      else if (isTriggered("nav.refresh") || isTriggered("nav.refresh_ctrl_r")) {
        e.preventDefault();
        refreshCurrentDir();
      }
      // Navigation
      else if (isTriggered("nav.back")) {
        e.preventDefault();
        navigateBack();
      } else if (isTriggered("nav.forward")) {
        e.preventDefault();
        navigateForward();
      } else if (isTriggered("nav.up") || isTriggered("nav.backspace")) {
        e.preventDefault();
        navigateUp();
      }
      // Address & Search Bar Focus
      else if (
        isTriggered("nav.focus_address") ||
        isTriggered("nav.focus_address_ctrl_l") ||
        isTriggered("nav.focus_address_f4")
      ) {
        e.preventDefault();
        setFocusAddressTrigger((n) => n + 1);
      } else if (
        isTriggered("nav.focus_search") ||
        isTriggered("nav.focus_search_f") ||
        isTriggered("nav.focus_search_f3")
      ) {
        e.preventDefault();
        setFocusSearchTrigger((n) => n + 1);
      }
      // Escape
      else if (isTriggered("nav.escape")) {
        if (quickPreviewPath) {
          setQuickPreviewPath(null);
          return;
        }
        setContextMenu(null);
        setIsShortcutModalOpen(false);
        setRenamingPath(null);
        if (searchQuery) setSearchQuery("");
        setSelectedPaths([]);
      }
      // Tabs
      else if (isTriggered("tabs.new")) {
        e.preventDefault();
        handleNewTab();
      } else if (isTriggered("tabs.close")) {
        e.preventDefault();
        handleCloseTab(activeTabId);
      } else if (isTriggered("tabs.prev")) {
        e.preventDefault();
        const curIdx = tabs.findIndex((t) => t.id === activeTabId);
        const prevIdx = (curIdx - 1 + tabs.length) % tabs.length;
        setActiveTabId(tabs[prevIdx].id);
      } else if (isTriggered("tabs.next")) {
        e.preventDefault();
        const curIdx = tabs.findIndex((t) => t.id === activeTabId);
        const nextIdx = (curIdx + 1) % tabs.length;
        setActiveTabId(tabs[nextIdx].id);
      }
      // File Operations
      else if (isTriggered("ops.rename") && selectedPaths.length === 1) {
        e.preventDefault();
        setRenamingPath(selectedPaths[0]);
      } else if (isTriggered("ops.delete_permanent")) {
        e.preventDefault();
        handleDelete(true);
      } else if (isTriggered("ops.delete_recycle")) {
        e.preventDefault();
        handleDelete(false);
      } else if (isTriggered("ops.copy")) {
        e.preventDefault();
        handleCopy();
      } else if (isTriggered("ops.cut")) {
        e.preventDefault();
        handleCut();
      } else if (isTriggered("ops.paste")) {
        e.preventDefault();
        handlePaste();
      } else if (isTriggered("ops.undo")) {
        e.preventDefault();
        handleUndo();
      } else if (isTriggered("ops.redo")) {
        e.preventDefault();
        handleRedo();
      } else if (isTriggered("ops.select_all")) {
        e.preventDefault();
        handleSelectAll();
      } else if (isTriggered("ops.copy_path")) {
        e.preventDefault();
        handleCopyPath();
      } else if (isTriggered("ops.new_folder")) {
        e.preventDefault();
        handleNewFolder();
      } else if (isTriggered("ops.properties") && selectedPaths.length > 0) {
        e.preventDefault();
        api.showItemProperties(selectedPaths[0]);
      } else if (
        isTriggered("ops.context_menu_f10") ||
        isTriggered("ops.context_menu_key")
      ) {
        e.preventDefault();
        setContextMenu({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
          selected: selectedPaths
            .map((p) => entries.find((en) => en.path === p))
            .filter(Boolean) as FileEntry[],
        });
      }
      // View Switching & Zooming
      else if (
        isTriggered("view.details") ||
        isTriggered("view.details_shift")
      ) {
        e.preventDefault();
        setViewMode("details");
      } else if (isTriggered("view.extra_large_icons")) {
        e.preventDefault();
        setViewMode("extra-large-icons");
        setGridZoom(256);
      } else if (isTriggered("view.large_icons")) {
        e.preventDefault();
        setViewMode("large-icons");
        setGridZoom(96);
      } else if (isTriggered("view.medium_icons")) {
        e.preventDefault();
        setViewMode("medium-icons");
        setGridZoom(48);
      } else if (isTriggered("view.small_icons")) {
        e.preventDefault();
        setViewMode("small-icons");
        setGridZoom(24);
      } else if (isTriggered("view.list")) {
        e.preventDefault();
        setViewMode("list");
      } else if (isTriggered("view.tiles")) {
        e.preventDefault();
        setViewMode("tiles");
      } else if (isTriggered("view.content")) {
        e.preventDefault();
        setViewMode("content");
      } else if (
        isTriggered("view.grid") ||
        isTriggered("view.grid_shift")
      ) {
        e.preventDefault();
        setViewMode("grid");
      } else if (isTriggered("view.zoom_in")) {
        e.preventDefault();
        handleZoomIn();
      } else if (isTriggered("view.zoom_out")) {
        e.preventDefault();
        handleZoomOut();
      } else if (isTriggered("view.zoom_reset")) {
        e.preventDefault();
        handleZoomReset();
      } else if (isTriggered("view.toggle_preview_pane")) {
        e.preventDefault();
        togglePreviewPane();
      }
      // Quick Preview Modal (Space)
      else if (e.code === "Space" && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
        if (quickPreviewPath) {
          e.preventDefault();
          setQuickPreviewPath(null);
        } else if (selectedPaths.length > 0) {
          e.preventDefault();
          setQuickPreviewPath(selectedPaths[0]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activeTab.path,
    activeTab.historyIndex,
    activeTab.history,
    selectedPaths,
    clipboard,
    entries,
    searchQuery,
    tabs,
    activeTabId,
    settings.customShortcuts,
    quickPreviewPath,
  ]);

  const handleSelect = (entry: FileEntry, multi: boolean, range: boolean) => {
    if (!entry.path) {
      setSelectedPaths([]);
      return;
    }
    if (multi) {
      setSelectedPaths((prev) =>
        prev.includes(entry.path)
          ? prev.filter((p) => p !== entry.path)
          : [...prev, entry.path]
      );
    } else {
      setSelectedPaths([entry.path]);
    }
  };

  const handleOpen = (entry: FileEntry) => {
    if (entry.kind === "directory" || entry.linkToDir) {
      updateCurrentTabPath(entry.path, entry.name);
    } else {
      api.openItemDefault(entry.path);
    }
  };

  const handleNewTab = () => {
    const newId = `tab-${Date.now()}`;
    const newTab: TabItem = {
      id: newId,
      path: activeTab.path,
      title: activeTab.title,
      history: [activeTab.path],
      historyIndex: 0,
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newId);
  };

  const handleCloseTab = (id: string) => {
    if (tabs.length <= 1) return;
    const remaining = tabs.filter((t) => t.id !== id);
    setTabs(remaining);
    if (activeTabId === id) {
      setActiveTabId(remaining[remaining.length - 1].id);
    }
  };

  const handleCopy = () => {
    if (selectedPaths.length > 0) {
      setClipboard({ paths: selectedPaths, mode: "copy" });
    }
  };

  const handleCut = () => {
    if (selectedPaths.length > 0) {
      setClipboard({ paths: selectedPaths, mode: "move" });
    }
  };

  const handlePaste = () => {
    if (!clipboard || clipboard.paths.length === 0) return;
    api
      .startTransferJob(clipboard.paths, activeTab.path, clipboard.mode, "keep_both")
      .then(() => {
        setIsJobsOpen(true);
        if (clipboard.mode === "move") setClipboard(null);
      });
  };

  const handleDelete = (permanent: boolean) => {
    if (selectedPaths.length === 0) return;
    const dict = getDictionary(settings.language || "en");
    if (permanent) {
      if (window.confirm(dict.operations.permanentDeleteConfirmMsg)) {
        api.deleteItemsPermanently(selectedPaths).then(() => refreshCurrentDir());
      }
    } else {
      if (settings.confirmDelete) {
        if (!window.confirm(dict.operations.deleteConfirmMsg)) return;
      }
      api.trashItems(selectedPaths).then(() => refreshCurrentDir());
    }
  };

  const handleNewFolder = () => {
    api.createFolder(activeTab.path).then((created) => {
      undoStack.push({
        type: "create",
        description: `Create folder ${created}`,
        payload: { originalPath: created, isDir: true },
      });
      refreshCurrentDir();
      setRenamingPath(created);
    });
  };

  const handleNewFile = () => {
    const dict = getDictionary(settings.language || "en");
    api.createFile(activeTab.path, dict.operations.fileNamePlaceholder).then((created) => {
      undoStack.push({
        type: "create",
        description: `Create file ${created}`,
        payload: { originalPath: created, isDir: false },
      });
      refreshCurrentDir();
      setRenamingPath(created);
    });
  };

  const handleRenameSubmit = (newName: string) => {
    if (renamingPath && newName.trim()) {
      const oldPath = renamingPath;
      api.renameItem(oldPath, newName.trim()).then((newPath) => {
        undoStack.push({
          type: "rename",
          description: `Rename to ${newName.trim()}`,
          payload: { originalPath: oldPath, newPath: newPath || oldPath },
        });
        setRenamingPath(null);
        refreshCurrentDir();
      });
    } else {
      setRenamingPath(null);
    }
  };

  const handleGroupTabs = async () => {
    const defaultName = tabs.map((t) => t.title || "Tab").join(" + ");
    const name = window.prompt("Enter a name for this tab group / workspace:", defaultName) || defaultName;
    if (!name.trim()) return;

    try {
      const workspaceTabs = tabs.map((t) => ({
        id: t.id,
        path: t.path,
        title: t.title,
      }));
      await api.saveWorkspace(name, workspaceTabs, activeTabId, false);
      alert(`Workspace "${name}" saved successfully with ${tabs.length} tabs!`);
    } catch (e) {
      console.error(e);
      alert(`Could not save workspace: ${e}`);
    }
  };

  const handleRestoreWorkspace = (ws: Workspace) => {
    if (!ws.tabs || ws.tabs.length === 0) return;
    const newTabs: TabItem[] = ws.tabs.map((t) => ({
      id: t.id,
      path: t.path,
      title: t.title,
      history: [t.path],
      historyIndex: 0,
    }));
    setTabs(newTabs);
    setActiveTabId(ws.activeTabId || newTabs[0].id);
  };

  const handleAdminElevation = async () => {
    if (confirm("Request Administrator privileges? Windows User Account Control (UAC) will prompt for confirmation.")) {
      try {
        await api.requestAdminElevation();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const currentDict = getDictionary(settings.language || "en");

  return (
    <I18nProvider
      language={settings.language || "en"}
      onLanguageChange={(newLang) => {
        const newSettings: AppSettings = { ...settings, language: newLang };
        setSettings(newSettings);
        applyTheme(
          newSettings.theme,
          newSettings.accentColor,
          newSettings.fontFamily,
          newSettings.fontSize,
          newLang
        );
        api.updateSettings(newSettings);
      }}
    >
      <div className={styles.appContainer}>
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={setActiveTabId}
        onCloseTab={handleCloseTab}
        onNewTab={handleNewTab}
        onGroupTabs={handleGroupTabs}
        onOpenWorkspaces={() => setIsWorkspacesOpen(true)}
      />

      <AddressBar
        currentPath={activeTab.path}
        onNavigate={updateCurrentTabPath}
        canGoBack={activeTab.historyIndex > 0}
        canGoForward={activeTab.historyIndex < activeTab.history.length - 1}
        onGoBack={navigateBack}
        onGoForward={navigateForward}
        onGoUp={navigateUp}
        onRefresh={refreshCurrentDir}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onClearSearch={() => setSearchQuery("")}
        isSearching={!!searchQuery}
        focusAddressTrigger={focusAddressTrigger}
        focusSearchTrigger={focusSearchTrigger}
      />

      <div className={styles.mainLayout}>
        <Sidebar
          currentPath={activeTab.path}
          onNavigate={updateCurrentTabPath}
          drives={systemInfo.drives}
          knownFolders={systemInfo.knownFolders}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenJobs={() => setIsJobsOpen(true)}
          onOpenShortcuts={() => setIsShortcutModalOpen(true)}
          onOpenInExplorer={() => api.openItemWith(activeTab.path)}
          activeJobCount={activeJobCount}
        />

        <main className={styles.viewArea}>
          <ViewToolbar
            viewMode={viewMode}
            onViewModeChange={(m) => {
              setViewMode(m);
              const newSettings: AppSettings = { ...settings, defaultViewMode: m };
              setSettings(newSettings);
              api.updateSettings(newSettings).catch(console.error);
            }}
            prefs={viewPreferences}
            onPrefsChange={handlePrefsChange}
            onResetView={handleResetView}
            zoom={gridZoom}
            onZoomChange={handleZoomChange}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onZoomReset={handleZoomReset}
            previewPaneOpen={previewPaneOpen}
            onTogglePreviewPane={togglePreviewPane}
            windowsExplorerMode={settings.windowsExplorerMode}
            onToggleWindowsExplorerMode={toggleWindowsExplorerMode}
            selectedCount={selectedPaths.length}
            hasClipboard={!!clipboard}
            onCut={handleCut}
            onCopy={handleCopy}
            onPaste={handlePaste}
            onRename={() => selectedPaths.length === 1 && setRenamingPath(selectedPaths[0])}
            onDelete={() => handleDelete(false)}
            onShare={() => {
              if (selectedPaths.length > 0) {
                navigator.clipboard.writeText(selectedPaths.join("\n"));
              }
            }}
            onNewFolder={handleNewFolder}
            onNewFile={handleNewFile}
            onRefresh={refreshCurrentDir}
            onOpenInExplorer={() => api.openItemWith(activeTab.path)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            showHiddenFiles={settings.showHiddenFiles}
            onToggleShowHidden={() => {
              const ns = { ...settings, showHiddenFiles: !settings.showHiddenFiles };
              setSettings(ns);
              api.updateSettings(ns);
            }}
            showExtensions={settings.showFileExtensions}
            onToggleShowExtensions={() => {
              const ns = { ...settings, showFileExtensions: !settings.showFileExtensions };
              setSettings(ns);
              api.updateSettings(ns);
            }}
            onBakItUp={() => setIsBakItUpOpen(true)}
            onGroupTabs={handleGroupTabs}
            onAdminMode={handleAdminElevation}
            onChangeAttributes={() => setIsAttributesOpen(true)}
          />

          <div className={styles.contentArea}>
            <FileList
              groups={groupedFiles}
              viewMode={viewMode}
              prefs={viewPreferences}
              onSortChange={handleSortChange}
              selectedPaths={selectedPaths}
              onSelect={handleSelect}
              onOpen={handleOpen}
              onContextMenu={(e, entry) => {
                e.preventDefault();
                setContextMenu({
                  x: e.clientX,
                  y: e.clientY,
                  selected: entry ? [entry] : [],
                });
              }}
              renamingPath={renamingPath}
              onRenameSubmit={handleRenameSubmit}
              onRenameCancel={() => setRenamingPath(null)}
              showExtensions={settings.showFileExtensions}
              showHidden={settings.showHiddenFiles}
              gridZoom={gridZoom}
              currentPath={activeTab.path}
              windowsExplorerMode={settings.windowsExplorerMode}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onGoUp={navigateUp}
              onSpacePress={(path) => setQuickPreviewPath(path)}
            />

            {previewPaneOpen && (
              <PreviewPane
                selectedEntry={entries.find((e) => selectedPaths.includes(e.path)) || null}
                onClose={() => setPreviewPaneOpen(false)}
                onOpenQuickPreview={() => selectedPaths.length > 0 && setQuickPreviewPath(selectedPaths[0])}
              />
            )}
          </div>

          <div className={styles.statusBar}>
            <div className={styles.statusInfo}>
              <span>{currentDict.view.itemsCount.replace("{count}", String(entries.length))}</span>
              {selectedPaths.length > 0 && (
                <span>
                  {" | "}
                  {currentDict.view.selectedCount.replace("{count}", String(selectedPaths.length))}
                  {"  "}
                  {formatBytes(
                    entries
                      .filter((e) => selectedPaths.includes(e.path))
                      .reduce((acc, cur) => acc + (cur.size || 0), 0)
                  )}
                </span>
              )}
            </div>

            <div className={styles.statusViewButtons}>
              <button
                className={`${styles.statusViewBtn} ${viewMode === "details" ? styles.active : ""}`}
                onClick={() => {
                  setViewMode("details");
                  const newSettings = { ...settings, defaultViewMode: "details" as const };
                  setSettings(newSettings);
                  api.updateSettings(newSettings).catch(console.error);
                }}
                title={currentDict.view.details}
                aria-label={currentDict.view.details}
              >
                <List size={14} />
              </button>
              <button
                className={`${styles.statusViewBtn} ${viewMode === "large-icons" || viewMode === "grid" ? styles.active : ""}`}
                onClick={() => {
                  const targetMode: ViewMode = settings.windowsExplorerMode ? "large-icons" : "grid";
                  setViewMode(targetMode);
                  const newSettings: AppSettings = { ...settings, defaultViewMode: targetMode };
                  setSettings(newSettings);
                  api.updateSettings(newSettings).catch(console.error);
                }}
                title={currentDict.view.grid}
                aria-label={currentDict.view.grid}
              >
                <LayoutGrid size={14} />
              </button>
            </div>
          </div>
        </main>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          selectedItems={contextMenu.selected}
          hasClipboard={!!clipboard}
          onClose={() => setContextMenu(null)}
          onOpen={() => {
            if (contextMenu.selected.length === 1) {
              handleOpen(contextMenu.selected[0]);
            }
          }}
          onOpenWith={() => {
            if (contextMenu.selected.length === 1) {
              api.openItemWith(contextMenu.selected[0].path);
            }
          }}
          onQuickPreview={() => {
            if (contextMenu.selected.length > 0) {
              setQuickPreviewPath(contextMenu.selected[0].path);
            }
          }}
          onCopy={handleCopy}
          onCut={handleCut}
          onPaste={handlePaste}
          onRename={() => {
            if (contextMenu.selected.length === 1) {
              setRenamingPath(contextMenu.selected[0].path);
            }
          }}
          onDelete={handleDelete}
          onCopyPath={() => {
            if (contextMenu.selected.length > 0) {
              navigator.clipboard.writeText(
                contextMenu.selected.map((s) => s.path).join("\n")
              );
            }
          }}
          onNewFolder={handleNewFolder}
          onNewFile={handleNewFile}
          onCreateArchive={() => {
            if (contextMenu.selected.length > 0) {
              api
                .startCreateArchiveJob(contextMenu.selected.map((s) => s.path))
                .then(() => setIsJobsOpen(true));
            }
          }}
          onExtractArchive={() => {
            if (contextMenu.selected.length === 1) {
              api
                .startExtractArchiveJob(contextMenu.selected[0].path)
                .then(() => setIsJobsOpen(true));
            }
          }}
          onProperties={() => {
            const p =
              contextMenu.selected.length > 0
                ? contextMenu.selected[0].path
                : activeTab.path;
            api.showItemProperties(p);
          }}
          onOpenInExplorer={() => {
            const p =
              contextMenu.selected.length > 0
                ? contextMenu.selected[0].path
                : activeTab.path;
            api.openItemDefault(p);
          }}
          onRefresh={refreshCurrentDir}
          viewMode={viewMode}
          onViewModeChange={(m) => {
            setViewMode(m);
            const newSettings: AppSettings = { ...settings, defaultViewMode: m };
            setSettings(newSettings);
            api.updateSettings(newSettings).catch(console.error);
          }}
          prefs={viewPreferences}
          onPrefsChange={handlePrefsChange}
          windowsExplorerMode={settings.windowsExplorerMode}
          onBakItUp={() => setIsBakItUpOpen(true)}
          onChangeAttributes={() => setIsAttributesOpen(true)}
        />
      )}

      {quickPreviewPath && (
        <QuickPreviewModal
          currentPath={quickPreviewPath}
          allEntries={entries}
          onClose={() => setQuickPreviewPath(null)}
          onNavigate={(newPath) => {
            setQuickPreviewPath(newPath);
            const found = entries.find((e) => e.path === newPath);
            if (found) handleSelect(found, false, false);
          }}
        />
      )}

      <JobsPanel
        jobs={jobs}
        isOpen={isJobsOpen}
        onClose={() => setIsJobsOpen(false)}
        onCancelJob={(id) => api.cancelJob(id)}
        onClearFinished={() => {
          api.clearFinishedJobs();
          api.listJobs().then(setJobs);
        }}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={(newSettings) => {
          setSettings(newSettings);
          applyTheme(
            newSettings.theme,
            newSettings.accentColor,
            newSettings.fontFamily,
            newSettings.fontSize,
            newSettings.language,
            newSettings.windowsExplorerMode
          );
          setViewMode(newSettings.defaultViewMode);
          api.updateSettings(newSettings);
        }}
        indexStatus={indexStatus}
        onStartIndexScan={() => {
          api.startIndexScan().then(() => {
            api.getIndexStatus().then(setIndexStatus);
          });
        }}
        onCancelIndexScan={() => {
          api.cancelIndexScan();
          api.getIndexStatus().then(setIndexStatus);
        }}
        onClearIndex={() => {
          api.clearIndex().then(() => {
            api.getIndexStatus().then(setIndexStatus);
          });
        }}
      />

      <ShortcutModal
        isOpen={isShortcutModalOpen}
        onClose={() => setIsShortcutModalOpen(false)}
        customShortcuts={settings.customShortcuts}
        onSaveCustomShortcuts={(updatedCustomShortcuts) => {
          const newSettings: AppSettings = {
            ...settings,
            customShortcuts: updatedCustomShortcuts,
          };
          setSettings(newSettings);
          api.updateSettings(newSettings);
        }}
      />

      {isBakItUpOpen && (
        <BakItUpModal
          selectedPaths={selectedPaths}
          currentDirectory={activeTab.path}
          onClose={() => setIsBakItUpOpen(false)}
          onRefresh={refreshCurrentDir}
        />
      )}

      {isAttributesOpen && (
        <AttributesModal
          selectedItems={
            selectedPaths.length > 0
              ? entries.filter((e: FileEntry) => selectedPaths.includes(e.path))
              : []
          }
          onClose={() => setIsAttributesOpen(false)}
          onRefresh={refreshCurrentDir}
        />
      )}

      {isWorkspacesOpen && (
        <WorkspaceModal
          onClose={() => setIsWorkspacesOpen(false)}
          onRestoreWorkspace={handleRestoreWorkspace}
        />
      )}
    </div>
    </I18nProvider>
  );
};
export default App;
