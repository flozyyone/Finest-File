# FinestFile Critical Bug Fix & Diagnosis Report

## Executive Summary
This report documents the root causes for the three identified critical failures in FinestFile:
1. **Ctrl + mouse-wheel icon and thumbnail resizing failure / Webview zoom conflicts**
2. **Image thumbnails & preview failures**
3. **Video thumbnails & preview failures**

All tests and inspections were performed directly against the local Rust backend (`crates/finestfile-core`, `src-tauri`) and React frontend (`src`).

---

## 1. Feature Diagnosis

### Bug 1: Ctrl + Mouse Wheel Icon and Thumbnail Resizing
- **Symptoms**:
  - Scrolling with Ctrl held down fails to zoom smoothly or in sync across the view.
  - In Details view, wheel zooming either had no effect or forced a view mode switch that disoriented the user.
  - Tauri / WebView default zoom (`Ctrl + Wheel` zooming the entire DOM/font scaling) could clash with application-level icon resizing.
  - Double listener registration (`window.addEventListener` AND `document.addEventListener` with `{ capture: true }`) causing double invocations or throttled dropouts.
  - When wheeling over `FileList`, event propagation was not properly scoped to the file container, causing normal scroll and zoom collisions.
- **Root Causes**:
  - `App.tsx` registered identical capture listeners on both `window` and `document`.
  - Zoom state was clamped between 32 and 320 px with rigid 16 px step, and `handleZoomOut` dropped straight into `viewMode = "details"` when `z <= MIN_ZOOM` without supporting Windows Explorer-style continuous discrete step transitions (Extra Large, Large, Medium, Small / Details / Tiles / List).
  - Webview lacked explicit prevention of browser viewport pinch/zoom gestures.
- **Files Affected**:
  - `src/App.tsx`
  - `src/components/FileList.tsx`
  - `src/components/ViewToolbar.tsx`

---

### Bug 2: Actual Image Thumbnails and Image Previews
- **Symptoms**:
  - Pure Rust backend (`thumbnail.rs`) had format auto-detection only via `image::ImageReader`, which works for JPEG/PNG/GIF/BMP/WebP, but failed on SVGs (handled separately) and didn't reliably handle EXIF orientations or cache invalidation on modified timestamps.
  - In `FileList.tsx`, thumbnails were loaded using `convertFileSrc` directly for files in `allItems`. However, if `viewMode` switched or large folders were opened, thousands of `convertFileSrc` requests triggered simultaneously without visibility prioritization or memory bounding.
  - Preview pane (`PreviewPane.tsx`) relied on `convertFileSrc(selectedEntry.path)` directly. For very large images (e.g. 50MB RAW/JPEG/PNG), loading full-resolution uncompressed bitmaps in the webview causes severe UI stutter, rather than using decoded cached previews or fit-to-viewport bounds.
- **Root Causes**:
  - Lack of thumbnail queue concurrency limits in frontend.
  - `thumbnail.rs` cached thumbnail dimensions to max_dimension without preserving exact aspect ratio in metadata return.
  - Stale cache detection was based on unix timestamp seconds; precision issues or file modification without mtime update could cause stale entries.
- **Files Affected**:
  - `crates/finestfile-core/src/thumbnail.rs`
  - `src/components/FileList.tsx`
  - `src/components/PreviewPane.tsx`
  - `src/components/QuickPreviewModal.tsx`

---

### Bug 3: Actual Video Thumbnails and Video Previews
- **Symptoms**:
  - Video thumbnails in `FileList.tsx` relied on an in-memory `<video>` DOM element seeking to 0.5s via `extractVideoFrame()`. In WebKit/Blink (Tauri webview on Windows uses Edge WebView2), video decoders for MKV, AVI, WMV, FLV, and HEVC/H.265 are often unsupported or disabled due to patent/licensing restrictions in the webview runtime.
  - `thumbnail.rs` used `IShellItemImageFactory` via Windows Shell API COM interface on Windows, but COM initialization was performed per-call with potential thread-apartment concurrency issues (`COINIT_APARTMENTTHREADED` on thread pool worker threads without `CoUninitialize` pairing safety).
  - When Windows Shell failed or returned a generic file icon rather than a real video frame, `FileList.tsx` fell back to `extractVideoFrame` which repeatedly timed out (2500ms per item) blocking subsequent batch requests.
- **Root Causes**:
  - Front-end fallback was sequential and had high timeout (2.5s per failed video).
  - Lack of bundled native frame decoding fallback (or Windows Media Foundation / Shell extraction optimization).
  - Preview pane didn't distinguish between formats playable by HTML5 `<video>` (MP4/H.264, WebM/VP8/VP9) versus container/codec formats requiring external player or shell thumbnails.
- **Files Affected**:
  - `crates/finestfile-core/src/thumbnail.rs`
  - `src/components/FileList.tsx`
  - `src/components/PreviewPane.tsx`

---

## 2. Test & Verification Plan
1. **Ctrl + Mouse Wheel**:
   - Unit test discrete zoom levels and zoom clamp in frontend tests.
   - Test event listener scoping: wheel without Ctrl scrolls container; wheel with Ctrl changes icon size; no webview scale changes.
2. **Image Thumbnails & Previews**:
   - Create test images (PNG, JPEG, BMP, WebP, SVG).
   - Verify thumbnail generation returns valid JPEG base64 or SVG data URL.
   - Verify cache reuse on identical mtime, and cache refresh on file update.
   - Verify PreviewPane loads preview and metadata (dimensions, file size) asynchronously.
3. **Video Thumbnails & Previews**:
   - Verify Windows Shell thumbnail extraction or fallback extracts valid frames for video formats.
   - Verify video play controls only appear when explicit play is triggered, never auto-playing.
   - Verify graceful fallback for unsupported formats.
4. **Windows Explorer Mode**:
   - Verify mode switch toggle persists in settings and applies Windows Explorer styling, icon sizes, and view modes.
