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

export interface AppSettings {
  theme: "system" | "light" | "dark";
  accentColor: AccentColor;
  fontFamily: FontFamilyOption;
  fontSize: FontSizeOption;
  showHiddenFiles: boolean;
  showFileExtensions: boolean;
  defaultViewMode: "details" | "grid";
  dualPaneEnabled: boolean;
  confirmDelete: boolean;
  viewPreferences: ViewPreferences;
  customShortcuts?: Record<string, string>;
  index: IndexSettings;
}
