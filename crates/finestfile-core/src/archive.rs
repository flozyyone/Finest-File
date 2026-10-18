//! ZIP archive creation, listing and safe extraction.
//!
//! Supported: ZIP (stored and Deflate). Other formats are detected by their
//! signature and reported as unsupported rather than guessed at.

use crate::error::{ErrorCode, FsError, FsResult};
use crate::jobs::JobCtx;
use crate::listing::display_name;
use crate::names::{exists_no_follow, unique_path, validate_name};
use crate::platform::move_no_replace;
use crate::transfer::ConflictPolicy;
use serde::Serialize;
use std::fs::{self, File};
use std::io::{self, Read, Write};
use std::path::{Component, Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ArchiveFormat {
    Zip,
    SevenZip,
    Rar,
    Gzip,
    Tar,
    Unknown,
}

impl ArchiveFormat {
    pub fn is_supported(self) -> bool {
        self == ArchiveFormat::Zip
    }
    pub fn label(self) -> &'static str {
        match self {
            ArchiveFormat::Zip => "ZIP",
            ArchiveFormat::SevenZip => "7z",
            ArchiveFormat::Rar => "RAR",
            ArchiveFormat::Gzip => "gzip",
            ArchiveFormat::Tar => "tar",
            ArchiveFormat::Unknown => "unknown",
        }
    }
}

/// Detects the archive format from the file signature (never by extension alone).
pub fn detect_format(path: &Path) -> FsResult<ArchiveFormat> {
    let mut f = File::open(path).map_err(|e| FsError::io(e, path))?;
    let mut head = [0u8; 512];
    let n = read_up_to(&mut f, &mut head).map_err(|e| FsError::io(e, path))?;
    let h = &head[..n];
    Ok(if h.starts_with(b"PK\x03\x04") || h.starts_with(b"PK\x05\x06") || h.starts_with(b"PK\x07\x08") {
        ArchiveFormat::Zip
    } else if h.starts_with(&[0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C]) {
        ArchiveFormat::SevenZip
    } else if h.starts_with(b"Rar!\x1A\x07") {
        ArchiveFormat::Rar
    } else if h.starts_with(&[0x1F, 0x8B]) {
        ArchiveFormat::Gzip
    } else if n >= 262 && &h[257..262] == b"ustar" {
        ArchiveFormat::Tar
    } else {
        ArchiveFormat::Unknown
    })
}

fn read_up_to(r: &mut impl Read, buf: &mut [u8]) -> io::Result<usize> {
    let mut total = 0;
    while total < buf.len() {
        match r.read(&mut buf[total..])? {
            0 => break,
            n => total += n,
        }
    }
    Ok(total)
}

fn require_zip(path: &Path) -> FsResult<()> {
    let f = detect_format(path)?;
    if f.is_supported() {
        Ok(())
    } else {
        Err(FsError::new(
            ErrorCode::UnsupportedFormat,
            match f {
                ArchiveFormat::Unknown => format!("\"{}\" is not a recognised archive.", display_name(path)),
                other => format!("{} archives are not supported yet. FinestFile currently supports ZIP.", other.label()),
            },
        )
        .with_path(path))
    }
}

