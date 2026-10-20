import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import {
  ArchiveListing,
  DirListing,
  FileEntry,
  IndexStatus,
  JobProgress,
  SearchQuery,
  SearchResultItem,
  SystemInfo,
  AppSettings,
  ViewPreferences,
  FileGroup,
  ThumbnailResult,
  MediaPreviewInfo,
  BackupManifest,
  BackupVerifyResult,
  RestorePreview,
  RestorePolicy,
  Workspace,
  WorkspaceTab,
  FileAttributesUpdate,
  FileTimesUpdate,
} from "./types";

export const api = {
  getSystemInfo: () => invoke<SystemInfo>("get_system_info"),
  listDirectory: (path: string) => invoke<DirListing>("list_directory", { path }),
  getItemMetadata: (path: string) => invoke<FileEntry>("get_item_metadata", { path }),

  createFolder: (parent: string, name?: string) =>
    invoke<string>("create_folder", { parent, name }),
  createFile: (parent: string, name: string) =>
    invoke<string>("create_file", { parent, name }),
  renameItem: (path: string, newName: string) =>
    invoke<string>("rename_item", { path, newName }),
  trashItems: (paths: string[]) => invoke<void>("trash_items", { paths }),
  deleteItemsPermanently: (paths: string[]) =>
    invoke<void>("delete_items_permanently", { paths }),

  openItemDefault: (path: string) => invoke<void>("open_item_default", { path }),
  openItemWith: (path: string) => invoke<void>("open_item_with", { path }),
  showItemProperties: (path: string) =>
    invoke<void>("show_item_properties", { path }),

  startTransferJob: (
    sources: string[],
    destDir: string,
    mode: "copy" | "move",
    policy: "skip" | "replace" | "keep_both"
  ) =>
    invoke<number>("start_transfer_job", {
      sources,
      destDir,
      mode,
      policy,
    }),

  listArchiveEntries: (path: string) =>
    invoke<ArchiveListing>("list_archive_entries", { path }),
  startExtractArchiveJob: (
    archivePath: string,
    destDir?: string,
    policy: "skip" | "replace" | "keep_both" = "skip"
  ) =>
    invoke<number>("start_extract_archive_job", {
      archivePath,
      destDir,
      policy,
    }),
  startCreateArchiveJob: (sources: string[], destArchive?: string) =>
    invoke<number>("start_create_archive_job", {
      sources,
      destArchive,
    }),

  cancelJob: (jobId: number) => invoke<boolean>("cancel_job", { jobId }),
  listJobs: () => invoke<JobProgress[]>("list_jobs"),
  clearFinishedJobs: () => invoke<void>("clear_finished_jobs"),

  searchFiles: (query: SearchQuery, useIndex: boolean) =>
    invoke<SearchResultItem[]>("search_files", { query, useIndex }),

  getIndexStatus: () => invoke<IndexStatus>("get_index_status"),
  startIndexScan: () => invoke<void>("start_index_scan"),
  cancelIndexScan: () => invoke<void>("cancel_index_scan"),
  clearIndex: () => invoke<void>("clear_index"),

  getSettings: () => invoke<AppSettings>("get_settings"),
  updateSettings: (newSettings: AppSettings) =>
    invoke<void>("update_settings", { newSettings }),

  groupAndSortFiles: (entries: FileEntry[], prefs: ViewPreferences) =>
    invoke<FileGroup[]>("group_and_sort_files", { entries, prefs }),

  getFileThumbnail: (path: string, maxDimension?: number) =>
    invoke<ThumbnailResult>("get_file_thumbnail", { path, maxDimension }),

  getMediaPreview: (path: string) =>
    invoke<MediaPreviewInfo>("get_media_preview", { path }),

  // Bak-it-Up!
  createBackup: (
    sources: string[],
    targetDir: string,
    customName?: string,
    isSingleFileBak: boolean = false
  ) =>
    invoke<BackupManifest>("create_backup_command", {
      sources,
      targetDir,
      customName,
      isSingleFileBak,
    }),
  verifyBackup: (backupRootDir: string) =>
    invoke<BackupVerifyResult>("verify_backup_command", { backupRootDir }),
  previewRestore: (backupRootDir: string, targetRestoreDir: string) =>
    invoke<RestorePreview>("preview_restore_command", {
      backupRootDir,
      targetRestoreDir,
    }),
  restoreBackup: (
    backupRootDir: string,
    targetRestoreDir: string,
    policy: RestorePolicy
  ) =>
    invoke<number>("restore_backup_command", {
      backupRootDir,
      targetRestoreDir,
      policy,
    }),
  listAllBackups: () => invoke<BackupManifest[]>("list_all_backups_command"),

  // Workspaces
  listWorkspaces: () => invoke<Workspace[]>("list_workspaces_command"),
  saveWorkspace: (
    name: string,
    tabs: WorkspaceTab[],
    activeTabId: string,
    isDualPane: boolean = false,
    secondaryPath?: string
  ) =>
    invoke<Workspace>("save_workspace_command", {
      name,
      tabs,
      activeTabId,
      isDualPane,
      secondaryPath,
    }),
  deleteWorkspace: (id: string) =>
    invoke<void>("delete_workspace_command", { id }),
  exportWorkspaces: (exportPath: string) =>
    invoke<void>("export_workspaces_command", { exportPath }),
  importWorkspaces: (importPath: string) =>
    invoke<number>("import_workspaces_command", { importPath }),

  // Attributes & Times
  setFileAttributes: (update: FileAttributesUpdate) =>
    invoke<void>("set_file_attributes_command", { update }),
  setFileTimes: (update: FileTimesUpdate) =>
    invoke<void>("set_file_times_command", { update }),

  // Elevation
  requestAdminElevation: () => invoke<void>("request_admin_elevation"),

  onJobProgress: (cb: (progress: JobProgress) => void): Promise<UnlistenFn> => {
    return listen<JobProgress>("job-progress", (event) => cb(event.payload));
  },
};
