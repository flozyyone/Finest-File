//! Search functionality: both fast live directory search and SQLite indexed search.

use crate::error::{FsError, FsResult};
use crate::index::IndexDb;
use crate::model::{entry_from_metadata, EntryKind, FileEntry};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchQuery {
    pub query: String,
    pub scope_path: Option<String>,
    pub extension: Option<String>,
    pub kind: Option<String>, // "file", "directory", or null
    pub min_size: Option<u64>,
    pub max_size: Option<u64>,
    pub limit: Option<usize>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResultItem {
    pub entry: FileEntry,
    pub match_range: Option<(usize, usize)>,
}

/// Search using the indexed SQLite database.
pub fn search_index(db: &IndexDb, q: &SearchQuery) -> FsResult<Vec<SearchResultItem>> {
    let conn = db.conn.lock().unwrap();
    let limit = q.limit.unwrap_or(200).min(1000);

    let mut sql = String::from(
        "SELECT path, name, ext, kind, size, modified, created
         FROM files
         WHERE 1=1"
    );

    let mut params_vec: Vec<rusqlite::types::Value> = Vec::new();

    if !q.query.trim().is_empty() {
        sql.push_str(" AND name LIKE ?");
        params_vec.push(format!("%{}%", q.query.trim()).into());
    }

    if let Some(ref scope) = q.scope_path {
        sql.push_str(" AND (path = ? OR path LIKE ?)");
        params_vec.push(scope.clone().into());
        params_vec.push(format!("{scope}\\%").into());
    }

    if let Some(ref ext) = q.extension {
        sql.push_str(" AND ext = ?");
        params_vec.push(ext.to_lowercase().into());
    }

    if let Some(ref kind) = q.kind {
        sql.push_str(" AND kind = ?");
        params_vec.push(kind.to_lowercase().into());
    }

    if let Some(min) = q.min_size {
        sql.push_str(" AND size >= ?");
        params_vec.push((min as i64).into());
    }

    if let Some(max) = q.max_size {
        sql.push_str(" AND size <= ?");
        params_vec.push((max as i64).into());
    }

    sql.push_str(" ORDER BY modified DESC LIMIT ?");
    params_vec.push((limit as i64).into());

    let mut stmt = conn.prepare(&sql).map_err(FsError::from)?;
    let rusqlite_params: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|v| v as &dyn rusqlite::ToSql).collect();

    let rows = stmt.query_map(rusqlite_params.as_slice(), |row| {
        let path: String = row.get(0)?;
        let name: String = row.get(1)?;
        let ext: String = row.get(2)?;
        let kind_str: String = row.get(3)?;
        let size: Option<u64> = row.get::<_, Option<i64>>(4)?.map(|s| s as u64);
        let modified: Option<i64> = row.get(5)?;
        let created: Option<i64> = row.get(6)?;

        let kind = match kind_str.as_str() {
            "directory" => EntryKind::Directory,
            "link" => EntryKind::Link,
            _ => EntryKind::File,
        };

        Ok(FileEntry {
            name,
            path,
            ext,
            kind,
            link_to_dir: false,
            size,
            modified,
            created,
            accessed: None,
            hidden: false,
            system: false,
            readonly: false,
            attributes: 0,
        })
    }).map_err(FsError::from)?;

    let mut items = Vec::new();
    let query_lower = q.query.to_lowercase();

    for r in rows {
        let entry = r.map_err(FsError::from)?;
        let match_range = if !query_lower.is_empty() {
            entry.name.to_lowercase().find(&query_lower).map(|idx| (idx, idx + query_lower.len()))
        } else {
            None
        };
        items.push(SearchResultItem { entry, match_range });
    }

    Ok(items)
}

/// Live search directly within a folder (without indexing).
/// Walks the directory recursively with a limit and cancellation support.
pub fn search_directory_live(
    root: &Path,
    q: &SearchQuery,
    cancel: &dyn Fn() -> bool,
) -> FsResult<Vec<SearchResultItem>> {
    let limit = q.limit.unwrap_or(200).min(1000);
    let mut results = Vec::new();
    let mut stack = vec![root.to_path_buf()];
    let query_lower = q.query.to_lowercase();
    let ext_lower = q.extension.as_ref().map(|e| e.to_lowercase());

    while let Some(dir) = stack.pop() {
        if cancel() || results.len() >= limit {
            break;
        }

        let Ok(rd) = fs::read_dir(&dir) else {
            continue;
        };

        for item in rd.flatten() {
            if cancel() || results.len() >= limit {
                break;
            }

            let path = item.path();
            let Ok(md) = item.metadata() else {
                continue;
            };

            let name = item.file_name().to_string_lossy().into_owned();
            let entry = entry_from_metadata(&path, name, &md);

            if entry.kind == EntryKind::Directory && !entry.link_to_dir {
                stack.push(path.clone());
            }

            // Apply filters
            let name_lower = entry.name.to_lowercase();
            if !query_lower.is_empty() && !name_lower.contains(&query_lower) {
                continue;
            }

            if let Some(ref target_ext) = ext_lower {
                if !entry.ext.eq_ignore_ascii_case(target_ext) {
                    continue;
                }
            }

            if let Some(ref kind) = q.kind {
                let matches_kind = match kind.as_str() {
                    "file" => entry.kind == EntryKind::File,
                    "directory" => entry.kind == EntryKind::Directory,
                    _ => true,
                };
                if !matches_kind {
                    continue;
                }
            }

            if let Some(min) = q.min_size {
                if entry.size.unwrap_or(0) < min {
                    continue;
                }
            }

            if let Some(max) = q.max_size {
                if entry.size.unwrap_or(0) > max {
                    continue;
                }
            }

            let match_range = if !query_lower.is_empty() {
                name_lower.find(&query_lower).map(|idx| (idx, idx + query_lower.len()))
            } else {
                None
            };

            results.push(SearchResultItem { entry, match_range });
        }
    }

    Ok(results)
}
