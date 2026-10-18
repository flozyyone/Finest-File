use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::SystemTime;
use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThumbnailResult {
    pub data_url: String,
    pub width: u32,
    pub height: u32,
    pub mime_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaPreviewInfo {
    pub path: String,
    pub file_name: String,
    pub size_bytes: u64,
    pub mime_type: String,
    pub media_type: String, // "image" | "video" | "audio" | "other"
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub duration_secs: Option<f64>,
    pub thumbnail_url: Option<String>,
}

static CACHE_CLEANUP_COUNTER: AtomicU64 = AtomicU64::new(0);

/// Generates a deterministic hash for a file and target dimension
fn thumbnail_cache_key(path: &Path, max_dimension: u32) -> Option<String> {
    let metadata = fs::metadata(path).ok()?;
    let size = metadata.len();
    let mtime = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let canonical = path.to_string_lossy().to_lowercase();
    let input = format!("{}:{}:{}:{}", canonical, size, mtime, max_dimension);

    // Simple fast 64-bit FNV-1a hash
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in input.as_bytes() {
        hash ^= *byte as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }

    Some(format!("{:016x}", hash))
}

/// Prunes old cache files if the cache exceeds max_bytes (default: 100MB)
pub fn prune_cache_if_needed(cache_dir: &Path, max_bytes: u64) {
    let count = CACHE_CLEANUP_COUNTER.fetch_add(1, Ordering::Relaxed);
    // Only check every 100 calls to avoid filesystem overhead
    if count % 100 != 0 {
        return;
    }

    let entries = match fs::read_dir(cache_dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    let mut files = Vec::new();
    let mut total_size: u64 = 0;

    for entry in entries.flatten() {
        if let Ok(meta) = entry.metadata() {
            if meta.is_file() {
                let size = meta.len();
                total_size += size;
                let mtime = meta.modified().unwrap_or(SystemTime::UNIX_EPOCH);
                files.push((entry.path(), size, mtime));
            }
        }
    }

    if total_size > max_bytes {
        // Sort oldest first
        files.sort_by_key(|(_, _, mtime)| *mtime);
        let target_size = (max_bytes * 3) / 4; // Prune down to 75%
        let mut current_size = total_size;

        for (path, size, _) in files {
            if current_size <= target_size {
                break;
            }
            if fs::remove_file(&path).is_ok() {
                current_size = current_size.saturating_sub(size);
            }
        }
    }
}

/// Generates or retrieves a cached thumbnail for an image or video file
pub fn get_thumbnail(
    path: &Path,
    max_dimension: u32,
    cache_dir: &Path,
) -> Result<ThumbnailResult, String> {
    if !path.exists() {
        return Err(format!("File does not exist: {}", path.display()));
    }

    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_ascii_lowercase())
        .unwrap_or_default();

    // 1. Check cache first
    let cache_key = thumbnail_cache_key(path, max_dimension);
    if let Some(ref key) = cache_key {
        let cached_file = cache_dir.join(format!("{}.jpg", key));
        if cached_file.is_file() {
            if let Ok(bytes) = fs::read(&cached_file) {
                if !bytes.is_empty() {
                    let base64_str = BASE64.encode(&bytes);
                    let data_url = format!("data:image/jpeg;base64,{}", base64_str);
                    return Ok(ThumbnailResult {
                        data_url,
                        width: max_dimension,
                        height: max_dimension,
                        mime_type: "image/jpeg".to_string(),
                    });
                }
            }
        }
    }

    // 2. Format classification
    let is_image = matches!(
        ext.as_str(),
        "jpg" | "jpeg" | "png" | "webp" | "bmp" | "gif" | "tiff" | "tif"
    );
    let is_svg = ext == "svg";
    let is_video = matches!(
        ext.as_str(),
        "mp4" | "mkv" | "mov" | "webm" | "avi" | "wmv" | "m4v" | "3gp"
    );

    if is_svg {
        return generate_svg_thumbnail(path);
    }

    let (bytes, width, height) = if is_image {
        generate_image_thumbnail_bytes(path, max_dimension)?
    } else if is_video {
        generate_shell_thumbnail_bytes(path, max_dimension)?
    } else {
        // Try Windows Shell for other file formats that Windows has shell thumbnailers for
        generate_shell_thumbnail_bytes(path, max_dimension)?
    };

    // 3. Write to disk cache
    if let Some(ref key) = cache_key {
        let _ = fs::create_dir_all(cache_dir);
        let cached_file = cache_dir.join(format!("{}.jpg", key));
        let _ = fs::write(&cached_file, &bytes);
        prune_cache_if_needed(cache_dir, 100 * 1024 * 1024); // 100MB limit
    }

    let base64_str = BASE64.encode(&bytes);
    let data_url = format!("data:image/jpeg;base64,{}", base64_str);

    Ok(ThumbnailResult {
        data_url,
        width,
        height,
        mime_type: "image/jpeg".to_string(),
    })
}

/// Generates SVG thumbnail directly as base64 SVG data URL
fn generate_svg_thumbnail(path: &Path) -> Result<ThumbnailResult, String> {
    let metadata = fs::metadata(path).map_err(|e| e.to_string())?;
    if metadata.len() > 1024 * 1024 {
        return Err("SVG file too large for thumbnail (limit 1MB)".to_string());
    }

    let contents = fs::read(path).map_err(|e| e.to_string())?;
    let base64_str = BASE64.encode(&contents);
    let data_url = format!("data:image/svg+xml;base64,{}", base64_str);

    Ok(ThumbnailResult {
        data_url,
        width: 128,
        height: 128,
        mime_type: "image/svg+xml".to_string(),
    })
}

/// Pure Rust image thumbnail generator using `image` crate
fn generate_image_thumbnail_bytes(
    path: &Path,
    max_dimension: u32,
) -> Result<(Vec<u8>, u32, u32), String> {
    // Open image reader with format auto-detection
    let reader = image::ImageReader::open(path)
        .map_err(|e| format!("Failed to open image: {}", e))?
        .with_guessed_format()
        .map_err(|e| format!("Failed to identify image format: {}", e))?;

    let img = reader
        .decode()
        .map_err(|e| format!("Failed to decode image: {}", e))?;

    let (orig_w, orig_h) = (img.width(), img.height());
    if orig_w == 0 || orig_h == 0 {
        return Err("Image has zero dimensions".to_string());
    }

    // Proportionally scale to fit max_dimension preserving aspect ratio
    let thumb = img.thumbnail(max_dimension, max_dimension);
    let (tw, th) = (thumb.width(), thumb.height());

    let mut jpeg_bytes = Vec::new();
    let mut cursor = Cursor::new(&mut jpeg_bytes);

    // Encode thumbnail as JPEG with quality 82
    let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut cursor, 82);
    encoder
        .encode_image(&thumb)
        .map_err(|e| format!("Failed to encode thumbnail JPEG: {}", e))?;

    Ok((jpeg_bytes, tw, th))
}

