# Windows File Explorer Reverse Engineering & Behavioral Analysis

## 1. Environment & Target Identification
- **Operating System**: Microsoft Windows NT 10.0.26200.0 (Windows 11 Build 26100.9711 / 26200)
- **Binary Target**: `C:\Windows\explorer.exe`
- **File Version**: 10.0.26100.8875 (WinBuild.160101.0800)
- **Binary Architecture**: PE32+ (x86_64)
- **SHA-256**: `eee089fe6f927c7f0d51b0abd9d70c094157e33673ad760713ec7b1cea18ee11`
- **Window Class**: `CabinetWClass`
- **Shell View Class**: `ShellTabWindowClass` -> `DUIListView` -> `UIItemsView`
- **Inspection Tools**:
  - REA (Reverse Engineer Anything): PE Resource inspector (`inspect_pe_resources`), PE header and data directory analysis.
  - Windows UIAutomation API (`UIAutomationClient`): Live inspection of running `CabinetWClass` controls, headers, panes, and status bar.
  - Microsoft Official Documentation: Shell View modes, `IShellItemImageFactory`, `SIIGBF` flags, keyboard shortcuts.

---

## 2. Observable Windows File Explorer Behaviors

### A. Ctrl + Mouse-Wheel Zoom Behavior
- **Observed Behavior**:
  - In Windows 11 Explorer, rotating the mouse wheel while holding `Ctrl` smoothly steps through view modes and icon sizes:
    1. **Extra Large Icons** (256px)
    2. **Large Icons** (96px)
    3. **Medium Icons** (48px)
    4. **Small Icons** (16px)
    5. **List** (Multi-column vertical list)
    6. **Details** (Row table with Name, Date Modified, Type, Size columns)
    7. **Tiles** (48px icon with 2 lines of text)
    8. **Content** (32px icon with detailed 4-line property metadata)
  - Zooming in (`Ctrl + Wheel Up`) enlarges icons smoothly in icon mode and transitions upward between view modes.
  - Zooming out (`Ctrl + Wheel Down`) shrinks icons down to small icons and transitions into List / Details view.
  - Normal scrolling (`Wheel` without `Ctrl`) scrolls the item list vertically or horizontally depending on layout, and **never** adjusts icon size.
  - The view retains the currently selected items and scroll context without re-querying the folder or dropping selection.

### B. Image and Video Thumbnail Rendering
- **Shell Thumbnail Pipeline**:
  - Windows Explorer utilizes `IShellItemImageFactory::GetImage` with flags:
    - `SIIGBF_RESIZETOFIT` (0x00): Downscale to fit bounding box while maintaining aspect ratio.
    - `SIIGBF_BIGGERSIZEOK` (0x01): If exact requested size is unavailable, return a larger icon/thumbnail rather than failing or upscaling.
    - `SIIGBF_THUMBNAILONLY` (0x02): Returns `HRESULT_FROM_WIN32(ERROR_NOT_FOUND)` if only an icon (not a true thumbnail) is available.
  - Video files display a filmstrip or frame overlay with duration/resolution when hovered or inspected in Content/Details view.
  - Explorer does **not** auto-play video files on selection; only static poster frames extracted from the video stream are rendered.

### C. Selection, Navigation, and Panes
- **Observed UI Structure (from UIAutomation of `CabinetWClass`)**:
  - **Header / Address Area**: `ShellTabWindowClass`, Breadcrumb bar, Search box.
  - **Navigation Pane**: `SysTreeView32` inside `ProperTreeHost`. Shows Quick Access / Home, OneDrive, This PC, Network.
  - **Item View**: `UIItemsView` inside `DUIListView`. Contains `UIViewHeader` with split buttons for sorting and column filtering (`Ad`, `Değiştirme tarihi`, `Tür`, `Boyut`).
  - **Status Bar**: `StatusBarModuleInner` containing item count text (`X öğe`, `1 öğe seçildi`) and view switch buttons (Details vs Large Icons toggle).
  - **Preview / Details Pane**: `DetailsPaneHwndHostClass` (Details Pane) and Preview Pane (`Alt + P`).

### D. Keyboard Shortcuts
- `Alt + P`: Toggle Preview Pane.
- `Alt + Shift + P`: Toggle Details Pane.
- `Ctrl + Shift + 1`: Extra Large Icons.
- `Ctrl + Shift + 2`: Large Icons.
- `Ctrl + Shift + 3`: Medium Icons.
- `Ctrl + Shift + 4`: Small Icons.
- `Ctrl + Shift + 5`: List.
- `Ctrl + Shift + 6`: Details.
- `Ctrl + Shift + 7`: Tiles.
- `Ctrl + Shift + 8`: Content.
- `F5`: Refresh active folder.
- `Alt + Up`: Navigate to parent directory.
- `Alt + Left`: Back in history.
- `Alt + Right`: Forward in history.
- `Enter`: Open selected item.
- `Delete`: Move to Recycle Bin (Trash).
- `Shift + Delete`: Permanently delete.
- `F2`: Rename selected item.

---

## 3. Comparison: Documented vs Observed vs Implementation Differences

| Feature | Windows 11 Explorer Observed | FinestFile Standard Mode | FinestFile Windows Explorer Mode |
|---|---|---|---|
| **Layout** | Navigation tree left, Tab bar top, Command bar, File list center, Preview right | Minimal clean dual-pane / tabs / status bar | Native Explorer layout: Breadcrumb, Win11 style toolbar, Details/Large toggle in status bar |
| **Ctrl + Wheel** | Discrete steps through Extra Large -> Large -> Medium -> Small -> Details | Continuous pixel slider (32px-320px) | Discrete standard Windows step sizing (256, 128, 96, 48, 32, Details) |
| **Preview Pane** | Read-only static preview + metadata, toggle with Alt+P | Interactive preview with Pan/Zoom/Rotate + Space modal | Explorer-like preview pane with accurate metadata and play overlay |
| **Video Playback** | Requires opening in media player; preview pane shows static poster | In-app video preview with explicit play overlay | Static thumbnail poster with explicit play overlay or Open Default action |
| **True Explorer Parity** | Native Win32 / WinUI 3 XAML | Tauri + React + TypeScript webview | Faithful visual & behavioral replica + "Open in Windows File Explorer" native shortcut |

---

## 4. Honest Compatibility Statement
FinestFile is an independent open-source cross-platform application developed in Rust, Tauri, and React. While Windows Explorer Mode faithfully replicates the visual hierarchy, color palette, icon sizing, keyboard shortcuts, and view arrangements of Windows 11 Explorer, it runs in a specialized Webview environment and does not execute proprietary Explorer shell namespaces or COM extensions. An explicit command is provided to instantly launch the genuine Windows Explorer at the current folder location when 100% native shell extensions are required.
