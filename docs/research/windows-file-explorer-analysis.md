# Windows File Explorer — Behavioural Research for FinestFile

Date: 2026-10-18 · Host: Windows 11 Home, build 26200 (10.0.26200), Turkish UI locale, en-US MUI also installed.

This document records what we learned about Windows File Explorer and how it shapes FinestFile.
FinestFile is an **independent implementation**. No proprietary code, assets or non-public implementation
details were copied. We only used user-visible behaviour, public documentation and public resource metadata
(keyboard shortcuts, menu labels).

## 1. Method and tool capabilities (verified, not assumed)

### 1.1 REA (Reverse Engineer Anything): what it could actually do here

| Capability | Status on this host | Evidence |
|---|---|---|
| MCP server connection | Connected. `binary_session` responded. | session inventory |
| `inspect_pe_resources` (portable PE resource parser) | **Available, used** | see §1.2 |
| `open_binary` on `C:\Windows\explorer.exe` | Opened. SHA-256 `eee089fe…ee11`, x86_64 PE. | open result |
| `inspect_artifact` (artifact graph) | **Used.** Single PE node, no child containers. | `ev_b819f5b3…881c`, `ev_0184c208…c453` |
| Deep native analysis (procedures, pseudocode, xrefs) | **Unavailable.** `analysis_provider_binding: null`. Ghidra is not configured (`GHIDRA_INSTALL_DIR` unset, no Java). | `binary_session` |
| `capture_native_ui_scenario`, `observe_native_ui`, `observe_native_calls`, `capture_process_scenario` | **Unavailable.** `unsupported_host` (these tools are macOS-only). | `binary_session` |
| Browser and Electron runtime tools | Available but not applicable, because Explorer is not a web or Electron app. | n/a |

**Limitation:** REA could not drive or observe File Explorer's live UI on Windows, and it could not decompile
Explorer code. We did not install Ghidra on purpose. Decompiling Explorer would not help an independent
implementation, and it would risk importing proprietary implementation details. Live behaviour was observed
instead through documented Windows interfaces (PowerShell, `Shell.Application` COM, the registry and CIM).
Each finding below is tagged with its source.

### 1.2 REA evidence used

| Artifact | SHA-256 | REA Evidence ID | Resources found |
|---|---|---|---|
| `C:\Windows\en-US\explorer.exe.mui` | `926b9697…cf4`-family (`926b9697a96d…e0ec`) | `ev_c48214d8fed9f2534f7ad59e3f5a23cab9bba5fe13eebd459ed2aab8a453c9fe` | MUI 1, DIALOG 1, STRING 17, ACCELERATOR 1, VERSION 1 |
| `C:\Windows\System32\en-US\ExplorerFrame.dll.mui` | `7c10f483bce1…3732` | `ev_484727edc738c26c45835f79d0ab2989b15427d73a5d6a3345583910013d4551` | MUI 1, MENU 13, STRING 78, ACCELERATOR 6, VERSION 1 |

REA reported each resource payload's file range and SHA-256. A small scratch decoder read **only those ranges**,
checked every payload hash (`sha_ok=True` for all of them) and decoded the documented `ACCELTABLEENTRY` and
`MENUTEMPLATE` formats. Command IDs are opaque numbers. We do not interpret them beyond grouping keys that
share an ID.

### 1.3 Confidence legend

- **O**: directly observed (REA evidence or live documented-API query).
- **M**: measured.
- **I**: reasonable inference.
- **H**: unverified hypothesis.

## 2. Findings

### A. Navigation and structure

