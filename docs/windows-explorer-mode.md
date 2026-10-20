# Windows Explorer Mode in FinestFile

## 1. Overview
**Windows Explorer Mode** is an authentic compatibility layout and experience mode inside FinestFile. It reproduces the observable user interface, visual hierarchy, typography, icon sizing, command bar, and navigation paradigm of Windows 11 File Explorer (`CabinetWClass`), while preserving FinestFile's lightweight, offline-first, rust-powered backend, multilingual support (8 languages), dual-pane capabilities, and cross-platform flexibility.

---

## 2. REA & Behavioral Alignment

Guided by reverse engineering with REA on `C:\Windows\explorer.exe` (Windows 11 Build 26100.9711 / 26200) and live `UIAutomationClient` inspection of `CabinetWClass`, the following behaviors and UI elements are replicated:

### A. Windows 11 Command Bar (Ribbon)
- **`+ New` Split Button**: Quick creation of Folders (`Ctrl+Shift+N`) and Text Documents.
- **Fluent Glyph Action Bar**:
  - `Cut` (Scissors, `Ctrl+X`)
  - `Copy` (Two pages, `Ctrl+C`)
  - `Paste` (Clipboard, `Ctrl+V`)
  - `Rename` (Edit, `F2`)
  - `Share` (Share sheet / Copy path)
  - `Delete` (Trash can, `Del`)
- **`Sort` Menu**: Name, Date Modified, Type, Size with Ascending/Descending ordering and Group by options.
- **`View` Menu**: Directly switches between all 8 Windows 11 view layouts, with toggles for hidden files, file extensions, and preview pane.
- **`...` (See More)**: Provides instant native hand-off ("Open in Windows File Explorer"), folder refresh (`F5`), and settings.
- **One-Click Mode Switcher**: A prominent Windows 11 pill toggle (`[ 🪟 Windows Explorer Mode: ON ]`) enables switching back and forth between Windows Explorer Mode and FinestFile Standard Mode with a single click.

### B. All 8 Authentic Windows 11 View Modes
1. **Extra Large Icons (256px)** (`Ctrl+Shift+1`): Large thumbnails and icons with centered multi-line labels.
2. **Large Icons (96px)** (`Ctrl+Shift+2`): Standard media preview grid.
3. **Medium Icons (48px)** (`Ctrl+Shift+3`): Compact icon grid.
4. **Small Icons (24px)** (`Ctrl+Shift+4`): High-density icon layout.
5. **List (`Ctrl+Shift+5`)**: Multi-column compact vertical list with 16px icons.
6. **Details (`Ctrl+Shift+6`)**: Column table with sortable `Name`, `Date modified`, `Type`, and `Size` headers, row hover highlighting, and left accent pill on active selection.
7. **Tiles (`Ctrl+Shift+7`)**: 48px icon on the left with filename on top line and file type + size side-by-side on the second line.
8. **Content (`Ctrl+Shift+8`)**: 32px icon on the left with 4-line detailed metadata card (Name, Date modified, Type, and Size).

### C. Ctrl + Mouse Wheel Stepping & Zoom
- **Discrete Transitions**:
  - Zooming in (`Ctrl + Wheel Up`) steps up between view modes and sizes:
    `details` -> `list` -> `tiles` -> `content` -> `medium-icons` (48px) -> `large-icons` (96px) -> `extra-large-icons` (256px).
  - Zooming out (`Ctrl + Wheel Down`) smoothly transitions down the hierarchy to Details view.
  - Normal wheel scrolling continues to scroll file list items vertically without changing zoom or view mode.
  - Tauri webview whole-window viewport zooming is prevented.

### D. Navigation Pane & Status Bar
- **Navigation Pane (Sidebar)**:
  - Quick Access / Home (Desktop, Downloads, Documents, Pictures, Music, Videos).
  - This PC: Drive letters (C:, D:) with Windows 11 drive icons and storage capacity progress bars (`X GB free of Y GB`, turning red when >90% full).
  - Direct shortcut: `Open in Windows File Explorer`.
- **Status Bar**:
  - Left: Item count (`X items`) and selected item count with byte size (`Y items selected  Z MB`).
  - Right: Exactly two buttons matching Windows 11 Explorer's `StatusBarModuleInner` toggle buttons (`Details` and `Large Icons`).

### E. Context Menu & Media Thumbnails
- **Windows 11 Context Menu**: Top row of small action icons (`Cut`, `Copy`, `Rename`, `Share`, `Delete`) plus standard menu items.
- **Clean Thumbnails**: In Windows Explorer Mode, video thumbnails render clean rectangular poster frames with a small video camera watermark in the corner (no sprocket holes), matching native Windows 11 Explorer.

---

## 3. Visual & Styling Alignment
- **Typography**: Uses `Segoe UI Variable Text` / `Segoe UI` system fonts with Windows subpixel anti-aliasing.
- **Color Palette & Light/Dark Theme**:
  - Light: `#f9f9f9` background, `#f3f3f3` navigation pane, `#ffffff` content surface, `#005fb8` Windows 11 accent color, `#191919` text, `#e5e5e5` subtle borders.
  - Dark: `#1f1f1f` background, `#181818` navigation pane, `#262626` content surface, `#60cdff` Windows 11 dark accent color, `#ffffff` text, `#333333` borders.
- **Selection Highlights**: Soft rounded corners (`border-radius: 4px`) and Windows 11 semi-transparent blue selection overlays with left vertical accent indicators in Details view.

---

## 4. Honest Compatibility Statement
FinestFile is an independent open-source application built with Rust, Tauri, and React. While Windows Explorer Mode faithfully matches the visual arrangement, icons, view layouts, keyboard shortcuts, and behavior of Windows 11 Explorer, it does not host proprietary Win32 shell namespaces or COM shell extensions. A dedicated **"Open in Windows File Explorer"** command is available in the toolbar, sidebar, and context menu whenever 100% native shell extensions (such as OneDrive sync icons or third-party context menu handlers) are required.
