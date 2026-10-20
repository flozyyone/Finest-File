use std::fs;
use std::io::Cursor;
use std::path::Path;
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
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub track_number: Option<u32>,
    pub year: Option<u32>,
    pub genre: Option<String>,
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
        let meta_file = cache_dir.join(format!("{}.meta", key));
        if cached_file.is_file() {
            if let Ok(bytes) = fs::read(&cached_file) {
                if !bytes.is_empty() {
                    let (w, h) = if let Ok(meta_str) = fs::read_to_string(&meta_file) {
                        let parts: Vec<&str> = meta_str.trim().split('x').collect();
                        if parts.len() == 2 {
                            let pw = parts[0].parse::<u32>().unwrap_or(max_dimension);
                            let ph = parts[1].parse::<u32>().unwrap_or(max_dimension);
                            (pw, ph)
                        } else {
                            (max_dimension, max_dimension)
                        }
                    } else {
                        (max_dimension, max_dimension)
                    };

                    let base64_str = BASE64.encode(&bytes);
                    let data_url = format!("data:image/jpeg;base64,{}", base64_str);
                    return Ok(ThumbnailResult {
                        data_url,
                        width: w,
                        height: h,
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
    let is_audio = matches!(
        ext.as_str(),
        "mp3" | "flac" | "m4a" | "aac" | "ogg" | "wav" | "wma" | "aiff" | "alac" | "opus"
    );

    if is_svg {
        return generate_svg_thumbnail(path);
    }

    let (bytes, width, height) = if is_image {
        generate_image_thumbnail_bytes(path, max_dimension)?
    } else if is_video {
        generate_shell_thumbnail_bytes(path, max_dimension)?
    } else if is_audio {
        generate_audio_cover_bytes(path, max_dimension)
            .or_else(|_| generate_shell_thumbnail_bytes(path, max_dimension))?
    } else {
        // Try Windows Shell for other file formats that Windows has shell thumbnailers for
        generate_shell_thumbnail_bytes(path, max_dimension)?
    };

    // 3. Write to disk cache
    if let Some(ref key) = cache_key {
        let _ = fs::create_dir_all(cache_dir);
        let cached_file = cache_dir.join(format!("{}.jpg", key));
        let meta_file = cache_dir.join(format!("{}.meta", key));
        let _ = fs::write(&cached_file, &bytes);
        let _ = fs::write(&meta_file, format!("{}x{}", width, height));
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

/// Extracts embedded album cover art from audio files (MP3, FLAC, M4A, etc.) via lofty
fn generate_audio_cover_bytes(
    path: &Path,
    max_dimension: u32,
) -> Result<(Vec<u8>, u32, u32), String> {
    use lofty::prelude::*;
    use lofty::probe::Probe;

    let probe = Probe::open(path)
        .map_err(|e| format!("Failed to open audio file: {}", e))?
        .read()
        .map_err(|e| format!("Failed to read audio metadata: {}", e))?;

    let tag = probe.primary_tag().or_else(|| probe.first_tag());
    let pic = tag
        .and_then(|t| {
            t.pictures()
                .iter()
                .find(|p| p.pic_type() == lofty::picture::PictureType::CoverFront)
                .or_else(|| t.pictures().first())
        })
        .ok_or_else(|| "No embedded picture in audio tag".to_string())?;

    let pic_bytes = pic.data();
    if pic_bytes.is_empty() {
        return Err("Embedded picture data is empty".to_string());
    }

    let reader = image::ImageReader::new(Cursor::new(pic_bytes))
        .with_guessed_format()
        .map_err(|e| format!("Failed to identify embedded picture format: {}", e))?;

    let img = reader
        .decode()
        .map_err(|e| format!("Failed to decode embedded picture: {}", e))?;

    let (orig_w, orig_h) = (img.width(), img.height());
    if orig_w == 0 || orig_h == 0 {
        return Err("Zero dimension album art".to_string());
    }

    let thumb = img.thumbnail(max_dimension, max_dimension);
    let (tw, th) = (thumb.width(), thumb.height());

    let mut jpeg_bytes = Vec::new();
    let mut cursor = Cursor::new(&mut jpeg_bytes);
    let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut cursor, 85);
    encoder
        .encode_image(&thumb)
        .map_err(|e| format!("Failed to encode album art JPEG: {}", e))?;

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

    // IShellItem GUID: {43826d1e-e718-42ee-bc55-a1e261c37bfe}
    const IID_ISHELLITEM: windows_sys::core::GUID = windows_sys::core::GUID {
        data1: 0x43826d1e,
        data2: 0xe718,
        data3: 0x42ee,
        data4: [0xbc, 0x55, 0xa1, 0xe2, 0x61, 0xc3, 0x7b, 0xfe],
    };

    // BHID_ThumbnailHandler: {7b2e650a-8e20-4f4a-b09e-6597afc72fb0}
    const BHID_THUMBNAIL_HANDLER: windows_sys::core::GUID = windows_sys::core::GUID {
        data1: 0x7b2e650a,
        data2: 0x8e20,
        data3: 0x4f4a,
        data4: [0xb0, 0x9e, 0x65, 0x97, 0xaf, 0xc7, 0x2f, 0xb0],
    };

    // IThumbnailProvider GUID: {e357fccd-a995-4576-b01f-234630154e96}
    const IID_ITHUMBNAILPROVIDER: windows_sys::core::GUID = windows_sys::core::GUID {
        data1: 0xe357fccd,
        data2: 0xa995,
        data3: 0x4576,
        data4: [0xb0, 0x1f, 0x23, 0x46, 0x30, 0x15, 0x4e, 0x96],
    };

    // IShellItemImageFactory GUID: {bcc18b79-ba16-442f-80c4-8a140df4d14c}
    const IID_ISHELLITEMIMAGEFACTORY: windows_sys::core::GUID = windows_sys::core::GUID {
        data1: 0xbcc18b79,
        data2: 0xba16,
        data3: 0x442f,
        data4: [0x80, 0xc4, 0x8a, 0x14, 0x0d, 0xf4, 0xd1, 0x4c],
    };

    // Flags: SIIGBF_RESIZETOFIT = 0x00, SIIGBF_BIGGERSIZEOK = 0x01
    const SIIGBF_RESIZETOFIT: u32 = 0x00;
    const SIIGBF_BIGGERSIZEOK: u32 = 0x01;

    // Normalize forward slashes to standard Windows backslashes
    let path_str = path.to_string_lossy().replace('/', "\\");
    let path_wide: Vec<u16> = std::ffi::OsStr::new(&path_str)
        .encode_wide()
        .chain(Some(0))
        .collect();

    unsafe {
        // Initialize COM for this thread if not already initialized
        let hr_init = CoInitializeEx(
            std::ptr::null_mut(),
            (COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE) as u32,
        );
        let need_uninit = hr_init == S_OK || hr_init == 1; // S_OK or S_FALSE

        // 1. Create IShellItem
        let mut shell_item_ptr: *mut c_void = std::ptr::null_mut();
        let hr: HRESULT = SHCreateItemFromParsingName(
            path_wide.as_ptr(),
            std::ptr::null_mut(),
            &IID_ISHELLITEM,
            &mut shell_item_ptr,
        );

        if hr != S_OK || shell_item_ptr.is_null() {
            if need_uninit {
                CoUninitialize();
            }
            return Err(format!("Shell item could not be created for {:?} (HRESULT 0x{:08x})", path_str, hr));
        }

        // IShellItem vtable:
        // 0: QueryInterface, 1: AddRef, 2: Release, 3: BindToHandler
        type QueryInterfaceFn = unsafe extern "system" fn(
            this: *mut c_void,
            riid: *const windows_sys::core::GUID,
            ppv: *mut *mut c_void,
        ) -> HRESULT;
        type ReleaseFn = unsafe extern "system" fn(this: *mut c_void) -> u32;
        type BindToHandlerFn = unsafe extern "system" fn(
            this: *mut c_void,
            pbc: *mut c_void,
            bhid: *const windows_sys::core::GUID,
            riid: *const windows_sys::core::GUID,
            ppv: *mut *mut c_void,
        ) -> HRESULT;

        let shell_item_vtable = *(shell_item_ptr as *mut *mut usize);
        let query_interface: QueryInterfaceFn = std::mem::transmute(*shell_item_vtable.add(0));
        let shell_item_release: ReleaseFn = std::mem::transmute(*shell_item_vtable.add(2));
        let bind_to_handler: BindToHandlerFn = std::mem::transmute(*shell_item_vtable.add(3));

        let mut hbitmap: HBITMAP = std::ptr::null_mut();

        // Method 1: Try BindToHandler with BHID_ThumbnailHandler (standard for Windows video thumbnails!)
        let mut thumb_provider_ptr: *mut c_void = std::ptr::null_mut();
        let hr_bind = bind_to_handler(
            shell_item_ptr,
            std::ptr::null_mut(),
            &BHID_THUMBNAIL_HANDLER,
            &IID_ITHUMBNAILPROVIDER,
            &mut thumb_provider_ptr,
        );

        if hr_bind == S_OK && !thumb_provider_ptr.is_null() {
            // IThumbnailProvider vtable:
            // 0: QueryInterface, 1: AddRef, 2: Release, 3: GetThumbnail
            type GetThumbnailFn = unsafe extern "system" fn(
                this: *mut c_void,
                cx: u32,
                phbmp: *mut HBITMAP,
                _pdw_alpha: *mut u32,
            ) -> HRESULT;

            let tp_vtable = *(thumb_provider_ptr as *mut *mut usize);
            let get_thumbnail: GetThumbnailFn = std::mem::transmute(*tp_vtable.add(3));
            let tp_release: ReleaseFn = std::mem::transmute(*tp_vtable.add(2));

            let mut alpha_type: u32 = 0;
            let hr_thumb = get_thumbnail(thumb_provider_ptr, max_dimension, &mut hbitmap, &mut alpha_type);
            tp_release(thumb_provider_ptr);

            if hr_thumb != S_OK {
                hbitmap = std::ptr::null_mut();
            }
        }

        // Method 2: If BindToHandler didn't produce an HBITMAP, fallback to IShellItemImageFactory
        if hbitmap.is_null() {
            let mut factory_ptr: *mut c_void = std::ptr::null_mut();
            let hr_qi = query_interface(shell_item_ptr, &IID_ISHELLITEMIMAGEFACTORY, &mut factory_ptr);

            if hr_qi == S_OK && !factory_ptr.is_null() {
                // IShellItemImageFactory vtable:
                // 0: QueryInterface, 1: AddRef, 2: Release, 3: GetImage
                type GetImageFn = unsafe extern "system" fn(
                    this: *mut c_void,
                    size: SIZE,
                    flags: u32,
                    phbm: *mut HBITMAP,
                ) -> HRESULT;

                let vtable = *(factory_ptr as *mut *mut usize);
                let get_image: GetImageFn = std::mem::transmute(*vtable.add(3));
                let release: ReleaseFn = std::mem::transmute(*vtable.add(2));

                let size = SIZE {
                    cx: max_dimension as i32,
                    cy: max_dimension as i32,
                };

                let hr_image = get_image(factory_ptr, size, SIIGBF_BIGGERSIZEOK, &mut hbitmap);
                if hr_image != S_OK || hbitmap.is_null() {
                    let _ = get_image(factory_ptr, size, SIIGBF_RESIZETOFIT, &mut hbitmap);
                }
                release(factory_ptr);
            }
        }

        shell_item_release(shell_item_ptr);

        if hbitmap.is_null() {
            if need_uninit {
                CoUninitialize();
            }
            return Err(format!("Could not extract thumbnail bitmap for {:?}", path_str));
        }

        // Extract DIB bits from HBITMAP
        let hdc = GetDC(std::ptr::null_mut());
        if hdc.is_null() {
            DeleteObject(hbitmap);
            if need_uninit {
                CoUninitialize();
            }
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

        // Probe actual HBITMAP dimensions via GetObjectW
        let mut bmp_obj: windows_sys::Win32::Graphics::Gdi::BITMAP = std::mem::zeroed();
        let _ = windows_sys::Win32::Graphics::Gdi::GetObjectW(
            hbitmap,
            std::mem::size_of::<windows_sys::Win32::Graphics::Gdi::BITMAP>() as i32,
            &mut bmp_obj as *mut _ as *mut c_void,
        );
        let actual_width = bmp_obj.bmWidth.abs() as u32;
        let actual_height = bmp_obj.bmHeight.abs() as u32;

        if actual_width == 0 || actual_height == 0 {
            ReleaseDC(std::ptr::null_mut(), hdc);
            DeleteObject(hbitmap);
            if need_uninit {
                CoUninitialize();
            }
            return Err("Zero dimension shell bitmap".to_string());
        }

        // Set actual dimensions and top-down height
        bi.bmiHeader.biWidth = actual_width as i32;
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
        if need_uninit {
            CoUninitialize();
        }

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
        "m4a" | "aac" => ("audio", "audio/mp4"),
        "flac" => ("audio", "audio/flac"),
        "wav" => ("audio", "audio/wav"),
        "ogg" | "opus" => ("audio", "audio/ogg"),
        "wma" => ("audio", "audio/x-ms-wma"),
        "aiff" | "aif" => ("audio", "audio/aiff"),
        _ => ("other", "application/octet-stream"),
    };

    let mut width = None;
    let mut height = None;
    let mut duration_secs = None;
    let mut title = None;
    let mut artist = None;
    let mut album = None;
    let mut track_number = None;
    let mut year = None;
    let mut genre = None;

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

    // For audio files, extract tags and duration via lofty
    if media_type == "audio" {
        use lofty::prelude::*;
        use lofty::probe::Probe;

        if let Ok(probe) = Probe::open(path).and_then(|p| p.read()) {
            let dur = probe.properties().duration().as_secs_f64();
            if dur > 0.0 {
                duration_secs = Some(dur);
            }
            if let Some(tag) = probe.primary_tag().or_else(|| probe.first_tag()) {
                title = tag.title().as_deref().map(str::to_string);
                artist = tag.artist().as_deref().map(str::to_string);
                album = tag.album().as_deref().map(str::to_string);
                track_number = tag.track();
                year = tag.year();
                genre = tag.genre().as_deref().map(str::to_string);
            }
        }
    }

    // Try getting a preview thumbnail (e.g. 512px)
    let thumb_res = get_thumbnail(path, 512, cache_dir).ok();
    let thumbnail_url = thumb_res.as_ref().map(|t| t.data_url.clone());
    if width.is_none() && height.is_none() {
        if let Some(ref t) = thumb_res {
            if t.width > 0 && t.height > 0 {
                width = Some(t.width);
                height = Some(t.height);
            }
        }
    }

    Ok(MediaPreviewInfo {
        path: path.to_string_lossy().into_owned(),
        file_name,
        size_bytes,
        mime_type: mime_type.to_string(),
        media_type: media_type.to_string(),
        width,
        height,
        duration_secs,
        thumbnail_url,
        title,
        artist,
        album,
        track_number,
        year,
        genre,
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

    #[test]
    fn test_cache_hit_and_timestamp_invalidation() {
        let temp_dir = tempfile::tempdir().unwrap();
        let file_path = temp_dir.path().join("invalidate_test.png");
        let cache_dir = temp_dir.path().join("cache");

        // 1. Initial image 120x60
        let img = image::RgbImage::new(120, 60);
        img.save(&file_path).unwrap();

        let thumb1 = get_thumbnail(&file_path, 64, &cache_dir).unwrap();
        assert_eq!(thumb1.width, 64);
        assert_eq!(thumb1.height, 32);

        // 2. Cache hit returns exact dimensions
        let thumb2 = get_thumbnail(&file_path, 64, &cache_dir).unwrap();
        assert_eq!(thumb1.data_url, thumb2.data_url);
        assert_eq!(thumb2.width, 64);
        assert_eq!(thumb2.height, 32);

        // 3. Modifying file content and mtime updates cache key
        let img2 = image::RgbImage::new(60, 120);
        img2.save(&file_path).unwrap();
        let thumb3 = get_thumbnail(&file_path, 64, &cache_dir).unwrap();
        assert_eq!(thumb3.width, 32);
        assert_eq!(thumb3.height, 64);
    }

    #[test]
    fn test_real_video_thumbnail_and_preview() {
        let folders = crate::platform::known_folders();
        let video_dir = folders.iter().find(|f| f.id == "videos").map(|f| std::path::PathBuf::from(&f.path));
        if let Some(dir) = video_dir {
            if let Ok(entries) = fs::read_dir(dir) {
                let temp_dir = tempfile::tempdir().unwrap();
                let cache_dir = temp_dir.path().join("cache");
                for entry in entries.flatten() {
                    let path = entry.path();
                    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or_default().to_lowercase();
                    if ext == "mp4" || ext == "mkv" {
                        let result = get_thumbnail(&path, 256, &cache_dir);
                        if let Ok(thumb) = result {
                            assert!(thumb.data_url.starts_with("data:image/jpeg;base64,"));
                            assert!(thumb.width > 0 && thumb.height > 0);
                            let preview = get_preview_info(&path, &cache_dir).unwrap();
                            assert_eq!(preview.media_type, "video");
                            break;
                        }
                    }
                }
            }
        }

        // 4. Corrupted video handling
        let temp_dir = tempfile::tempdir().unwrap();
        let cache_dir = temp_dir.path().join("cache");
        let fake_video = temp_dir.path().join("broken.mp4");
        fs::write(&fake_video, b"not a real mp4 video").unwrap();
        let bad_result = get_thumbnail(&fake_video, 256, &cache_dir);
        assert!(bad_result.is_err(), "Corrupted video must return Err instead of panicking");
    }

    #[test]
    fn test_real_audio_metadata_and_album_art() {
        let folders = crate::platform::known_folders();
        let music_dir = folders.iter().find(|f| f.id == "music").map(|f| std::path::PathBuf::from(&f.path));
        if let Some(dir) = music_dir {
            let temp_dir = tempfile::tempdir().unwrap();
            let cache_dir = temp_dir.path().join("cache");

            if let Ok(entries) = fs::read_dir(dir) {
                let mut tested_count = 0;
                for entry in entries.flatten() {
                    let path = entry.path();
                    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or_default().to_lowercase();
                    if ext == "mp3" || ext == "flac" || ext == "m4a" {
                        let info = get_preview_info(&path, &cache_dir);
                        assert!(info.is_ok(), "Failed to get audio preview for {:?}", path);
                        let preview = info.unwrap();
                        assert_eq!(preview.media_type, "audio");
                        assert!(preview.duration_secs.is_some() || preview.title.is_some() || preview.size_bytes > 0);

                        println!(
                            "Tested audio: {:?} -> title: {:?}, artist: {:?}, album: {:?}, duration: {:?}s, has_cover: {}",
                            path.file_name(),
                            preview.title,
                            preview.artist,
                            preview.album,
                            preview.duration_secs,
                            preview.thumbnail_url.is_some()
                        );

                        tested_count += 1;
                        if tested_count >= 5 {
                            break;
                        }
                }
            }
        }
    }
    }
}