| Feature | Scenario | Observation | Conf. | FinestFile decision |
|---|---|---|---|---|
| Back / Forward / Up | keyboard | `Alt+Left`, `Alt+Right`, `Alt+Up` are in ExplorerFrame accelerator table 256. `Backspace` maps to its own command. Menu 263 shows the labels "Back Alt+Left Arrow", "Forward Alt+Right Arrow", "Up one level Alt+Up Arrow". | O | **Reproduce.** `Backspace` goes back (it is a distinct command ID in Explorer; in modern Explorer it means Back, which is I). |
| Mouse back/forward buttons | mouse | Not visible in resources. | H | Reproduce (mouse buttons 3/4). |
| Refresh | keyboard | `F5`, `Ctrl+F5`, `Ctrl+R` all share one command. | O | **Reproduce** all three. |
| Address bar focus | keyboard | `Ctrl+L`, `Alt+D`, `F4` (tables 261/262). | O | **Reproduce** `Ctrl+L`, `Alt+D`, `F4`. |
| Address bar context menu | right-click | Menu 272: "Copy address", "Copy address as text", "Edit address", "Delete history". | O | Partial: copy address and edit address. |
| Search focus | keyboard | `F3`, `Ctrl+E`, `Ctrl+F` share one command (table 259). | O | **Reproduce.** |
| Tabs | keyboard | `Ctrl+T` (new tab), `Ctrl+W` and `Ctrl+F4` (close), `Ctrl+Tab` and `Ctrl+Shift+Tab` (cycle). `Ctrl+1` to `Ctrl+9` map to 9 consecutive command IDs. | O | **Reproduce** new, close and cycle tabs. `Ctrl+1..9` switches tabs (I: in Explorer these IDs may be view modes; the IDs are opaque). We use `Ctrl+Shift+1/2` for view modes. |
| New window | keyboard | `Ctrl+N` is absent from these tables. | O (negative, bounded to these 2 MUIs) | Omitted for the initial release (single window, tabs and dual pane). |
| New folder | keyboard | `Ctrl+Shift+N`. | O | **Reproduce.** |
| Focus cycling | keyboard | `Tab`, `Shift+Tab` and `F6` share one "cycle focus" command. | O | Reproduce `F6` as pane-focus cycling. `Tab` uses normal DOM order. |
| Esc | keyboard | `Esc` has its own command. | O | Esc cancels rename and closes menus/dialogs, then clears selection. |
| Navigation pane | context menu | Menu 3400: "Expand", "Collapse", "Open", "Sort by name". | O | Sidebar sections are fixed. Tree expansion is postponed. |
| Group headers | context menu | Menu 41728: collapse/expand group, all groups. | O | **Postpone** grouping. |
| Classic menu bar | legacy menu 263/266 | File/Edit/View/Go To/Tools. These include "Map network drive", "Folder options" and "Internet options". | O | Omit the legacy menu bar. Settings has its own page. |

### B. File and folder interactions

| Feature | Observation | Conf. | FinestFile decision |
|---|---|---|---|
| Clipboard | `Ctrl+X`, `Ctrl+C`, `Ctrl+V`, plus the legacy `Ctrl+Insert` and `Shift+Insert` (`ACCEL_MERGEEXPLORER`). | O | Reproduce `Ctrl+X/C/V`. Legacy Insert combos are also bound. |
| Rename | `F2`. | O | **Reproduce**, inline in the list. |
| Delete | `Delete`, `Shift+Delete` and `Ctrl+D` all map to **one** command ID. The Recycle Bin versus permanent split happens inside the handler. | O (ID), I (split) | `Delete` and `Ctrl+D` send to the Recycle Bin. `Shift+Delete` deletes permanently **with a confirmation**. |
| Properties | `Alt+Enter` (both tables). | O | **Reproduce.** FinestFile's own properties panel, plus a "Windows Properties" action through the documented `ShellExecuteExW` "properties" verb. |
| Undo / Redo | `Ctrl+Z`, `Ctrl+Y` (table 260). | O | **Postpone.** Real undo needs an operation journal. Documented as a known gap. |
| Context menu (file) | Live `Shell.Application` verbs on a .txt file: Open, Edit, Print, Add to favourites, third-party entries (IObit Unlocker, Malwarebytes), Copy as path, Share, Restore previous versions, Cut, Copy, Create shortcut, Delete, Rename, Properties. | O | Show a curated native-feeling menu. **Improve:** no third-party shell-extension clutter by default, and actions are filtered by selection. |
| Context menu (folder) | Open, Pin to Quick access, Open with Visual Studio, Git GUI/Bash (third party), Restore previous versions, Pin to Start, Copy as path, Cut, Copy, Create shortcut, Delete, Rename, Properties. | O | Open, Open in new tab, Copy path, Cut/Copy, Rename, Delete, Add to favourites, Create archive, Properties. |
| Context menu (drive) | Open, Pin to Quick access, Restore previous versions, Malwarebytes, Pin to Start, **Format…**, Copy, Create shortcut, Rename, Properties. | O | Open, Open in new tab, Properties. **Omit** Format (high risk, out of scope). |
| Context menu (background) | Here the shell COM folder `.Self` returned the folder's own verbs. | O | Background menu: New folder, Paste, Refresh, Sort, View, Open in Terminal (omitted), Properties. |
| Clipboard menu in text fields | Menu 273: Cut / Copy / Paste / Delete / Select All. | O | The webview's native text editing menu provides this. |
| Shell extensions | The verbs above show that third-party extensions inject into every menu. | O | **Intentional difference:** no shell-extension hosting in v0.1 (stability and performance). "Show more options" is postponed. |

