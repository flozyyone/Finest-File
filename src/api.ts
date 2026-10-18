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

  onJobProgress: (cb: (progress: JobProgress) => void): Promise<UnlistenFn> => {
    return listen<JobProgress>("job-progress", (event) => cb(event.payload));
  },
};
