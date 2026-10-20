export type SupportedLanguage = "tr" | "en" | "ur" | "fr" | "de" | "ar" | "ru" | "es";

export type TextDirection = "ltr" | "rtl";

export interface LanguageInfo {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  dir: TextDirection;
}

export interface TranslationDictionary {
  app: {
    name: string;
    tagline: string;
    loading: string;
  };
  common: {
    ok: string;
    cancel: string;
    save: string;
    close: string;
    delete: string;
    edit: string;
    rebind: string;
    reset: string;
    resetAll: string;
    search: string;
    clear: string;
    apply: string;
    yes: string;
    no: string;
    retry: string;
    copy: string;
    cut: string;
    paste: string;
    rename: string;
    properties: string;
    back: string;
    forward: string;
    up: string;
    refresh: string;
    customized: string;
  };
  nav: {
    thisPc: string;
    quickAccess: string;
    desktop: string;
    documents: string;
    downloads: string;
    pictures: string;
    music: string;
    videos: string;
    recycleBin: string;
    newTab: string;
    closeTab: string;
    addressBarPlaceholder: string;
    searchPlaceholder: string;
    drives: string;
    favorites: string;
  };
  view: {
    view: string;
    details: string;
    grid: string;
    zoomIn: string;
    zoomOut: string;
    resetZoom: string;
    sortBy: string;
    groupBy: string;
    ascending: string;
    descending: string;
    foldersFirst: string;
    resetView: string;
    dualPane: string;
    settings: string;
    keyboardShortcuts: string;
    name: string;
    type: string;
    size: string;
    dateModified: string;
    dateCreated: string;
    dateAccessed: string;
    attributes: string;
    none: string;
    itemsCount: string; // e.g. "{count} items"
    selectedCount: string; // e.g. "{count} items selected"
    previewPane: string;
    fitToWindow: string;
    actualSize: string;
    dimensions: string;
    noPreview: string;
  };
  dateGroups: {
    today: string;
    yesterday: string;
    earlierThisWeek: string;
    lastWeek: string;
    earlierThisMonth: string;
    older: string;
  };
  sizeGroups: {
    empty: string;
    tiny: string;
    small: string;
    medium: string;
    large: string;
    veryLarge: string;
    huge: string;
  };
  operations: {
    newFolder: string;
    newFile: string;
    copyPath: string;
    openWith: string;
    openDefault: string;
    extractArchive: string;
    createZip: string;
    permanentDelete: string;
    moveToRecycleBin: string;
    selectAll: string;
    invertSelection: string;
    deleteConfirmTitle: string;
    deleteConfirmMsg: string;
    permanentDeleteConfirmMsg: string;
    folderNamePlaceholder: string;
    fileNamePlaceholder: string;
    alreadyExists: string;
    invalidChars: string;
    bakItUp: string;
    groupTabs: string;
    adminMode: string;
    changeAttributes: string;
    workspaces: string;
    saveWorkspace: string;
    restoreWorkspace: string;
  };
  properties: {
    title: string;
    general: string;
    name: string;
    type: string;
    location: string;
    size: string;
    contains: string;
    created: string;
    modified: string;
    accessed: string;
    attributes: string;
    readOnly: string;
    hidden: string;
    system: string;
    folderContains: string; // e.g. "{files} files, {folders} folders"
  };
  settings: {
    title: string;
    generalTab: string;
    indexingTab: string;
    language: string;
    theme: string;
    systemTheme: string;
    lightTheme: string;
    darkTheme: string;
    accentColor: string;
    fontFamily: string;
    fontSize: string;
    smallSize: string;
    mediumSize: string;
    largeSize: string;
    showHidden: string;
    showExtensions: string;
    confirmDelete: string;
    dualPane: string;
    windowsExplorerMode: string;
    colors: {
      blue: string;
      teal: string;
      purple: string;
      amber: string;
      emerald: string;
      slate: string;
    };
    fonts: {
      system: string;
      segoe: string;
      cascadia: string;
      aptos: string;
      consolas: string;
    };
  };
  indexing: {
    title: string;
    description: string;
    enabled: string;
    monitoredRoots: string;
    excludedPatterns: string;
    autoWatch: string;
    startScan: string;
    cancelScan: string;
    clearIndex: string;
    statusIdle: string;
    statusScanning: string;
    totalFiles: string;
    totalFolders: string;
    totalSize: string;
    lastScan: string;
    never: string;
  };
  jobs: {
    title: string;
    noJobs: string;
    clearCompleted: string;
    copy: string;
    move: string;
    delete: string;
    trash: string;
    extract: string;
    createArchive: string;
    folderSize: string;
    queued: string;
    running: string;
    completed: string;
    failed: string;
    cancelled: string;
  };
  shortcuts: {
    title: string;
    searchPlaceholder: string;
    categories: {
      all: string;
      navigation: string;
      operations: string;
      selection: string;
      view: string;
      tabs: string;
      help: string;
    };
    explorerBehavior: string;
    differences: string;
    pressKeysPrompt: string;
    conflictWarning: string;
    compatBadge: string;
    registeredCount: string;
  };
  errors: {
    notFound: string;
    permissionDenied: string;
    accessDenied: string;
    alreadyExists: string;
    invalidName: string;
    invalidPath: string;
    emptyFolder: string;
    noSearchResults: string;
    unexpected: string;
  };
}