### C. Views, sorting, search

| Feature | Observation | Conf. | Decision |
|---|---|---|---|
| Hidden files / extensions | User settings: `Hidden=1` (show), `HideFileExt=0` (show extensions), `ShowSuperHidden=0`. | O | FinestFile has its own settings. Defaults: extensions **shown** and hidden files **hidden** (safer). System files stay hidden unless the user opts in. |
| Details / icons view | Not decodable from these resources. Common knowledge. | I | Details and grid views. |
| Sorting | "Sort by name" seen in the navigation-pane menu. | O | Name/size/type/date sorting with folders first. Natural (numeric-aware) name ordering, which matches Explorer's `StrCmpLogicalW` behaviour (public API, I). |
| Search | `F3`/`Ctrl+E`/`Ctrl+F` focus the search box. | O | Two scopes: current folder (live, recursive, cancellable) and index (instant). |

### D. Windows integration

| Feature | Observation | Conf. | Decision |
|---|---|---|---|
| Known folders | Desktop, Documents, Pictures, Music, Videos and the profile resolve under `C:\Users\katsu`. Downloads lives in the registry under `{374DE290-123F-4565-9164-39C4925E467B}`. | O | Use the documented `SHGetKnownFolderPath` with `FOLDERID_*`. Never hard-code paths. |
| Drives | CIM: `C:` fixed NTFS, 930.5 GB total, 254.5 GB free. | O | `GetLogicalDrives` + `GetDriveTypeW` + `GetDiskFreeSpaceExW` + `GetVolumeInformationW`. |
| Recycle Bin | Deletion goes through the shell. | I | `trash` crate (MIT, maintained), which uses `IFileOperation` on Windows. |
| Open with default app | Shell "Open" verb. | O | `ShellExecuteW` with the "open" verb and the path passed as a parameter. **No command strings are built.** |
| Change notifications | Not observable without a debugger. | H | `notify` crate (`ReadDirectoryChangesW`) for indexed roots, plus reconciliation rescans. |

### E. Performance (measured)

| Metric | Value | Conf. | Notes |
|---|---|---|---|
| explorer.exe working set | 567.6 MB | M | One process (`SeparateProcess=0`). It **also hosts the taskbar, Start integration and desktop**, so this is not a fair file-browser comparison (I). |
| explorer.exe private bytes | 1196.1 MB | M | Same caveat. |
| Handles / threads | 7237 / 195 | M | Same caveat. |

FinestFile measurements are in `docs/research/finestfile-comparison.md`.

## 3. Feature comparison summary

| Category | Items |
|---|---|
| **Familiar behaviour to reproduce** | Alt+Left/Right/Up, Backspace, F5/Ctrl+R, Ctrl+L/Alt+D/F4, F3/Ctrl+E/Ctrl+F, Ctrl+T/W/Tab, Ctrl+Shift+N, F2, Delete/Shift+Delete, Ctrl+X/C/V, Alt+Enter, F6, known folders, drives with capacity, breadcrumbs, tabs, details/grid views, natural sort, Recycle Bin. |
| **Existing limitations worth improving** | Context-menu clutter from shell extensions. Opaque progress for long operations, so we use an operation queue with per-job cancel. Built-in dual pane. ZIP extraction that **rejects unsafe paths** and asks about conflicts. Transparent, user-controlled indexing that can be paused, resumed or turned off. Lower idle cost with no background work unless indexing is enabled. |
| **Requires deeper investigation** | Explorer's exact conflict-dialog semantics (skip, replace, keep both). Thumbnail cache (`thumbcache_*.db`) behaviour. Search-index (Windows Search) interop. |
| **Postponed** | Undo/redo journal, grouping, navigation tree expansion, native shell context-menu hosting ("Show more options"), dragging *out* to other apps, CF_HDROP clipboard interop, network drive mapping. |
| **Unsuitable for initial release** | Format drive, Internet options, Sync Center, IEAK toolbar options, library management. |

## 4. Reproduction steps

1. REA: `inspect_pe_resources { path: "C:\\Windows\\System32\\en-US\\ExplorerFrame.dll.mui" }`, then decode the
   accelerator payloads at the reported offsets (script: `docs/research/tools/decode_resources.py`).
2. Verbs: `(New-Object -ComObject Shell.Application).NameSpace($dir).ParseName($name).Verbs()`.
3. Settings: `Get-ItemProperty HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced`.
4. Memory: `Get-Process explorer | Select WorkingSet64, PrivateMemorySize64, Handles`.

All experiments used `%TEMP%\ff-research` with disposable files. No user data was modified.