/// Windows Shell thumbnail extraction for videos and other formats via IShellItemImageFactory
#[cfg(windows)]
fn generate_shell_thumbnail_bytes(
    path: &Path,
    max_dimension: u32,
) -> Result<(Vec<u8>, u32, u32), String> {
    use std::ffi::c_void;
    use std::os::windows::ffi::OsStrExt;
    type HRESULT = i32;
    use windows_sys::Win32::Foundation::{S_OK, SIZE};
    use windows_sys::Win32::Graphics::Gdi::{
        DeleteObject, GetDIBits, GetDC, ReleaseDC, BITMAPINFO, BITMAPINFOHEADER, BI_RGB,
        DIB_RGB_COLORS, HBITMAP, RGBQUAD,
    };
    use windows_sys::Win32::System::Com::{
        CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED, COINIT_DISABLE_OLE1DDE,
    };
    use windows_sys::Win32::UI::Shell::SHCreateItemFromParsingName;

    // IShellItemImageFactory GUID: {bcc18b79-ba16-442f-80c4-8a140df4d14c}
    const IID_ISHELLITEMIMAGEFACTORY: windows_sys::core::GUID = windows_sys::core::GUID {
        data1: 0xbcc18b79,
        data2: 0xba16,
        data3: 0x442f,
        data4: [0x80, 0xc4, 0x8a, 0x14, 0x0d, 0xf4, 0xd1, 0x4c],
    };

    // Flags: SIIGBF_BIGGERSIZEOK = 0x01
    const SIIGBF_BIGGERSIZEOK: u32 = 0x01;

    let path_wide: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();

    unsafe {
        // Initialize COM for this thread if not already initialized
        let _ = CoInitializeEx(
            std::ptr::null_mut(),
            (COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE) as u32,
        );

        let mut factory_ptr: *mut c_void = std::ptr::null_mut();
        let hr: HRESULT = SHCreateItemFromParsingName(
            path_wide.as_ptr(),
            std::ptr::null_mut(),
            &IID_ISHELLITEMIMAGEFACTORY,
            &mut factory_ptr,
        );

        if hr != S_OK || factory_ptr.is_null() {
            CoUninitialize();
            return Err(format!("Shell item could not be created (HRESULT 0x{:08x})", hr));
        }

        // IShellItemImageFactory vtable:
        // 0: QueryInterface, 1: AddRef, 2: Release, 3: GetImage
        type GetImageFn = unsafe extern "system" fn(
            this: *mut c_void,
            size: SIZE,
            flags: u32,
            phbm: *mut HBITMAP,
        ) -> HRESULT;

        type ReleaseFn = unsafe extern "system" fn(this: *mut c_void) -> u32;

        let vtable = *(factory_ptr as *mut *mut usize);
        let get_image: GetImageFn = std::mem::transmute(*vtable.add(3));
        let release: ReleaseFn = std::mem::transmute(*vtable.add(2));

        let size = SIZE {
            cx: max_dimension as i32,
            cy: max_dimension as i32,
        };
        let mut hbitmap: HBITMAP = std::ptr::null_mut();

        let hr_image = get_image(factory_ptr, size, SIIGBF_BIGGERSIZEOK, &mut hbitmap);
        release(factory_ptr);

        if hr_image != S_OK || hbitmap.is_null() {
            CoUninitialize();
            return Err(format!("Shell GetImage failed (HRESULT 0x{:08x})", hr_image));
        }

        // Extract DIB bits from HBITMAP
        let hdc = GetDC(std::ptr::null_mut());
        if hdc.is_null() {
            DeleteObject(hbitmap);
            CoUninitialize();
            return Err("Failed to get DC".to_string());
        }

        let mut bi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: max_dimension as i32,
                biHeight: -(max_dimension as i32), // top-down
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB,
                biSizeImage: 0,
                biXPelsPerMeter: 0,
                biYPelsPerMeter: 0,
                biClrUsed: 0,
                biClrImportant: 0,
            },
            bmiColors: [RGBQUAD {
                rgbBlue: 0,
                rgbGreen: 0,
                rgbRed: 0,
                rgbReserved: 0,
            }],
        };

        // First probe actual bitmap dimensions
        let _ = GetDIBits(
            hdc,
            hbitmap,
            0,
            0,
            std::ptr::null_mut(),
            &mut bi,
            DIB_RGB_COLORS,
        );

        let actual_width = bi.bmiHeader.biWidth.abs() as u32;
        let actual_height = bi.bmiHeader.biHeight.abs() as u32;

        if actual_width == 0 || actual_height == 0 {
            ReleaseDC(std::ptr::null_mut(), hdc);
            DeleteObject(hbitmap);
            CoUninitialize();
            return Err("Zero dimension shell bitmap".to_string());
        }

        // Set top-down height
        bi.bmiHeader.biHeight = -(actual_height as i32);
        bi.bmiHeader.biBitCount = 32;
        bi.bmiHeader.biCompression = BI_RGB;

        let mut bgra_buf: Vec<u8> = vec![0u8; (actual_width * actual_height * 4) as usize];

        let scanlines = GetDIBits(
            hdc,
            hbitmap,
            0,
            actual_height,
            bgra_buf.as_mut_ptr() as *mut c_void,
            &mut bi,
            DIB_RGB_COLORS,
        );

        ReleaseDC(std::ptr::null_mut(), hdc);
        DeleteObject(hbitmap);
        CoUninitialize();

        if scanlines == 0 {
            return Err("GetDIBits failed to extract scanlines".to_string());
        }

        // Convert BGRA to RGBA in place
        for chunk in bgra_buf.chunks_exact_mut(4) {
            let b = chunk[0];
            let r = chunk[2];
            chunk[0] = r;
            chunk[2] = b;
        }

        let rgba_image = match image::RgbaImage::from_raw(actual_width, actual_height, bgra_buf) {
            Some(img) => img,
            None => return Err("Failed to construct image buffer from DIB bytes".to_string()),
        };

        let mut jpeg_bytes = Vec::new();
        let mut cursor = Cursor::new(&mut jpeg_bytes);
        let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut cursor, 82);
        encoder
            .encode_image(&rgba_image)
            .map_err(|e| format!("Failed to encode shell thumbnail: {}", e))?;

        Ok((jpeg_bytes, actual_width, actual_height))
    }
}

