//! Advanced Sorting and Grouping engine for FinestFile.
//!
//! Provides comprehensive, high-performance sorting and grouping algorithms
//! for file entries with natural alphanumeric ordering, date ranges, size bins,
//! file attributes, extensions, and configurable folder precedence.

use crate::model::{FileEntry, ATTR_DIRECTORY};
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::collections::BTreeMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SortField {
    Name,
    Extension,
    Size,
    DateModified,
    DateCreated,
    DateAccessed,
    Attributes,
}

impl Default for SortField {
    fn default() -> Self {
        SortField::Name
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SortDirection {
    Ascending,
    Descending,
}

impl Default for SortDirection {
    fn default() -> Self {
        SortDirection::Ascending
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GroupMode {
    None,
    NameRange,
    Extension,
    Size,
    DateModified,
    DateCreated,
    Attributes,
}

impl Default for GroupMode {
    fn default() -> Self {
        GroupMode::None
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewPreferences {
    pub sort_field: SortField,
    pub sort_direction: SortDirection,
    pub group_mode: GroupMode,
    pub group_direction: SortDirection,
    pub folders_first: bool,
}

impl Default for ViewPreferences {
    fn default() -> Self {
        Self {
            sort_field: SortField::Name,
            sort_direction: SortDirection::Ascending,
            group_mode: GroupMode::None,
            group_direction: SortDirection::Ascending,
            folders_first: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileGroup {
    pub key: String,
    pub title: String,
    pub items: Vec<FileEntry>,
    pub total_bytes: u64,
}

/// Natural / alphanumeric string comparison (e.g., "File 2" < "File 10").
/// Performs Windows Explorer style natural sorting without pulling in large external crates.
pub fn natural_cmp(s1: &str, s2: &str) -> Ordering {
    let mut c1 = s1.chars().peekable();
    let mut c2 = s2.chars().peekable();

    loop {
        match (c1.peek(), c2.peek()) {
            (None, None) => return Ordering::Equal,
            (None, Some(_)) => return Ordering::Less,
            (Some(_), None) => return Ordering::Greater,
            (Some(ch1), Some(ch2)) => {
                if ch1.is_ascii_digit() && ch2.is_ascii_digit() {
                    // Extract full numeric segments
                    let mut num1_str = String::new();
                    while let Some(&d) = c1.peek() {
                        if d.is_ascii_digit() {
                            num1_str.push(d);
                            c1.next();
                        } else {
                            break;
                        }
                    }

                    let mut num2_str = String::new();
                    while let Some(&d) = c2.peek() {
                        if d.is_ascii_digit() {
                            num2_str.push(d);
                            c2.next();
                        } else {
                            break;
                        }
                    }

                    // Parse as u128 to handle large numbers safely
                    let n1 = num1_str.parse::<u128>().ok();
                    let n2 = num2_str.parse::<u128>().ok();

                    match (n1, n2) {
                        (Some(v1), Some(v2)) if v1 != v2 => return v1.cmp(&v2),
                        _ => {
                            // If numeric value is identical or exceeds u128, compare length or raw strings
                            if num1_str.len() != num2_str.len() {
                                return num1_str.len().cmp(&num2_str.len());
                            }
                            let raw_cmp = num1_str.cmp(&num2_str);
                            if raw_cmp != Ordering::Equal {
                                return raw_cmp;
                            }
                        }
                    }
                } else {
                    let ch1_lower = ch1.to_lowercase().next().unwrap_or(*ch1);
                    let ch2_lower = ch2.to_lowercase().next().unwrap_or(*ch2);

                    if ch1_lower != ch2_lower {
                        return ch1_lower.cmp(&ch2_lower);
                    }
                    c1.next();
                    c2.next();
                }
            }
        }
    }
}

/// Compares two FileEntry instances based on field, direction, and folders_first preference.
pub fn compare_entries(a: &FileEntry, b: &FileEntry, prefs: &ViewPreferences) -> Ordering {
    if prefs.folders_first {
        let a_is_dir = a.kind == crate::model::EntryKind::Directory || a.link_to_dir;
        let b_is_dir = b.kind == crate::model::EntryKind::Directory || b.link_to_dir;
        if a_is_dir && !b_is_dir {
            return Ordering::Less;
        }
        if !a_is_dir && b_is_dir {
            return Ordering::Greater;
        }
    }

    let ord = match prefs.sort_field {
        SortField::Name => natural_cmp(&a.name, &b.name),
        SortField::Extension => {
            let ext_cmp = a.ext.cmp(&b.ext);
            if ext_cmp != Ordering::Equal {
                ext_cmp
            } else {
                natural_cmp(&a.name, &b.name)
            }
        }
        SortField::Size => {
            let s_a = a.size.unwrap_or(0);
            let s_b = b.size.unwrap_or(0);
            let ord = s_a.cmp(&s_b);
            if ord != Ordering::Equal {
                ord
            } else {
                natural_cmp(&a.name, &b.name)
            }
        }
        SortField::DateModified => {
            let m_a = a.modified.unwrap_or(0);
            let m_b = b.modified.unwrap_or(0);
            let ord = m_a.cmp(&m_b);
            if ord != Ordering::Equal {
                ord
            } else {
                natural_cmp(&a.name, &b.name)
            }
        }
        SortField::DateCreated => {
            let c_a = a.created.unwrap_or(0);
            let c_b = b.created.unwrap_or(0);
            let ord = c_a.cmp(&c_b);
            if ord != Ordering::Equal {
                ord
            } else {
                natural_cmp(&a.name, &b.name)
            }
        }
        SortField::DateAccessed => {
            let acc_a = a.accessed.unwrap_or(0);
            let acc_b = b.accessed.unwrap_or(0);
            let ord = acc_a.cmp(&acc_b);
            if ord != Ordering::Equal {
                ord
            } else {
                natural_cmp(&a.name, &b.name)
            }
        }
        SortField::Attributes => {
            let ord = a.attributes.cmp(&b.attributes);
            if ord != Ordering::Equal {
                ord
            } else {
                natural_cmp(&a.name, &b.name)
            }
        }
    };

    let dir_ord = match prefs.sort_direction {
        SortDirection::Ascending => ord,
        SortDirection::Descending => ord.reverse(),
    };

    // Ensure stable ordering by falling back to full path if equal
    if dir_ord == Ordering::Equal {
        a.path.cmp(&b.path)
    } else {
        dir_ord
    }
}

/// Sorts a slice of FileEntry items in-place according to preferences.
pub fn sort_entries(entries: &mut [FileEntry], prefs: &ViewPreferences) {
    entries.sort_by(|a, b| compare_entries(a, b, prefs));
}

// Group calculation helpers

/// Determines the Name range group (A-D, E-H, I-L, M-P, Q-T, U-Z, 0-9, Special).
pub fn get_name_range_group(name: &str) -> (u32, &'static str, &'static str) {
    let first = name.chars().next().unwrap_or('#').to_ascii_uppercase();
    match first {
        'A'..='D' => (1, "A - D", "A - D"),
        'E'..='H' => (2, "E - H", "E - H"),
        'I'..='L' => (3, "I - L", "I - L"),
        'M'..='P' => (4, "M - P", "M - P"),
        'Q'..='T' => (5, "Q - T", "Q - T"),
        'U'..='Z' => (6, "U - Z", "U - Z"),
        '0'..='9' => (7, "0 - 9", "0 - 9"),
        _ => (8, "Special", "Special Characters"),
    }
}

/// Standard Windows Explorer style size ranges:
/// - Tiny (0 - 16 KB)
/// - Small (16 KB - 1 MB)
/// - Medium (1 MB - 128 MB)
/// - Large (128 MB - 1 GB)
/// - Huge (1 GB - 4 GB)
/// - Gigantic (> 4 GB)
/// - Folders / Unspecified
pub fn get_size_group(entry: &FileEntry) -> (u32, &'static str, &'static str) {
    if entry.kind == crate::model::EntryKind::Directory || entry.link_to_dir {
        return (0, "folders", "Folders");
    }
    let bytes = entry.size.unwrap_or(0);
    const KB: u64 = 1024;
    const MB: u64 = 1024 * KB;
    const GB: u64 = 1024 * MB;

    if bytes <= 16 * KB {
        (1, "tiny", "Tiny (0 - 16 KB)")
    } else if bytes <= 1 * MB {
        (2, "small", "Small (16 KB - 1 MB)")
    } else if bytes <= 128 * MB {
        (3, "medium", "Medium (1 MB - 128 MB)")
    } else if bytes <= 1 * GB {
        (4, "large", "Large (128 MB - 1 GB)")
    } else if bytes <= 4 * GB {
        (5, "huge", "Huge (1 GB - 4 GB)")
    } else {
        (6, "gigantic", "Gigantic (> 4 GB)")
    }
}

/// Windows Explorer style date groups based on timestamp relative to now:
/// - Today
/// - Yesterday
/// - Earlier this week
/// - Last week
/// - Earlier this month
/// - Earlier this year
/// - A long time ago
pub fn get_date_group(timestamp_ms: Option<i64>, now_ms: i64) -> (u32, &'static str, &'static str) {
    let Some(ts) = timestamp_ms else {
        return (99, "unknown", "Unknown Date");
    };

    if ts > now_ms {
        return (0, "future", "Future");
    }

    let diff_ms = (now_ms - ts).max(0);
    let diff_days = diff_ms / (24 * 3600 * 1000);

    if diff_days == 0 {
        (1, "today", "Today")
    } else if diff_days == 1 {
        (2, "yesterday", "Yesterday")
    } else if diff_days < 7 {
        (3, "earlier_this_week", "Earlier this week")
    } else if diff_days < 14 {
        (4, "last_week", "Last week")
    } else if diff_days < 30 {
        (5, "earlier_this_month", "Earlier this month")
    } else if diff_days < 365 {
        (6, "earlier_this_year", "Earlier this year")
    } else {
        (7, "older", "A long time ago")
    }
}

/// Groups file attributes (Read-only, Hidden, System, Normal).
pub fn get_attributes_group(entry: &FileEntry) -> (u32, &'static str, &'static str) {
    if entry.system {
        (1, "system", "System files")
    } else if entry.hidden {
        (2, "hidden", "Hidden files")
    } else if entry.readonly {
        (3, "readonly", "Read-only files")
    } else {
        (4, "normal", "Normal")
    }
}

/// Groups a list of FileEntries and sorts entries within each group according to preferences.
pub fn group_and_sort_entries(
    entries: &[FileEntry],
    prefs: &ViewPreferences,
    now_ms: i64,
) -> Vec<FileGroup> {
    if prefs.group_mode == GroupMode::None {
        let mut sorted = entries.to_vec();
        sort_entries(&mut sorted, prefs);
        let total_bytes = sorted.iter().filter_map(|e| e.size).sum();
        return vec![FileGroup {
            key: "all".into(),
            title: "All Files".into(),
            items: sorted,
            total_bytes,
        }];
    }

    // Map: (sort_order_weight, group_key, group_title) -> list of items
    let mut map: BTreeMap<(u32, String, String), Vec<FileEntry>> = BTreeMap::new();

    for entry in entries {
        let (order, key, title) = match prefs.group_mode {
            GroupMode::None => unreachable!(),
            GroupMode::NameRange => {
                let (ord, k, t) = get_name_range_group(&entry.name);
                (ord, k.to_string(), t.to_string())
            }
            GroupMode::Extension => {
                if entry.kind == crate::model::EntryKind::Directory || entry.link_to_dir {
                    (0, "folders".into(), "Folders".into())
                } else if entry.ext.is_empty() {
                    (998, "no_ext".into(), "No Extension".into())
                } else {
                    let ext_upper = entry.ext.to_uppercase();
                    (1, ext_upper.clone(), format!("{ext_upper} Files"))
                }
            }
            GroupMode::Size => {
                let (ord, k, t) = get_size_group(entry);
                (ord, k.to_string(), t.to_string())
            }
            GroupMode::DateModified => {
                let (ord, k, t) = get_date_group(entry.modified, now_ms);
                (ord, k.to_string(), t.to_string())
            }
            GroupMode::DateCreated => {
                let (ord, k, t) = get_date_group(entry.created, now_ms);
                (ord, k.to_string(), t.to_string())
            }
            GroupMode::Attributes => {
                let (ord, k, t) = get_attributes_group(entry);
                (ord, k.to_string(), t.to_string())
            }
        };

        map.entry((order, key, title)).or_default().push(entry.clone());
    }

    let mut groups: Vec<FileGroup> = map
        .into_iter()
        .map(|((_ord, key, title), mut items)| {
            sort_entries(&mut items, prefs);
            let total_bytes = items.iter().filter_map(|e| e.size).sum();
            FileGroup {
                key,
                title,
                items,
                total_bytes,
            }
        })
        .collect();

    if prefs.group_direction == SortDirection::Descending {
        groups.reverse();
    }

    groups
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::EntryKind;

    fn make_test_entry(name: &str, size: Option<u64>, modified: Option<i64>, is_dir: bool) -> FileEntry {
        FileEntry {
            name: name.to_string(),
            path: format!("C:\\test\\{name}"),
            ext: if is_dir { String::new() } else { crate::model::extension_of(name) },
            kind: if is_dir { EntryKind::Directory } else { EntryKind::File },
            link_to_dir: false,
            size,
            modified,
            created: Some(1000),
            accessed: Some(2000),
            hidden: false,
            system: false,
            readonly: false,
            attributes: if is_dir { ATTR_DIRECTORY } else { 0 },
        }
    }

    #[test]
    fn test_natural_alphanumeric_sorting() {
        let mut list = vec![
            make_test_entry("File 10.txt", Some(100), None, false),
            make_test_entry("File 2.txt", Some(200), None, false),
            make_test_entry("File 1.txt", Some(300), None, false),
            make_test_entry("File 20.txt", Some(400), None, false),
            make_test_entry("file 3.txt", Some(500), None, false),
        ];

        let prefs = ViewPreferences {
            sort_field: SortField::Name,
            sort_direction: SortDirection::Ascending,
            folders_first: true,
            ..Default::default()
        };

        sort_entries(&mut list, &prefs);
        let names: Vec<&str> = list.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(names, vec!["File 1.txt", "File 2.txt", "file 3.txt", "File 10.txt", "File 20.txt"]);

        // Descending test
        let mut prefs_desc = prefs.clone();
        prefs_desc.sort_direction = SortDirection::Descending;
        sort_entries(&mut list, &prefs_desc);
        let names_desc: Vec<&str> = list.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(names_desc, vec!["File 20.txt", "File 10.txt", "file 3.txt", "File 2.txt", "File 1.txt"]);
    }

    #[test]
    fn test_folders_first_precedence() {
        let mut list = vec![
            make_test_entry("Z_file.txt", Some(10), None, false),
            make_test_entry("A_folder", None, None, true),
            make_test_entry("A_file.txt", Some(20), None, false),
            make_test_entry("Z_folder", None, None, true),
        ];

        let prefs = ViewPreferences {
            sort_field: SortField::Name,
            sort_direction: SortDirection::Ascending,
            folders_first: true,
            ..Default::default()
        };

        sort_entries(&mut list, &prefs);
        let names: Vec<&str> = list.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(names, vec!["A_folder", "Z_folder", "A_file.txt", "Z_file.txt"]);

        // Folders first disabled
        let mut prefs_no_ff = prefs.clone();
        prefs_no_ff.folders_first = false;
        sort_entries(&mut list, &prefs_no_ff);
        let names_no_ff: Vec<&str> = list.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(names_no_ff, vec!["A_file.txt", "A_folder", "Z_file.txt", "Z_folder"]);
    }

    #[test]
    fn test_sorting_by_size_and_date() {
        let mut list = vec![
            make_test_entry("Medium.dat", Some(500), Some(300), false),
            make_test_entry("Large.dat", Some(2000), Some(100), false),
            make_test_entry("Small.dat", Some(50), Some(500), false),
        ];

        let size_prefs = ViewPreferences {
            sort_field: SortField::Size,
            sort_direction: SortDirection::Descending,
            folders_first: true,
            ..Default::default()
        };
        sort_entries(&mut list, &size_prefs);
        let names_by_size: Vec<&str> = list.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(names_by_size, vec!["Large.dat", "Medium.dat", "Small.dat"]);

        let date_prefs = ViewPreferences {
            sort_field: SortField::DateModified,
            sort_direction: SortDirection::Ascending,
            folders_first: true,
            ..Default::default()
        };
        sort_entries(&mut list, &date_prefs);
        let names_by_date: Vec<&str> = list.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(names_by_date, vec!["Large.dat", "Medium.dat", "Small.dat"]);
    }

    #[test]
    fn test_group_by_name_range() {
        let list = vec![
            make_test_entry("Apple.txt", Some(10), None, false),
            make_test_entry("Cat.txt", Some(10), None, false),
            make_test_entry("Elephant.txt", Some(10), None, false),
            make_test_entry("123.txt", Some(10), None, false),
            make_test_entry("_special.txt", Some(10), None, false),
        ];

        let prefs = ViewPreferences {
            sort_field: SortField::Name,
            sort_direction: SortDirection::Ascending,
            group_mode: GroupMode::NameRange,
            group_direction: SortDirection::Ascending,
            folders_first: true,
        };

        let groups = group_and_sort_entries(&list, &prefs, 0);
        let keys: Vec<&str> = groups.iter().map(|g| g.key.as_str()).collect();
        assert_eq!(keys, vec!["A - D", "E - H", "0 - 9", "Special"]);

        let ad_group = groups.iter().find(|g| g.key == "A - D").unwrap();
        let ad_names: Vec<&str> = ad_group.items.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(ad_names, vec!["Apple.txt", "Cat.txt"]);
    }

    #[test]
    fn test_group_by_size() {
        let list = vec![
            make_test_entry("Tiny.txt", Some(5 * 1024), None, false),
            make_test_entry("Huge.bin", Some(2 * 1024 * 1024 * 1024), None, false),
            make_test_entry("FolderA", None, None, true),
        ];

        let prefs = ViewPreferences {
            sort_field: SortField::Name,
            sort_direction: SortDirection::Ascending,
            group_mode: GroupMode::Size,
            group_direction: SortDirection::Ascending,
            folders_first: true,
        };

        let groups = group_and_sort_entries(&list, &prefs, 0);
        let keys: Vec<&str> = groups.iter().map(|g| g.key.as_str()).collect();
        assert_eq!(keys, vec!["folders", "tiny", "huge"]);
    }

    #[test]
    fn test_group_by_date() {
        let now = 1_000_000_000_000i64;
        let day_ms = 24 * 3600 * 1000;
        let list = vec![
            make_test_entry("Today.txt", Some(10), Some(now - 1000), false),
            make_test_entry("Yesterday.txt", Some(10), Some(now - day_ms - 1000), false),
            make_test_entry("Old.txt", Some(10), Some(now - 400 * day_ms), false),
        ];

        let prefs = ViewPreferences {
            sort_field: SortField::Name,
            sort_direction: SortDirection::Ascending,
            group_mode: GroupMode::DateModified,
            group_direction: SortDirection::Ascending,
            folders_first: true,
        };

        let groups = group_and_sort_entries(&list, &prefs, now);
        let keys: Vec<&str> = groups.iter().map(|g| g.key.as_str()).collect();
        assert_eq!(keys, vec!["today", "yesterday", "older"]);
    }

    #[test]
    fn test_group_and_sort_together() {
        let list = vec![
            make_test_entry("doc2.pdf", Some(500), None, false),
            make_test_entry("doc1.pdf", Some(1000), None, false),
            make_test_entry("image2.png", Some(100), None, false),
            make_test_entry("image1.png", Some(200), None, false),
        ];

        // Group by extension, then sort by size descending within each group
        let prefs = ViewPreferences {
            sort_field: SortField::Size,
            sort_direction: SortDirection::Descending,
            group_mode: GroupMode::Extension,
            group_direction: SortDirection::Ascending,
            folders_first: true,
        };

        let groups = group_and_sort_entries(&list, &prefs, 0);
        assert_eq!(groups.len(), 2);

        let pdf_group = groups.iter().find(|g| g.key == "PDF").unwrap();
        let pdf_names: Vec<&str> = pdf_group.items.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(pdf_names, vec!["doc1.pdf", "doc2.pdf"]); // 1000 > 500

        let png_group = groups.iter().find(|g| g.key == "PNG").unwrap();
        let png_names: Vec<&str> = png_group.items.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(png_names, vec!["image1.png", "image2.png"]); // 200 > 100
    }
}
