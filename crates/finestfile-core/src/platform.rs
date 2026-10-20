//! Platform integration: drives, known folders, shell open/properties and
//! atomic no-replace moves. All Windows calls use documented Win32 APIs with
//! paths passed as separate wide-string arguments; no command lines are built.

use crate::error::FsResult;
use serde::Serialize;
use std::path::Path;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DriveInfo {
    /// Root path, e.g. `C:\`.
    pub path: String,
    pub letter: String,
    pub label: String,
    pub kind: DriveKind,
    pub file_system: String,
    pub total_bytes: Option<u64>,
    pub free_bytes: Option<u64>,
    /// False for empty card readers / optical drives or disconnected network drives.
    pub ready: bool,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DriveKind {
    Fixed,
    Removable,
    Network,
    Optical,
    RamDisk,
    Unknown,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnownFolder {
    pub id: &'static str,
    pub name: &'static str,
    pub path: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileAttributesUpdate {
    pub path: String,
    pub readonly: Option<bool>,
    pub hidden: Option<bool>,
    pub system: Option<bool>,
    pub archive: Option<bool>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileTimesUpdate {
    pub path: String,
    pub created_ms: Option<i64>,
    pub modified_ms: Option<i64>,
    pub accessed_ms: Option<i64>,
}

#[cfg(windows)]
mod win {
    use super::*;
    use crate::error::{ErrorCode, FsError};
    use std::ffi::OsString;
    use std::os::windows::ffi::{OsStrExt, OsStringExt};
    use std::ptr::{null, null_mut};
    use windows_sys::core::GUID;
    use windows_sys::Win32::Storage::FileSystem::{
        GetDiskFreeSpaceExW, GetDriveTypeW, GetLogicalDrives, GetVolumeInformationW, MoveFileExW,
    };
    use windows_sys::Win32::System::Com::CoTaskMemFree;
    use windows_sys::Win32::UI::Shell::{
        FOLDERID_Desktop, FOLDERID_Documents, FOLDERID_Downloads, FOLDERID_Music, FOLDERID_Pictures,
        FOLDERID_Profile, FOLDERID_Videos, SHGetKnownFolderPath, ShellExecuteExW, SHELLEXECUTEINFOW,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

    pub(crate) fn wide(s: &std::ffi::OsStr) -> Vec<u16> {
        s.encode_wide().chain(std::iter::once(0)).collect()
    }

    fn wstr(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    fn from_wide_buf(buf: &[u16]) -> String {
        let len = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
        OsString::from_wide(&buf[..len]).to_string_lossy().into_owned()
    }

    pub fn move_no_replace(src: &Path, dst: &Path) -> FsResult<()> {
        // Flags = 0: never replace an existing destination, never fall back to copying.
        let s = wide(maybe_verbatim(src).as_os_str());
        let d = wide(maybe_verbatim(dst).as_os_str());
        let ok = unsafe { MoveFileExW(s.as_ptr(), d.as_ptr(), 0) };
        if ok == 0 {
            return Err(FsError::io(std::io::Error::last_os_error(), dst));
        }
        Ok(())
    }

    /// Adds the `\\?\` prefix for long absolute paths so raw Win32 calls are not
    /// limited to MAX_PATH (std does this internally for its own calls).
    fn maybe_verbatim(p: &Path) -> std::path::PathBuf {
        let s = p.as_os_str().to_string_lossy();
        if s.len() < 248 || s.starts_with(r"\\?\") {
            return p.to_path_buf();
        }
        if let Some(rest) = s.strip_prefix(r"\\") {
            return std::path::PathBuf::from(format!(r"\\?\UNC\{rest}"));
        }
        std::path::PathBuf::from(format!(r"\\?\{s}"))
    }

    pub fn drives() -> Vec<DriveInfo> {
        let mask = unsafe { GetLogicalDrives() };
        let mut out = Vec::new();
        for i in 0..26u32 {
            if mask & (1 << i) == 0 {
                continue;
            }
            let letter = char::from(b'A' + i as u8);
            let root = format!("{letter}:\\");
            let root_w = wstr(&root);
            let kind = match unsafe { GetDriveTypeW(root_w.as_ptr()) } {
                2 => DriveKind::Removable,
                3 => DriveKind::Fixed,
                4 => DriveKind::Network,
                5 => DriveKind::Optical,
                6 => DriveKind::RamDisk,
                _ => DriveKind::Unknown,
            };
            let (mut free, mut total) = (0u64, 0u64);
            let ready = unsafe { GetDiskFreeSpaceExW(root_w.as_ptr(), &mut free, &mut total, null_mut()) } != 0;
            let mut label = [0u16; 261];
            let mut fs = [0u16; 261];
            let has_info = ready
                && unsafe {
                    GetVolumeInformationW(
                        root_w.as_ptr(),
                        label.as_mut_ptr(),
                        label.len() as u32,
                        null_mut(),
                        null_mut(),
                        null_mut(),
                        fs.as_mut_ptr(),
                        fs.len() as u32,
                    )
                } != 0;
            out.push(DriveInfo {
                path: root,
                letter: letter.to_string(),
                label: if has_info { from_wide_buf(&label) } else { String::new() },
                kind,
                file_system: if has_info { from_wide_buf(&fs) } else { String::new() },
                total_bytes: ready.then_some(total),
                free_bytes: ready.then_some(free),
                ready,
            });
        }
        out
    }

    fn known_folder_path(id: &GUID) -> Option<String> {
        let mut p: windows_sys::core::PWSTR = null_mut();
        let hr = unsafe { SHGetKnownFolderPath(id, 0, null_mut(), &mut p) };
        let result = if hr >= 0 && !p.is_null() {
            let len = (0..).take_while(|&i| unsafe { *p.add(i) } != 0).count();
            let slice = unsafe { std::slice::from_raw_parts(p, len) };
            Some(OsString::from_wide(slice).to_string_lossy().into_owned())
        } else {
            None
        };
        if !p.is_null() {
            unsafe { CoTaskMemFree(p as *const _) };
        }
        result
    }

    pub fn known_folders() -> Vec<KnownFolder> {
        let table: [(&'static str, &'static str, &GUID); 7] = [
            ("home", "Home", &FOLDERID_Profile),
            ("desktop", "Desktop", &FOLDERID_Desktop),
            ("documents", "Documents", &FOLDERID_Documents),
            ("downloads", "Downloads", &FOLDERID_Downloads),
            ("pictures", "Pictures", &FOLDERID_Pictures),
            ("videos", "Videos", &FOLDERID_Videos),
            ("music", "Music", &FOLDERID_Music),
        ];
        table
            .iter()
            .filter_map(|(id, name, guid)| known_folder_path(guid).map(|path| KnownFolder { id, name, path }))
            .collect()
    }

    fn shell_execute(verb: &str, path: &Path, invoke_idlist: bool) -> FsResult<()> {
        let verb_w = wstr(verb);
        let file_w = wide(path.as_os_str());
        let mut info: SHELLEXECUTEINFOW = unsafe { std::mem::zeroed() };
        info.cbSize = std::mem::size_of::<SHELLEXECUTEINFOW>() as u32;
        // SEE_MASK_INVOKEIDLIST (0xC) lets verbs such as "properties" resolve via the shell namespace.
        // SEE_MASK_NOASYNC (0x100) because we may be on a short-lived worker thread.
        info.fMask = 0x100 | if invoke_idlist { 0xC } else { 0 };
        info.lpVerb = verb_w.as_ptr();
        info.lpFile = file_w.as_ptr();
        info.lpParameters = null();
        info.nShow = SW_SHOWNORMAL;
        let ok = unsafe { ShellExecuteExW(&mut info) };
        if ok == 0 {
            let err = std::io::Error::last_os_error();
            // ERROR_CANCELLED (1223): the user dismissed an "Open with" prompt.
            if err.raw_os_error() == Some(1223) {
                return Ok(());
            }
            return Err(FsError::new(ErrorCode::Io, format!("Windows could not open \"{}\": {err}", path.display())).with_path(path));
        }
        Ok(())
    }

    pub fn open_default(path: &Path) -> FsResult<()> {
        if std::fs::symlink_metadata(path).is_err() {
            return Err(FsError::new(ErrorCode::NotFound, format!("\"{}\" no longer exists.", path.display())).with_path(path));
        }
        shell_execute("open", path, false)
    }

    pub fn open_with(path: &Path) -> FsResult<()> {
        shell_execute("openas", path, true)
    }

    pub fn show_properties(path: &Path) -> FsResult<()> {
        // The shell creates the property sheet on its own thread; it needs COM
        // initialised as STA on the calling thread. SEE_MASK_NOASYNC makes the
        // call complete before this short-lived worker exits. The sheet then
        // lives as long as the FinestFile process does.
        let p = path.to_path_buf();
        let handle = std::thread::spawn(move || {
            use windows_sys::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED};
            unsafe { CoInitializeEx(null(), COINIT_APARTMENTTHREADED as u32) };
            let r = shell_execute("properties", &p, true);
            unsafe { CoUninitialize() };
            r
        });
        handle.join().unwrap_or_else(|_| Err(FsError::new(ErrorCode::Io, "Properties dialog failed.")))
    }

    pub fn set_file_attributes(update: &FileAttributesUpdate) -> FsResult<()> {
        let p = Path::new(&update.path);
        let wide_path = wide(maybe_verbatim(p).as_os_str());
        let current_raw = unsafe { windows_sys::Win32::Storage::FileSystem::GetFileAttributesW(wide_path.as_ptr()) };
        if current_raw == windows_sys::Win32::Storage::FileSystem::INVALID_FILE_ATTRIBUTES {
            return Err(FsError::io(std::io::Error::last_os_error(), p));
        }

        let mut attrs = current_raw;
        const FILE_ATTRIBUTE_READONLY: u32 = 0x00000001;
        const FILE_ATTRIBUTE_HIDDEN: u32 = 0x00000002;
        const FILE_ATTRIBUTE_SYSTEM: u32 = 0x00000004;
        const FILE_ATTRIBUTE_ARCHIVE: u32 = 0x00000020;

        if let Some(ro) = update.readonly {
            if ro { attrs |= FILE_ATTRIBUTE_READONLY; } else { attrs &= !FILE_ATTRIBUTE_READONLY; }
        }
        if let Some(h) = update.hidden {
            if h { attrs |= FILE_ATTRIBUTE_HIDDEN; } else { attrs &= !FILE_ATTRIBUTE_HIDDEN; }
        }
        if let Some(s) = update.system {
            if s { attrs |= FILE_ATTRIBUTE_SYSTEM; } else { attrs &= !FILE_ATTRIBUTE_SYSTEM; }
        }
        if let Some(a) = update.archive {
            if a { attrs |= FILE_ATTRIBUTE_ARCHIVE; } else { attrs &= !FILE_ATTRIBUTE_ARCHIVE; }
        }

        let ok = unsafe { windows_sys::Win32::Storage::FileSystem::SetFileAttributesW(wide_path.as_ptr(), attrs) };
        if ok == 0 {
            return Err(FsError::io(std::io::Error::last_os_error(), p));
        }
        Ok(())
    }

    pub fn set_file_times(update: &FileTimesUpdate) -> FsResult<()> {
        use std::fs::OpenOptions;
        use std::os::windows::fs::OpenOptionsExt;
        use std::os::windows::io::AsRawHandle;

        let p = Path::new(&update.path);
        let is_dir = p.is_dir();
        // FILE_FLAG_BACKUP_SEMANTICS (0x02000000) allows opening directories for handle manipulation
        let mut opts = OpenOptions::new();
        opts.write(true);
        if is_dir {
            opts.custom_flags(0x02000000);
        }

        let file = opts.open(p).map_err(|e| FsError::io(e, p))?;
        let handle = file.as_raw_handle() as windows_sys::Win32::Foundation::HANDLE;

        fn ms_to_filetime(ms: i64) -> windows_sys::Win32::Foundation::FILETIME {
            // Windows FILETIME counts 100-nanosecond intervals since January 1, 1601 (UTC)
            // 11644473600 seconds between 1601 and 1970
            let intervals = (ms as u64 + 11_644_473_600_000) * 10_000;
            windows_sys::Win32::Foundation::FILETIME {
                dwLowDateTime: intervals as u32,
                dwHighDateTime: (intervals >> 32) as u32,
            }
        }

        let c_ft = update.created_ms.map(ms_to_filetime);
        let a_ft = update.accessed_ms.map(ms_to_filetime);
        let m_ft = update.modified_ms.map(ms_to_filetime);

        let lp_created = c_ft.as_ref().map(|f| f as *const _).unwrap_or(null());
        let lp_accessed = a_ft.as_ref().map(|f| f as *const _).unwrap_or(null());
        let lp_modified = m_ft.as_ref().map(|f| f as *const _).unwrap_or(null());

        let ok = unsafe {
            windows_sys::Win32::Storage::FileSystem::SetFileTime(
                handle,
                lp_created,
                lp_accessed,
                lp_modified,
            )
        };

        if ok == 0 {
            return Err(FsError::io(std::io::Error::last_os_error(), p));
        }
        Ok(())
    }

    pub fn elevate_application() -> FsResult<()> {
        let current_exe = std::env::current_exe().map_err(|e| FsError::new(ErrorCode::Io, e.to_string()))?;
        shell_execute("runas", &current_exe, false)
    }
}

#[cfg(windows)]
pub use win::{
    drives, known_folders, move_no_replace, open_default, open_with, show_properties,
    set_file_attributes, set_file_times, elevate_application,
};

#[cfg(not(windows))]
mod other {
    use super::*;
    use crate::error::{ErrorCode, FsError};

    pub fn move_no_replace(src: &Path, dst: &Path) -> FsResult<()> {
        if std::fs::symlink_metadata(dst).is_ok() {
            return Err(FsError::new(ErrorCode::AlreadyExists, "Destination exists").with_path(dst));
        }
        std::fs::rename(src, dst).map_err(|e| FsError::io(e, dst))
    }
    pub fn drives() -> Vec<DriveInfo> {
        Vec::new()
    }
    pub fn known_folders() -> Vec<KnownFolder> {
        Vec::new()
    }
    pub fn open_default(_p: &Path) -> FsResult<()> {
        Err(FsError::new(ErrorCode::Unsupported, "Not supported on this platform"))
    }
    pub fn open_with(_p: &Path) -> FsResult<()> {
        Err(FsError::new(ErrorCode::Unsupported, "Not supported on this platform"))
    }
    pub fn show_properties(_p: &Path) -> FsResult<()> {
        Err(FsError::new(ErrorCode::Unsupported, "Not supported on this platform"))
    }
    pub fn set_file_attributes(_update: &FileAttributesUpdate) -> FsResult<()> {
        Err(FsError::new(ErrorCode::Unsupported, "Not supported on this platform"))
    }
    pub fn set_file_times(_update: &FileTimesUpdate) -> FsResult<()> {
        Err(FsError::new(ErrorCode::Unsupported, "Not supported on this platform"))
    }
    pub fn elevate_application() -> FsResult<()> {
        Err(FsError::new(ErrorCode::Unsupported, "Not supported on this platform"))
    }
}

#[cfg(not(windows))]
pub use other::*;

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    #[test]
    fn finds_system_drive_and_known_folders() {
        let d = drives();
        let sys = std::env::var("SystemDrive").unwrap_or("C:".into());
        assert!(d.iter().any(|x| x.path.starts_with(&sys)), "{d:?}");
        let k = known_folders();
        assert!(k.iter().any(|f| f.id == "home"));
        assert!(k.iter().any(|f| f.id == "downloads"));
    }

    #[test]
    fn move_no_replace_refuses_overwrite() {
        let t = tempfile::tempdir().unwrap();
        let a = t.path().join("a");
        let b = t.path().join("b");
        std::fs::write(&a, "A").unwrap();
        std::fs::write(&b, "B").unwrap();
        let e = move_no_replace(&a, &b).unwrap_err();
        assert_eq!(e.code, crate::error::ErrorCode::AlreadyExists);
        assert_eq!(std::fs::read_to_string(&b).unwrap(), "B");
    }
}