#[cfg(not(windows))]
fn generate_shell_thumbnail_bytes(
    path: &Path,
    max_dimension: u32,
) -> Result<(Vec<u8>, u32, u32), String> {
    Err("Shell thumbnailing is only supported on Windows".to_string())
}

/// Retrieves metadata and preview information for a media file
pub fn get_preview_info(path: &Path, cache_dir: &Path) -> Result<MediaPreviewInfo, String> {
    let metadata = fs::metadata(path).map_err(|e| e.to_string())?;
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or_default()
        .to_string();

    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_ascii_lowercase())
        .unwrap_or_default();

    let size_bytes = metadata.len();

    let (media_type, mime_type) = match ext.as_str() {
        "jpg" | "jpeg" => ("image", "image/jpeg"),
        "png" => ("image", "image/png"),
        "webp" => ("image", "image/webp"),
        "bmp" => ("image", "image/bmp"),
        "gif" => ("image", "image/gif"),
        "svg" => ("image", "image/svg+xml"),
        "tiff" | "tif" => ("image", "image/tiff"),
        "mp4" | "m4v" => ("video", "video/mp4"),
        "webm" => ("video", "video/webm"),
        "mkv" => ("video", "video/x-matroska"),
        "mov" => ("video", "video/quicktime"),
        "avi" => ("video", "video/x-msvideo"),
        "wmv" => ("video", "video/x-ms-wmv"),
        "mp3" => ("audio", "audio/mpeg"),
        "wav" => ("audio", "audio/wav"),
        "flac" => ("audio", "audio/flac"),
        "ogg" => ("audio", "audio/ogg"),
        _ => ("other", "application/octet-stream"),
    };

    let mut width = None;
    let mut height = None;

    // For images, read dimensions quickly
    if media_type == "image" && ext != "svg" {
        if let Ok(reader) = image::ImageReader::open(path) {
            if let Ok(reader) = reader.with_guessed_format() {
                if let Ok((w, h)) = reader.into_dimensions() {
                    width = Some(w);
                    height = Some(h);
                }
            }
        }
    }

    // Try getting a preview thumbnail (e.g. 512px)
    let thumbnail_url = get_thumbnail(path, 512, cache_dir)
        .ok()
        .map(|t| t.data_url);

    Ok(MediaPreviewInfo {
        path: path.to_string_lossy().into_owned(),
        file_name,
        size_bytes,
        mime_type: mime_type.to_string(),
        media_type: media_type.to_string(),
        width,
        height,
        duration_secs: None,
        thumbnail_url,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_thumbnail_cache_key_generation() {
        let temp_dir = tempfile::tempdir().unwrap();
        let file_path = temp_dir.path().join("test.jpg");
        fs::write(&file_path, b"dummy data").unwrap();

        let key1 = thumbnail_cache_key(&file_path, 96);
        let key2 = thumbnail_cache_key(&file_path, 96);
        let key3 = thumbnail_cache_key(&file_path, 128);

        assert!(key1.is_some());
        assert_eq!(key1, key2);
        assert_ne!(key1, key3);
    }

    #[test]
    fn test_image_thumbnail_generation() {
        let temp_dir = tempfile::tempdir().unwrap();
        let file_path = temp_dir.path().join("test.png");

        // Create a 100x50 test image
        let img = image::RgbImage::new(100, 50);
        img.save(&file_path).unwrap();

        let cache_dir = temp_dir.path().join("cache");
        let thumb = get_thumbnail(&file_path, 64, &cache_dir).unwrap();

        assert!(thumb.data_url.starts_with("data:image/jpeg;base64,"));
        assert!(thumb.width <= 64);
        assert!(thumb.height <= 64);

        // Second call should hit the cache
        let cached_thumb = get_thumbnail(&file_path, 64, &cache_dir).unwrap();
        assert_eq!(thumb.data_url, cached_thumb.data_url);
    }

    #[test]
    fn test_svg_thumbnail_generation() {
        let temp_dir = tempfile::tempdir().unwrap();
        let file_path = temp_dir.path().join("test.svg");
        fs::write(&file_path, b"<svg><circle r='10'/></svg>").unwrap();

        let cache_dir = temp_dir.path().join("cache");
        let thumb = get_thumbnail(&file_path, 64, &cache_dir).unwrap();
        assert!(thumb.data_url.starts_with("data:image/svg+xml;base64,"));
    }

    #[test]
    fn test_corrupted_and_missing_files_fail_gracefully() {
        let temp_dir = tempfile::tempdir().unwrap();
        let cache_dir = temp_dir.path().join("cache");

        // Non-existent file
        let missing = temp_dir.path().join("non_existent.jpg");
        assert!(get_thumbnail(&missing, 64, &cache_dir).is_err());

        // Corrupted image data
        let corrupted = temp_dir.path().join("corrupted.png");
        fs::write(&corrupted, b"not a real png header or data at all").unwrap();
        assert!(get_thumbnail(&corrupted, 64, &cache_dir).is_err());
    }

    #[test]
    fn test_preview_info_metadata() {
        let temp_dir = tempfile::tempdir().unwrap();
        let file_path = temp_dir.path().join("photo.jpg");

        // Save a test image
        let img = image::RgbImage::new(80, 40);
        img.save(&file_path).unwrap();

        let cache_dir = temp_dir.path().join("cache");
        let info = get_preview_info(&file_path, &cache_dir).unwrap();

        assert_eq!(info.file_name, "photo.jpg");
        assert_eq!(info.media_type, "image");
        assert_eq!(info.mime_type, "image/jpeg");
        assert_eq!(info.width, Some(80));
        assert_eq!(info.height, Some(40));
        assert!(info.thumbnail_url.is_some());
    }
}
