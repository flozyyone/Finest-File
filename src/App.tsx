import React, { useState, useEffect, useCallback } from "react";
import { api } from "./api";
import {
  FileEntry,
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
import styles from "./App.module.css";

export const App: React.FC = () => {
  const [systemInfo, setSystemInfo] = useState<SystemInfo>({
    drives: [],
    knownFolders: [],
  });
  const [settings, setSettings] = useState<AppSettings>({
    theme: "system",
    showHiddenFiles: false,
    showFileExtensions: true,
    defaultViewMode: "details",
    dualPaneEnabled: false,
    confirmDelete: true,
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
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "size" | "type" | "modified">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
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
      applyTheme(s.theme);
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

  const applyTheme = (theme: "system" | "light" | "dark") => {
    if (theme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.setAttribute("data-theme", prefersDark ? "dark" : "light");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
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

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      if (e.key === "F5" || (e.ctrlKey && e.key.toLowerCase() === "r")) {
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
      } else if (e.ctrlKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        handleNewTab();
      } else if (e.ctrlKey && e.key.toLowerCase() === "w") {
        e.preventDefault();
        handleCloseTab(activeTabId);
      } else if (e.key === "F2" && selectedPaths.length === 1) {
        e.preventDefault();
        setRenamingPath(selectedPaths[0]);
      } else if (e.key === "Delete") {
        e.preventDefault();
        handleDelete(e.shiftKey);
      } else if (e.ctrlKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        handleCopy();
      } else if (e.ctrlKey && e.key.toLowerCase() === "x") {
        e.preventDefault();
        handleCut();
      } else if (e.ctrlKey && e.key.toLowerCase() === "v") {
        e.preventDefault();
        handlePaste();
      } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        handleNewFolder();
      } else if (e.altKey && e.key === "Enter" && selectedPaths.length > 0) {
        e.preventDefault();
        api.showItemProperties(selectedPaths[0]);
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
      refreshCurrentDir();
      setRenamingPath(created);
    });
  };

  const handleNewFile = () => {
    api.createFile(activeTab.path, "New text document.txt").then((created) => {
      refreshCurrentDir();
      setRenamingPath(created);
    });
  };

  const handleRenameSubmit = (newName: string) => {
    if (renamingPath && newName.trim()) {
      api.renameItem(renamingPath, newName.trim()).then(() => {
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
      />

      <div className={styles.mainLayout}>
        <Sidebar
          currentPath={activeTab.path}
          onNavigate={updateCurrentTabPath}
          drives={systemInfo.drives}
          knownFolders={systemInfo.knownFolders}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenJobs={() => setIsJobsOpen(true)}
          activeJobCount={activeJobCount}
        />

        <main className={styles.viewArea}>
          <FileList
            entries={entries}
            viewMode={viewMode}
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
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={(col) => {
              if (sortBy === col) {
                setSortOrder(sortOrder === "asc" ? "desc" : "asc");
              } else {
                setSortBy(col);
                setSortOrder("asc");
              }
            }}
            showExtensions={settings.showFileExtensions}
            showHidden={settings.showHiddenFiles}
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
          applyTheme(newSettings.theme);
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
    </div>
  );
};
export default App;
