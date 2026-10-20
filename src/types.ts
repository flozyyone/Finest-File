export type EntryKind = "file" | "directory" | "link";

export interface FileEntry {
  name: string;
  path: string;
  ext: string;
  kind: EntryKind;
  linkToDir: boolean;
  size?: number;
  modified?: number;
  created?: number;
  accessed?: number;
  hidden: boolean;
  system: boolean;
  readonly: boolean;
  attributes: number;
}

export type SortField =
  | "name"
  | "extension"
  | "size"
  | "date_modified"
  | "date_created"
  | "date_accessed"
  | "attributes";

export type SortDirection = "ascending" | "descending";

export type GroupMode =
  | "none"
  | "name_range"
  | "extension"
  | "size"
  | "date_modified"
  | "date_created"
  | "attributes";

export interface ViewPreferences {
  sortField: SortField;
  sortDirection: SortDirection;
  groupMode: GroupMode;
  groupDirection: SortDirection;
  foldersFirst: boolean;
}

export interface FileGroup {
  key: string;
  title: string;
  items: FileEntry[];
  totalBytes: number;
}

export interface DirListing {
  path: string;
  entries: FileEntry[];
  skipped: number;
}

export interface DriveInfo {
  path: string;
  letter: string;
  label: string;
  kind: "fixed" | "removable" | "network" | "optical" | "ram_disk" | "unknown";
  fileSystem: string;
  totalBytes?: number;
  freeBytes?: number;
  ready: boolean;
}

export interface KnownFolder {
  id: string;
  name: string;
  path: string;
}

export interface SystemInfo {
  drives: DriveInfo[];
  knownFolders: KnownFolder[];
}

export type JobKind =
  | "copy"
  | "move"
  | "delete"
  | "trash"
  | "create_archive"
  | "extract_archive"
  | "folder_size";

export type JobState = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface JobProgress {
  id: number;
  kind: JobKind;
  title: string;
  state: JobState;
  bytesDone: number;
  bytesTotal: number;
  itemsDone: number;
  itemsTotal: number;
  current?: string;
  error?: { code: string; message: string; path?: string };
  warnings: string[];
  warningCount: number;
  affectedDirs: string[];
  startedAt?: number;
  finishedAt?: number;
}

export interface ArchiveEntry {
  name: string;
  isDir: boolean;
  size: number;
  compressedSize: number;
  encrypted: boolean;
  unsafePath: boolean;
}

export interface ArchiveListing {
  format: "zip" | "seven_zip" | "rar" | "gzip" | "tar" | "unknown";
  entries: ArchiveEntry[];
  totalSize: number;
  truncated: boolean;
}

export interface SearchQuery {
  query: string;
  scopePath?: string;
  extension?: string;
  kind?: string;
  minSize?: number;
  maxSize?: number;
  limit?: number;
}

export interface SearchResultItem {
  entry: FileEntry;
  matchRange?: [number, number];
}

export interface IndexSettings {
  enabled: boolean;
  roots: string[];
  excludedPatterns: string[];
  autoWatch: boolean;
}

export interface IndexStatus {
  enabled: boolean;
  totalFiles: number;
  totalFolders: number;
  totalBytes: number;
  lastScan?: number;
  isScanning: boolean;
  scannedItems: number;
  currentPath?: string;
}

export type AccentColor = "blue" | "teal" | "purple" | "amber" | "emerald" | "slate";
export type FontFamilyOption = "system" | "segoe" | "cascadia" | "aptos" | "consolas";
export type FontSizeOption = "small" | "medium" | "large";

import type { SupportedLanguage } from "./i18n/types";

export interface ThumbnailResult {
  dataUrl: string;
  width: number;
  height: number;
  mimeType: string;
}

export interface MediaPreviewInfo {
  path: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  mediaType: "image" | "video" | "audio" | "other";
  width?: number;
  height?: number;
  durationSecs?: number;
  thumbnailUrl?: string;
  title?: string;
  artist?: string;
  album?: string;
  trackNumber?: number;
  year?: number;
  genre?: string;
}

export type ViewMode =
  | "details"
  | "grid"
  | "tiles"
  | "list"
  | "content"
  | "small-icons"
  | "medium-icons"
  | "large-icons"
  | "extra-large-icons";

export interface AppSettings {
  theme: "system" | "light" | "dark";
  accentColor: AccentColor;
  fontFamily: FontFamilyOption;
  fontSize: FontSizeOption;
  language: SupportedLanguage;
  showHiddenFiles: boolean;
  showFileExtensions: boolean;
  defaultViewMode: ViewMode;
  dualPaneEnabled: boolean;
  confirmDelete: boolean;
  viewPreferences: ViewPreferences;
  customShortcuts?: Record<string, string>;
  gridPixelSize?: number;
  previewPaneOpen?: boolean;
  windowsExplorerMode?: boolean;
  index: IndexSettings;
}

// --- BAK-IT-UP! TYPES ---
export interface BackupFileEntry {
  relativePath: string;
  originalPath: string;
  size: number;
  sha256: string;
  modifiedMs: number;
}

export interface BackupManifest {
  version: number;
  backupId: string;
  name: string;
  createdAtMs: number;
  totalSize: number;
  totalFiles: number;
  files: BackupFileEntry[];
  backupRootDir: string;
}

export interface BackupVerifyResult {
  isValid: boolean;
  verifiedFiles: number;
  corruptOrMissing: string[];
}

export interface RestorePreviewItem {
  relativePath: string;
  targetPath: string;
  existsAtTarget: boolean;
  sizeDiffers: boolean;
  targetIsNewer: boolean;
}

export interface RestorePreview {
  backupId: string;
  totalFiles: number;
  conflictsCount: number;
  items: RestorePreviewItem[];
}

export type RestorePolicy = "skip_existing" | "overwrite_all" | "keep_both";

// --- WORKSPACE TYPES ---
export interface WorkspaceTab {
  id: string;
  path: string;
  title: string;
}

export interface Workspace {
  id: string;
  name: string;
  tabs: WorkspaceTab[];
  activeTabId: string;
  isDualPane: boolean;
  secondaryPath?: string;
  createdAtMs: number;
  updatedAtMs: number;
}

// --- ATTRIBUTES & TIMES TYPES ---
export interface FileAttributesUpdate {
  path: string;
  readonly?: boolean;
  hidden?: boolean;
  system?: boolean;
  archive?: boolean;
}

export interface FileTimesUpdate {
  path: string;
  createdMs?: number;
  modifiedMs?: number;
  accessedMs?: number;
}