fn zip_err(e: zip::result::ZipError, path: &Path) -> FsError {
    match e {
        zip::result::ZipError::Io(io) => FsError::io(io, path),
        zip::result::ZipError::UnsupportedArchive(m) => {
            FsError::new(ErrorCode::UnsupportedFormat, format!("Unsupported archive feature: {m}")).with_path(path)
        }
        other => FsError::new(ErrorCode::ArchiveCorrupt, format!("The archive is damaged or invalid: {other}")).with_path(path),
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveEntry {
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
    pub compressed_size: u64,
    pub encrypted: bool,
    /// True if extracting this entry would escape the destination folder or
    /// use a name Windows cannot represent safely.
    pub unsafe_path: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveListing {
    pub format: ArchiveFormat,
    pub entries: Vec<ArchiveEntry>,
    pub total_size: u64,
    pub truncated: bool,
}

pub const MAX_LIST_ENTRIES: usize = 20_000;
/// Hard limits that guard against decompression bombs.
pub const MAX_ENTRIES: usize = 1_000_000;
pub const MAX_TOTAL_UNCOMPRESSED: u64 = 1 << 40; // 1 TiB
pub const MAX_RATIO: u64 = 1000;

pub fn list_zip(path: &Path) -> FsResult<ArchiveListing> {
    require_zip(path)?;
    let f = File::open(path).map_err(|e| FsError::io(e, path))?;
    let mut z = zip::ZipArchive::new(f).map_err(|e| zip_err(e, path))?;
    let mut entries = Vec::new();
    let mut total = 0u64;
    for i in 0..z.len() {
        let e = z.by_index_raw(i).map_err(|e| zip_err(e, path))?;
        total = total.saturating_add(e.size());
        let entry_name = e.name().map(|n| n.to_string()).unwrap_or_else(|_| String::from_utf8_lossy(e.name_raw()).into_owned());
        if entries.len() < MAX_LIST_ENTRIES {
            entries.push(ArchiveEntry {
                unsafe_path: safe_relative_path(&entry_name).is_none(),
                name: entry_name,
                is_dir: e.is_dir(),
                size: e.size(),
                compressed_size: e.compressed_size(),
                encrypted: e.encrypted(),
            });
        }
    }
    Ok(ArchiveListing { format: ArchiveFormat::Zip, truncated: z.len() > entries.len(), entries, total_size: total })
}

/// Converts an archive entry name into a safe relative path, or `None` if the
/// name is absolute, contains `..`, a drive/ADS colon, a reserved device name,
/// or any component Windows would silently alter.
pub fn safe_relative_path(name: &str) -> Option<PathBuf> {
    let normalized = name.replace('\\', "/");
    if normalized.starts_with('/') || normalized.contains('\0') {
        return None;
    }
    let mut out = PathBuf::new();
    for part in normalized.split('/') {
        if part.is_empty() || part == "." {
            continue;
        }
        if part == ".." {
            return None;
        }
        validate_name(part).ok()?;
        out.push(part);
    }
    // Double-check with the path parser (catches prefixes such as "C:").
    if out.components().any(|c| !matches!(c, Component::Normal(_))) || out.as_os_str().is_empty() {
        return None;
    }
    Some(out)
}

/// Extracts a ZIP into `dest_dir` (which is created if needed).
///
/// The whole archive is validated first. If *any* entry has an unsafe path,
/// is encrypted, or limits are exceeded, nothing is extracted.
pub fn extract_zip(archive: &Path, dest_dir: &Path, policy: ConflictPolicy, ctx: &JobCtx) -> FsResult<()> {
    require_zip(archive)?;
    let f = File::open(archive).map_err(|e| FsError::io(e, archive))?;
    let mut z = zip::ZipArchive::new(f).map_err(|e| zip_err(e, archive))?;
    if z.len() > MAX_ENTRIES {
        return Err(FsError::new(ErrorCode::LimitExceeded, "The archive contains too many entries.").with_path(archive));
    }

    // Validation pass.
    let mut plan = Vec::with_capacity(z.len());
    let mut total = 0u64;
    let archive_len = fs::metadata(archive).map(|m| m.len()).unwrap_or(0).max(1);
    for i in 0..z.len() {
        ctx.check()?;
        let e = z.by_index_raw(i).map_err(|err| zip_err(err, archive))?;
        let entry_name = e.name().map(|n| n.to_string()).unwrap_or_else(|_| String::from_utf8_lossy(e.name_raw()).into_owned());
        let Some(rel) = safe_relative_path(&entry_name) else {
            return Err(FsError::new(
                ErrorCode::UnsafeArchivePath,
                format!("Extraction was blocked: the entry \"{}\" would be written outside the destination or has an invalid name.", entry_name),
            )
            .with_path(archive));
        };
        if e.encrypted() {
            return Err(FsError::new(ErrorCode::UnsupportedFormat, "Password-protected ZIP archives are not supported yet.").with_path(archive));
        }
        let is_link = e.unix_mode().is_some_and(|m| m & 0o170000 == 0o120000);
        total = total.saturating_add(e.size());
        plan.push((i, rel, e.is_dir(), is_link, e.size()));
    }
    if total > MAX_TOTAL_UNCOMPRESSED || total / archive_len > MAX_RATIO && total > (1 << 30) {
        return Err(FsError::new(
            ErrorCode::LimitExceeded,
            "Extraction was blocked: the archive expands to an unusually large size (possible decompression bomb).",
        )
        .with_path(archive));
    }
    ctx.set_totals(total, plan.len() as u64);

    fs::create_dir_all(dest_dir).map_err(|e| FsError::io(e, dest_dir))?;
    ctx.affect_dir(dest_dir.parent().unwrap_or(dest_dir));
    ctx.affect_dir(dest_dir);

    let mut buf = vec![0u8; 256 * 1024];
    for (i, rel, is_dir, is_link, declared) in plan {
        ctx.check()?;
        let mut out_path = dest_dir.join(&rel);
        if is_dir {
            fs::create_dir_all(&out_path).map_err(|e| FsError::io(e, &out_path))?;
            ctx.item_done();
            continue;
        }
        if is_link {
            ctx.warn(format!("Skipped symbolic link entry \"{}\".", rel.display()));
            ctx.add_bytes(declared);
            ctx.item_done();
            continue;
        }
        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent).map_err(|e| FsError::io(e, parent))?;
        }
        if exists_no_follow(&out_path) {
            match policy {
                ConflictPolicy::Skip => {
                    ctx.warn(format!("Skipped \"{}\" (already exists).", rel.display()));
                    ctx.add_bytes(declared);
                    ctx.item_done();
                    continue;
                }
                ConflictPolicy::KeepBoth => {
                    out_path = unique_path(out_path.parent().unwrap(), &display_name(&out_path));
                }
                ConflictPolicy::Replace => {}
            }
        }
        ctx.set_current(rel.to_string_lossy().into_owned());
        let parent = out_path.parent().unwrap().to_path_buf();
        let tmp = unique_path(&parent, &format!("{}.ffpart", display_name(&out_path)));
        let r = (|| {
            let mut entry = z.by_index(i).map_err(|e| zip_err(e, archive))?;
            let mut out = fs::OpenOptions::new().write(true).create_new(true).open(&tmp).map_err(|e| FsError::io(e, &tmp))?;
            let mut written = 0u64;
            loop {
                ctx.check()?;
                let n = entry.read(&mut buf).map_err(|e| match e.kind() {
                    io::ErrorKind::InvalidData => FsError::new(
                        ErrorCode::ArchiveCorrupt,
                        format!("\"{}\" is damaged (checksum mismatch).", rel.display()),
                    )
                    .with_path(archive),
                    _ => FsError::io(e, archive),
                })?;
                if n == 0 {
                    break;
                }
                written += n as u64;
                if written > declared {
                    return Err(FsError::new(ErrorCode::ArchiveCorrupt, "An entry is larger than declared.").with_path(archive));
                }
                out.write_all(&buf[..n]).map_err(|e| FsError::io(e, &tmp))?;
                ctx.add_bytes(n as u64);
            }
            if let Some(dt) = entry.last_modified() {
                if let Some(t) = zip_time_to_system(dt) {
                    let _ = out.set_modified(t);
                }
            }
            drop(out);
            if exists_no_follow(&out_path) {
                crate::ops::delete_permanently(&out_path)?;
            }
            move_no_replace(&tmp, &out_path)
        })();
        if r.is_err() {
            let _ = fs::remove_file(&tmp);
        }
        r?;
        ctx.item_done();
    }
    Ok(())
}

/// Default extraction folder: next to the archive, named after it, made unique.
pub fn default_extract_dir(archive: &Path) -> PathBuf {
    let parent = archive.parent().unwrap_or(Path::new("."));
    let stem = archive.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_else(|| "Extracted".into());
    unique_path(parent, &stem)
}

/// Creates a ZIP archive at `dest` (must not exist) from `sources`.
/// Written to a temporary file first and renamed on success.
pub fn create_zip(sources: &[PathBuf], dest: &Path, ctx: &JobCtx) -> FsResult<()> {
    if exists_no_follow(dest) {
        return Err(FsError::new(ErrorCode::AlreadyExists, format!("\"{}\" already exists.", display_name(dest))).with_path(dest));
    }
    // Plan entries.
    let mut items: Vec<(PathBuf, String, bool, u64)> = Vec::new(); // (fs path, zip name, is_dir, len)
    let mut total = 0u64;
    for src in sources {
        let base = display_name(src);
        collect(src, &base, &mut items, &mut total, ctx)?;
    }
    ctx.set_totals(total, items.len() as u64);
    let parent = dest.parent().unwrap_or(Path::new("."));
    ctx.affect_dir(parent);
    let tmp = unique_path(parent, &format!("{}.ffpart", display_name(dest)));
    let r = (|| {
        let file = fs::OpenOptions::new().write(true).create_new(true).open(&tmp).map_err(|e| FsError::io(e, &tmp))?;
        let mut w = zip::ZipWriter::new(io::BufWriter::with_capacity(256 * 1024, file));
        let mut buf = vec![0u8; 256 * 1024];
        for (path, name, is_dir, len) in &items {
            ctx.check()?;
            let mut opts = zip::write::SimpleFileOptions::default()
                .compression_method(zip::CompressionMethod::Deflated)
                .large_file(*len >= 0xFFFF_FFFF);
            if let Some(dt) = fs::metadata(path).ok().and_then(|m| m.modified().ok()).and_then(system_time_to_zip) {
                opts = opts.last_modified_time(dt);
            }
            if *is_dir {
                w.add_directory(name.as_str(), opts).map_err(|e| zip_err(e, dest))?;
                ctx.item_done();
                continue;
            }
            ctx.set_current(name.clone());
            w.start_file(name.as_str(), opts).map_err(|e| zip_err(e, dest))?;
            let mut f = File::open(path).map_err(|e| FsError::io(e, path))?;
            loop {
                ctx.check()?;
                let n = f.read(&mut buf).map_err(|e| FsError::io(e, path))?;
                if n == 0 {
                    break;
                }
                w.write_all(&buf[..n]).map_err(|e| FsError::io(e, &tmp))?;
                ctx.add_bytes(n as u64);
            }
            ctx.item_done();
        }
        let inner = w.finish().map_err(|e| zip_err(e, dest))?;
        inner.into_inner().map_err(|e| FsError::io(e.into_error(), &tmp))?.sync_all().map_err(|e| FsError::io(e, &tmp))?;
        move_no_replace(&tmp, dest)
    })();
    if r.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    r
}

fn collect(path: &Path, name: &str, items: &mut Vec<(PathBuf, String, bool, u64)>, total: &mut u64, ctx: &JobCtx) -> FsResult<()> {
    ctx.check()?;
    let md = fs::symlink_metadata(path).map_err(|e| FsError::io(e, path))?;
    if md.file_type().is_symlink() {
        ctx.warn(format!("Skipped link \"{}\".", path.display()));
        return Ok(());
    }
    if md.is_file() {
        items.push((path.to_path_buf(), name.to_string(), false, md.len()));
        *total += md.len();
        return Ok(());
    }
    items.push((path.to_path_buf(), format!("{name}/"), true, 0));
    let mut children: Vec<_> = fs::read_dir(path).map_err(|e| FsError::io(e, path))?.flatten().collect();
    children.sort_by_key(|e| e.file_name());
    for c in children {
        let child_name = format!("{name}/{}", c.file_name().to_string_lossy());
        collect(&c.path(), &child_name, items, total, ctx)?;
    }
    Ok(())
}

/// Suggested archive path for a selection: "<name>.zip" or "Archive.zip", made unique.
pub fn default_archive_path(sources: &[PathBuf]) -> Option<PathBuf> {
    let first = sources.first()?;
    let parent = first.parent()?;
    let base = if sources.len() == 1 {
        let n = display_name(first);
        let md = fs::symlink_metadata(first).ok();
        if md.is_some_and(|m| m.is_file()) {
            crate::names::split_name(&n).0.to_string()
        } else {
            n
        }
    } else {
        parent.file_name().map(|s| s.to_string_lossy().into_owned()).unwrap_or_else(|| "Archive".into())
    };
    Some(unique_path(parent, &format!("{base}.zip")))
}

// --- ZIP timestamps (DOS date/time, interpreted as UTC here). ---

fn system_time_to_zip(t: std::time::SystemTime) -> Option<zip::DateTime> {
    let secs = t.duration_since(std::time::UNIX_EPOCH).ok()?.as_secs() as i64;
    let (y, m, d) = civil_from_days(secs.div_euclid(86_400));
    let rem = secs.rem_euclid(86_400);
    zip::DateTime::from_date_and_time(y as u16, m as u8, d as u8, (rem / 3600) as u8, ((rem % 3600) / 60) as u8, (rem % 60) as u8).ok()
}

fn zip_time_to_system(dt: zip::DateTime) -> Option<std::time::SystemTime> {
    let days = days_from_civil(dt.year() as i64, dt.month() as i64, dt.day() as i64);
    let secs = days * 86_400 + dt.hour() as i64 * 3600 + dt.minute() as i64 * 60 + dt.second() as i64;
    (secs >= 0).then(|| std::time::UNIX_EPOCH + std::time::Duration::from_secs(secs as u64))
}

// Howard Hinnant's civil-date algorithms (public domain).
fn civil_from_days(z: i64) -> (i64, i64, i64) {
    let z = z + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    (if m <= 2 { y + 1 } else { y }, m, d)
}

fn days_from_civil(y: i64, m: i64, d: i64) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = y.div_euclid(400);
    let yoe = y - era * 400;
    let mp = if m > 2 { m - 3 } else { m + 9 };
    let doy = (153 * mp + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::jobs::{tests::NullSink, JobKind, JobManager, JobState};
    use std::sync::Arc;
    use std::time::Duration;

    fn mgr() -> JobManager {
        JobManager::new(1, Arc::new(NullSink))
    }

    #[test]
    fn rejects_unsafe_names() {
        for bad in ["../evil.txt", "a/../../evil", "/abs.txt", "C:/x.txt", "C:x.txt", "a/b:ads", "con/x", "a/nul.txt", "dir/x.", "\\\\server\\share\\x"] {
            assert!(safe_relative_path(bad).is_none(), "{bad:?} must be rejected");
        }
        assert_eq!(safe_relative_path("a/b/c.txt").unwrap(), PathBuf::from("a").join("b").join("c.txt"));
        assert_eq!(safe_relative_path("./x/./y").unwrap(), PathBuf::from("x").join("y"));
        assert_eq!(safe_relative_path("dir\\file.txt").unwrap(), PathBuf::from("dir").join("file.txt"));
    }

    #[test]
    fn roundtrip_create_list_extract() {
        let t = tempfile::tempdir().unwrap();
        let src = t.path().join("Proje ü");
        fs::create_dir_all(src.join("inner/empty")).unwrap();
        fs::write(src.join("a.txt"), "hello").unwrap();
        fs::write(src.join("inner/b.bin"), vec![3u8; 500_000]).unwrap();
        let zip_path = t.path().join("out.zip");
        let m = mgr();
        let (s, d) = (vec![src.clone()], zip_path.clone());
        let id = m.submit(JobKind::CreateArchive, "zip", move |ctx| create_zip(&s, &d, ctx));
        let p = m.wait(id, Duration::from_secs(30)).unwrap();
        assert_eq!(p.state, JobState::Completed, "{:?}", p.error);
        assert_eq!(detect_format(&zip_path).unwrap(), ArchiveFormat::Zip);

        let l = list_zip(&zip_path).unwrap();
        assert!(l.entries.iter().any(|e| e.name == "Proje ü/inner/b.bin" && e.size == 500_000));
        assert!(l.entries.iter().any(|e| e.name == "Proje ü/inner/empty/" && e.is_dir));
        assert!(!l.entries.iter().any(|e| e.unsafe_path));

        let out = default_extract_dir(&zip_path);
        assert!(out.ends_with("out"));
        let (a, o) = (zip_path.clone(), out.clone());
        let id = m.submit(JobKind::ExtractArchive, "x", move |ctx| extract_zip(&a, &o, ConflictPolicy::Skip, ctx));
        let p = m.wait(id, Duration::from_secs(30)).unwrap();
        assert_eq!(p.state, JobState::Completed, "{:?}", p.error);
        assert_eq!(fs::read_to_string(out.join("Proje ü/a.txt")).unwrap(), "hello");
        assert_eq!(fs::read(out.join("Proje ü/inner/b.bin")).unwrap().len(), 500_000);
        assert!(out.join("Proje ü/inner/empty").is_dir());

        // Second extraction with KeepBoth produces renamed files, not overwrites.
        let (a, o) = (zip_path.clone(), out.clone());
        let id = m.submit(JobKind::ExtractArchive, "x", move |ctx| extract_zip(&a, &o, ConflictPolicy::KeepBoth, ctx));
        assert_eq!(m.wait(id, Duration::from_secs(30)).unwrap().state, JobState::Completed);
        assert!(out.join("Proje ü/a (2).txt").exists());

        // Creating over an existing archive is refused.
        let (s, d) = (vec![src.clone()], zip_path.clone());
        let id = m.submit(JobKind::CreateArchive, "zip", move |ctx| create_zip(&s, &d, ctx));
        assert_eq!(m.wait(id, Duration::from_secs(30)).unwrap().error.unwrap().code, ErrorCode::AlreadyExists);
    }

    #[test]
    fn blocks_zip_slip() {
        let t = tempfile::tempdir().unwrap();
        let zip_path = t.path().join("evil.zip");
        {
            let mut w = zip::ZipWriter::new(File::create(&zip_path).unwrap());
            let o = zip::write::SimpleFileOptions::default();
            w.start_file("good.txt", o).unwrap();
            w.write_all(b"ok").unwrap();
            w.start_file("../../escaped.txt", o).unwrap();
            w.write_all(b"pwned").unwrap();
            w.finish().unwrap();
        }
        let l = list_zip(&zip_path).unwrap();
        assert!(l.entries.iter().any(|e| e.unsafe_path));
        let out = t.path().join("deep/out");
        let m = mgr();
        let (a, o) = (zip_path.clone(), out.clone());
        let id = m.submit(JobKind::ExtractArchive, "x", move |ctx| extract_zip(&a, &o, ConflictPolicy::Skip, ctx));
        let p = m.wait(id, Duration::from_secs(30)).unwrap();
        assert_eq!(p.state, JobState::Failed);
        assert_eq!(p.error.unwrap().code, ErrorCode::UnsafeArchivePath);
        assert!(!t.path().join("escaped.txt").exists());
        assert!(!out.join("good.txt").exists(), "nothing is extracted when any entry is unsafe");
    }

    #[test]
    fn detects_unsupported_formats() {
        let t = tempfile::tempdir().unwrap();
        let p = t.path().join("x.7z");
        fs::write(&p, [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C, 0, 4]).unwrap();
        assert_eq!(detect_format(&p).unwrap(), ArchiveFormat::SevenZip);
        assert_eq!(list_zip(&p).unwrap_err().code, ErrorCode::UnsupportedFormat);
        let q = t.path().join("fake.zip");
        fs::write(&q, b"not a zip at all").unwrap();
        assert_eq!(list_zip(&q).unwrap_err().code, ErrorCode::UnsupportedFormat);
        let c = t.path().join("corrupt.zip");
        fs::write(&c, b"PK\x03\x04garbage").unwrap();
        assert_eq!(list_zip(&c).unwrap_err().code, ErrorCode::ArchiveCorrupt);
    }

    #[test]
    fn civil_roundtrip() {
        for days in [-1000i64, 0, 10_957, 19_000, 25_000] {
            let (y, m, d) = civil_from_days(days);
            assert_eq!(days_from_civil(y, m, d), days);
        }
        assert_eq!(civil_from_days(0), (1970, 1, 1));
    }
}
