import React, { useState, useEffect, useCallback } from "react";
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
} from "./types";
import { Sidebar } from "./components/Sidebar";
import { TabBar, TabItem } from "./components/TabBar";
import { AddressBar } from "./components/AddressBar";
import { FileList } from "./components/FileList";
import { ContextMenu } from "./components/ContextMenu";
import { JobsPanel } from "./components/JobsPanel";
import { SettingsModal } from "./components/SettingsModal";
import { ShortcutModal } from "./components/ShortcutModal";
import { isInputFocused } from "./shortcuts/registry";
import { undoStack } from "./utils/undoStack";
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
  const [viewMode, setViewMode] = useState<"details" | "grid">("details");

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
      setSettings(s);
      setViewMode(s.defaultViewMode);
      if (s.viewPreferences) {
        setViewPreferences(s.viewPreferences);
      }
      applyTheme(s.theme, s.accentColor, s.fontFamily, s.fontSize);
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
    fontSize?: string
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
  };

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
      const inInput = isInputFocused(e.target);

      // Handle shortcuts that work even while typing in an input
      if (inInput) {
        if (e.key === "F1") {
          e.preventDefault();
          setIsShortcutModalOpen(true);
        } else if (e.key === "F5" || (e.ctrlKey && e.key.toLowerCase() === "r")) {
          e.preventDefault();
          refreshCurrentDir();
        } else if (e.altKey && e.key === "ArrowLeft") {
          e.preventDefault();
          navigateBack();
        } else if (e.altKey && e.key === "ArrowRight") {
          e.preventDefault();
          navigateForward();
        } else if (e.altKey && e.key === "ArrowUp") {
          e.preventDefault();
          navigateUp();
        } else if (e.altKey && e.key.toLowerCase() === "d") {
          e.preventDefault();
          setFocusAddressTrigger((n) => n + 1);
        } else if (e.ctrlKey && e.key.toLowerCase() === "l") {
          e.preventDefault();
          setFocusAddressTrigger((n) => n + 1);
        } else if (e.ctrlKey && (e.key.toLowerCase() === "e" || e.key.toLowerCase() === "f")) {
          e.preventDefault();
          setFocusSearchTrigger((n) => n + 1);
        } else if (e.key === "Escape") {
          if (searchQuery) setSearchQuery("");
          (e.target as HTMLElement)?.blur();
        }
        return; // Don't intercept normal typing, Ctrl+C, Ctrl+V, etc. inside text inputs
      }

      // Help Modal
      if (e.key === "F1") {
        e.preventDefault();
        setIsShortcutModalOpen(true);
      }
      // Refresh
      else if (e.key === "F5" || (e.ctrlKey && e.key.toLowerCase() === "r")) {
        e.preventDefault();
        refreshCurrentDir();
      }
      // Navigation
      else if (e.altKey && e.key === "ArrowLeft") {
        e.preventDefault();
        navigateBack();
      } else if (e.altKey && e.key === "ArrowRight") {
        e.preventDefault();
        navigateForward();
      } else if (e.altKey && e.key === "ArrowUp") {
        e.preventDefault();
        navigateUp();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        navigateUp();
      }
      // Address & Search Bar Focus
      else if (e.altKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        setFocusAddressTrigger((n) => n + 1);
      } else if (e.ctrlKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        setFocusAddressTrigger((n) => n + 1);
      } else if (e.key === "F4") {
        e.preventDefault();
        setFocusAddressTrigger((n) => n + 1);
      } else if (e.ctrlKey && (e.key.toLowerCase() === "e" || e.key.toLowerCase() === "f")) {
        e.preventDefault();
        setFocusSearchTrigger((n) => n + 1);
      } else if (e.key === "F3") {
        e.preventDefault();
        setFocusSearchTrigger((n) => n + 1);
      }
      // Escape
      else if (e.key === "Escape") {
        setContextMenu(null);
        setIsShortcutModalOpen(false);
        setRenamingPath(null);
        if (searchQuery) setSearchQuery("");
        setSelectedPaths([]);
      }
      // Tabs
      else if (e.ctrlKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        handleNewTab();
      } else if (e.ctrlKey && e.key.toLowerCase() === "w") {
        e.preventDefault();
        handleCloseTab(activeTabId);
      } else if (e.ctrlKey && e.shiftKey && e.key === "Tab") {
        e.preventDefault();
        const curIdx = tabs.findIndex((t) => t.id === activeTabId);
        const prevIdx = (curIdx - 1 + tabs.length) % tabs.length;
        setActiveTabId(tabs[prevIdx].id);
      } else if (e.ctrlKey && e.key === "Tab") {
        e.preventDefault();
        const curIdx = tabs.findIndex((t) => t.id === activeTabId);
        const nextIdx = (curIdx + 1) % tabs.length;
        setActiveTabId(tabs[nextIdx].id);
      }
      // File Operations
      else if (e.key === "F2" && selectedPaths.length === 1) {
        e.preventDefault();
        setRenamingPath(selectedPaths[0]);
      } else if (e.key === "Delete") {
        e.preventDefault();
        handleDelete(e.shiftKey);
      } else if (e.ctrlKey && e.key.toLowerCase() === "c" && !e.shiftKey) {
        e.preventDefault();
        handleCopy();
      } else if (e.ctrlKey && e.key.toLowerCase() === "x") {
        e.preventDefault();
        handleCut();
      } else if (e.ctrlKey && e.key.toLowerCase() === "v") {
        e.preventDefault();
        handlePaste();
      } else if (e.ctrlKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
      } else if (e.ctrlKey && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      } else if (e.ctrlKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        handleSelectAll();
      } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        handleCopyPath();
      } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        handleNewFolder();
      } else if (e.altKey && e.key === "Enter" && selectedPaths.length > 0) {
        e.preventDefault();
        api.showItemProperties(selectedPaths[0]);
      } else if ((e.shiftKey && e.key === "F10") || e.key === "ContextMenu") {
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
        (e.ctrlKey && e.key === "1") ||
        (e.ctrlKey && e.shiftKey && e.key === "6")
      ) {
        e.preventDefault();
        setViewMode("details");
      } else if (
        (e.ctrlKey && e.key === "2") ||
        (e.ctrlKey && e.shiftKey && e.key === "2")
      ) {
        e.preventDefault();
        setViewMode("grid");
      } else if (e.ctrlKey && (e.key === "+" || e.key === "=")) {
        e.preventDefault();
        setGridZoom((z) => Math.min(192, z + 16));
      } else if (e.ctrlKey && (e.key === "-" || e.key === "_")) {
        e.preventDefault();
        setGridZoom((z) => Math.max(54, z - 16));
      } else if (e.ctrlKey && e.key === "0") {
        e.preventDefault();
        setGridZoom(96);
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
    if (permanent) {
      if (window.confirm("Are you sure you want to permanently delete these items?")) {
        api.deleteItemsPermanently(selectedPaths).then(() => refreshCurrentDir());
      }
    } else {
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
    api.createFile(activeTab.path, "New text document.txt").then((created) => {
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

  const activeJobCount = jobs.filter((j) => j.state === "running").length;

  return (
    <div className={styles.appContainer}>
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={setActiveTabId}
        onCloseTab={handleCloseTab}
        onNewTab={handleNewTab}
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
          />

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
            onZoomIn={() => setGridZoom((z) => Math.min(192, z + 16))}
            onZoomOut={() => setGridZoom((z) => Math.max(54, z - 16))}
            onGoUp={navigateUp}
          />

          <div className={styles.statusBar}>
            <span>{entries.length} items</span>
            {selectedPaths.length > 0 && (
              <span>{selectedPaths.length} item(s) selected</span>
            )}
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
            newSettings.fontSize
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
      />
    </div>
  );
};
export default App;
