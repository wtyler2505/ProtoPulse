//! Path validation for custom Rust `#[tauri::command]` file operations.
//!
//! Phase 2.2 (R4 retro): Tauri capabilities (`fs:allow-*` permissions) only
//! protect calls THROUGH the `tauri-plugin-fs` API. They do NOT scope-check
//! custom commands that call `tokio::fs::*` directly. This module is the
//! single Rust authority for path validation on custom file commands.
//!
//! See `docs/audits/2026-05-12-tauri-retro-r4-land.md` for the retro audit
//! that established this requirement.
//!
//! The same conceptual deny list also appears in
//! `src-tauri/capabilities/default.json` (for plugin-fs callers). A drift
//! test asserts symmetry; the Rust constants here are authoritative.

use std::path::{Path, PathBuf};

use tauri::path::BaseDirectory;
use tauri::Manager;

/// Maximum bytes a single `read_file` call will return. Above this, reject.
/// 64 MiB is generous for project / CSV / SVG files; binaries should not be
/// read via this command.
pub const MAX_READ_SIZE_BYTES: u64 = 64 * 1024 * 1024;

/// Intent declared by the caller for a write operation. Determines which
/// allowed scopes apply: public folders (Desktop / Documents / Downloads)
/// only accept a narrow set of intent extensions; app-data scopes accept
/// any intent.
#[allow(dead_code)] // Variants populated incrementally per per-intent typed commands (R5 wave).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WriteIntent {
    ProjectFile,        // .protopulse
    CsvExport,          // .csv
    SvgExport,          // .svg
    JsonExport,         // .json — app-data scopes only
    TextExport,         // .txt — app-data scopes only
    MarkdownExport,     // .md — app-data scopes only
    SpiceNetlistExport, // .cir, .net — app-data scopes only
    KicadExport,        // .kicad_sch, .kicad_pcb — app-data scopes only
    GerberExport,       // .gbr, .ger, .gerber, .drl, .xln — app-data scopes only
    Other,              // unknown ext — app-data scopes only
}

#[allow(dead_code)] // Same; populated as intent-typed read commands land (R5 wave).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReadIntent {
    ProjectImport,
    CsvImport,
    JsonImport,
    Generic,
}

#[allow(dead_code)] // Some error variants populated as command bodies cover more conditions.
#[derive(Debug)]
pub enum PathValidationError {
    NotInAllowedScope(PathBuf),
    DeniedByName(String),
    DeniedByExtension(String),
    EbWebViewBlocked,
    SymlinkLeafRejected(PathBuf),
    CanonicalizeFailed(String),
    ParentMissing,
    FileNotFound(PathBuf),
    FileTooLarge { actual: u64, max: u64 },
    OpenFailed(String),
    ReadFailed(String),
    WriteFailed(String),
    Utf8Error(String),
}

impl std::fmt::Display for PathValidationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NotInAllowedScope(p) => {
                write!(f, "path '{}' is not inside any allowed scope", p.display())
            }
            Self::DeniedByName(n) => write!(f, "path filename '{}' is denied by name", n),
            Self::DeniedByExtension(e) => {
                write!(f, "path extension '{}' is denied (secrets-bearing format)", e)
            }
            Self::EbWebViewBlocked => write!(f, "$APPLOCALDATA/EBWebView paths are forbidden"),
            Self::SymlinkLeafRejected(p) => {
                write!(f, "path '{}' has a symlink leaf — refusing to follow", p.display())
            }
            Self::CanonicalizeFailed(e) => write!(f, "canonicalize failed: {}", e),
            Self::ParentMissing => write!(f, "path has no parent directory"),
            Self::FileNotFound(p) => write!(f, "file not found: {}", p.display()),
            Self::FileTooLarge { actual, max } => {
                write!(f, "file too large: {} bytes > max {}", actual, max)
            }
            Self::OpenFailed(e) => write!(f, "open failed: {}", e),
            Self::ReadFailed(e) => write!(f, "read failed: {}", e),
            Self::WriteFailed(e) => write!(f, "write failed: {}", e),
            Self::Utf8Error(e) => write!(f, "file is not valid UTF-8: {}", e),
        }
    }
}

impl std::error::Error for PathValidationError {}

/// Filenames denied EVERYWHERE — across app-data scopes AND public scopes.
/// Authoritative source; capability JSON deny list is a second view of this.
pub const DENIED_NAMES: &[&str] = &[
    "secrets.json",
    "credentials.json",
    ".env",
    ".npmrc",
    ".pypirc",
];

/// Filename PREFIXES denied (case-insensitive). Catches `.env.local`,
/// `.env.production`, `id_rsa`, `id_rsa.pub`, `id_ed25519`, etc.
pub const DENIED_PREFIXES: &[&str] = &[
    ".env.",
    "id_rsa",
    "id_ed25519",
    "id_ecdsa",
    "id_dsa",
];

/// Extensions denied EVERYWHERE.
pub const DENIED_EXTS: &[&str] = &[
    "key", "pem", "p12", "pfx", "kdbx", "asc",
];

/// Substrings inside any filename that mark it as credential-bearing.
/// R4.5 fix (Codex R4 land review): the broad secret-name family from R3.7
/// was missing. `oauth-token.protopulse`, `private-key.svg`, `access-key.csv`,
/// `my-api-key.json` are all rejected even though their EXTENSIONS are
/// otherwise allowed.
pub const DENIED_SUBSTRINGS: &[&str] = &[
    "api-key",
    "api_key",
    "oauth",
    "private-key",
    "private_key",
    "access-key",
    "access_key",
    "secret",
    "password",
    "passwd",
];

/// Determine WriteIntent from a file path's extension. Used by command
/// bodies to pick the right scope-check before opening.
pub fn write_intent_from_extension(file_path: &str) -> WriteIntent {
    match Path::new(file_path)
        .extension()
        .and_then(|e| e.to_str())
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("protopulse") => WriteIntent::ProjectFile,
        Some("csv") => WriteIntent::CsvExport,
        Some("svg") => WriteIntent::SvgExport,
        Some("json") => WriteIntent::JsonExport,
        Some("txt") => WriteIntent::TextExport,
        Some("md") => WriteIntent::MarkdownExport,
        Some("cir") | Some("net") => WriteIntent::SpiceNetlistExport,
        Some("kicad_sch") | Some("kicad_pcb") => WriteIntent::KicadExport,
        Some("gbr") | Some("ger") | Some("gerber") | Some("drl") | Some("xln") => {
            WriteIntent::GerberExport
        }
        _ => WriteIntent::Other,
    }
}

fn app_data_dirs(app: &tauri::AppHandle) -> Vec<PathBuf> {
    let mut dirs = Vec::with_capacity(3);
    if let Ok(d) = app.path().resolve("protopulse", BaseDirectory::AppData) {
        dirs.push(d);
    }
    if let Ok(d) = app.path().resolve("protopulse", BaseDirectory::AppLocalData) {
        dirs.push(d);
    }
    if let Ok(d) = app.path().resolve("Documents/ProtoPulse", BaseDirectory::Home) {
        dirs.push(d);
    }
    dirs
}

fn public_dirs(app: &tauri::AppHandle) -> Vec<PathBuf> {
    let mut dirs = Vec::with_capacity(3);
    if let Ok(d) = app.path().resolve("", BaseDirectory::Desktop) {
        dirs.push(d);
    }
    if let Ok(d) = app.path().resolve("", BaseDirectory::Document) {
        dirs.push(d);
    }
    if let Ok(d) = app.path().resolve("", BaseDirectory::Download) {
        dirs.push(d);
    }
    dirs
}

fn is_denied_name_or_ext(path: &Path) -> Result<(), PathValidationError> {
    let name_lc = path
        .file_name()
        .and_then(|n| n.to_str())
        .map(str::to_ascii_lowercase);
    let ext_lc = path
        .extension()
        .and_then(|e| e.to_str())
        .map(str::to_ascii_lowercase);

    if let Some(ref name) = name_lc {
        for denied in DENIED_NAMES {
            if name == denied {
                return Err(PathValidationError::DeniedByName(name.clone()));
            }
        }
        for prefix in DENIED_PREFIXES {
            if name.starts_with(prefix) {
                return Err(PathValidationError::DeniedByName(name.clone()));
            }
        }
    }
    if let Some(ref ext) = ext_lc {
        for denied in DENIED_EXTS {
            if ext == denied {
                return Err(PathValidationError::DeniedByExtension(ext.clone()));
            }
        }
    }
    // R4.5 fix: broad substring match for credential-bearing basenames.
    // Catches `oauth-token.protopulse`, `my-api-key.csv`, `access_key.svg`,
    // `*.secret`, etc. — even when extension is otherwise allowed.
    if let Some(ref name) = name_lc {
        for substr in DENIED_SUBSTRINGS {
            if name.contains(substr) {
                return Err(PathValidationError::DeniedByName(name.clone()));
            }
        }
    }
    Ok(())
}

fn is_ebwebview(path: &Path, app: &tauri::AppHandle) -> bool {
    if let Ok(ebweb) = app.path().resolve("EBWebView", BaseDirectory::AppLocalData) {
        path.starts_with(&ebweb)
    } else {
        false
    }
}

fn scope_check(
    canonical: &Path,
    app: &tauri::AppHandle,
    allowed_extensions: &[&str],
) -> Result<(), PathValidationError> {
    // App-data scopes accept any extension (deny family still applied separately).
    for d in app_data_dirs(app) {
        if canonical.starts_with(&d) {
            return Ok(());
        }
    }
    // Public scopes require extension match.
    let canonical_ext = canonical
        .extension()
        .and_then(|e| e.to_str())
        .map(str::to_ascii_lowercase);
    if let Some(ext) = canonical_ext {
        if allowed_extensions.iter().any(|e| *e == ext.as_str()) {
            for d in public_dirs(app) {
                if canonical.starts_with(&d) {
                    return Ok(());
                }
            }
        }
    }
    Err(PathValidationError::NotInAllowedScope(canonical.to_path_buf()))
}

fn public_scope_extensions_for_intent(intent: WriteIntent) -> &'static [&'static str] {
    match intent {
        WriteIntent::ProjectFile => &["protopulse"],
        WriteIntent::CsvExport => &["csv"],
        WriteIntent::SvgExport => &["svg"],
        WriteIntent::JsonExport
        | WriteIntent::TextExport
        | WriteIntent::MarkdownExport
        | WriteIntent::SpiceNetlistExport
        | WriteIntent::KicadExport
        | WriteIntent::GerberExport
        | WriteIntent::Other => &[], // App-data scopes only — empty public ext list rejects public writes
    }
}

fn public_scope_extensions_for_read(intent: ReadIntent) -> &'static [&'static str] {
    match intent {
        ReadIntent::ProjectImport => &["protopulse"],
        ReadIntent::CsvImport => &["csv"],
        ReadIntent::JsonImport => &[],
        ReadIntent::Generic => &["protopulse", "csv", "svg"],
    }
}

/// Validate a read path. Pre-canonicalize symlink check ensures we don't
/// follow a symlink leaf placed inside an allowed scope.
pub fn validate_existing_read_path(
    app: &tauri::AppHandle,
    file_path: &str,
    intent: ReadIntent,
) -> Result<PathBuf, PathValidationError> {
    let raw = Path::new(file_path);

    // Pre-canonicalize symlink check: refuse to follow a symlink leaf.
    match std::fs::symlink_metadata(raw) {
        Ok(meta) => {
            if meta.file_type().is_symlink() {
                return Err(PathValidationError::SymlinkLeafRejected(raw.to_path_buf()));
            }
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            return Err(PathValidationError::FileNotFound(raw.to_path_buf()));
        }
        Err(e) => {
            return Err(PathValidationError::CanonicalizeFailed(e.to_string()));
        }
    }

    let canonical = std::fs::canonicalize(raw)
        .map_err(|e| PathValidationError::CanonicalizeFailed(e.to_string()))?;

    if is_ebwebview(&canonical, app) {
        return Err(PathValidationError::EbWebViewBlocked);
    }
    is_denied_name_or_ext(&canonical)?;

    let allowed = public_scope_extensions_for_read(intent);
    scope_check(&canonical, app, allowed)?;

    Ok(canonical)
}

/// Validate a write path. Target leaf may not exist yet — canonicalize the
/// parent and re-attach the leaf. The actual no-follow protection comes
/// from `open_no_follow_write` below, which opens with O_NOFOLLOW /
/// FILE_FLAG_OPEN_REPARSE_POINT atomically.
pub fn validate_new_write_path(
    app: &tauri::AppHandle,
    file_path: &str,
    intent: WriteIntent,
) -> Result<PathBuf, PathValidationError> {
    let raw = Path::new(file_path);

    let canonical = if raw.exists() {
        // If leaf already exists, reject if it is a symlink.
        match std::fs::symlink_metadata(raw) {
            Ok(meta) => {
                if meta.file_type().is_symlink() {
                    return Err(PathValidationError::SymlinkLeafRejected(raw.to_path_buf()));
                }
            }
            Err(e) => {
                return Err(PathValidationError::CanonicalizeFailed(e.to_string()));
            }
        }
        std::fs::canonicalize(raw)
            .map_err(|e| PathValidationError::CanonicalizeFailed(e.to_string()))?
    } else {
        let parent = raw.parent().ok_or(PathValidationError::ParentMissing)?;
        let canonical_parent = std::fs::canonicalize(parent)
            .map_err(|e| PathValidationError::CanonicalizeFailed(e.to_string()))?;
        let name = raw
            .file_name()
            .ok_or(PathValidationError::ParentMissing)?;
        canonical_parent.join(name)
    };

    if is_ebwebview(&canonical, app) {
        return Err(PathValidationError::EbWebViewBlocked);
    }
    is_denied_name_or_ext(&canonical)?;

    let allowed = public_scope_extensions_for_intent(intent);
    scope_check(&canonical, app, allowed)?;

    Ok(canonical)
}

/// Open a file for READING with no-follow semantics. The handle is returned
/// as a `std::fs::File`; callers wrap with `tokio::fs::File::from_std` for
/// async reads. Required by R4 retro C1 acceptance guard: the read MUST
/// happen through the no-follow handle, not via a separate path-based
/// `tokio::fs::read_to_string` after a probe.
pub fn open_no_follow_read(canonical: &Path) -> Result<std::fs::File, PathValidationError> {
    let mut opts = std::fs::OpenOptions::new();
    opts.read(true);

    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt as _;
        opts.custom_flags(libc::O_NOFOLLOW);
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt as _;
        // FILE_FLAG_OPEN_REPARSE_POINT = 0x00200000 — opens the reparse point
        // itself rather than following it. Windows analogue of O_NOFOLLOW.
        opts.custom_flags(0x00200000);
    }

    opts.open(canonical)
        .map_err(|e| PathValidationError::OpenFailed(e.to_string()))
}

/// Open a file for WRITING with no-follow + create-or-truncate semantics.
/// Atomically refuses to traverse a symlink at the leaf — closes the
/// canonicalize-then-write TOCTOU.
pub fn open_no_follow_write(canonical: &Path) -> Result<std::fs::File, PathValidationError> {
    let mut opts = std::fs::OpenOptions::new();
    opts.write(true).create(true).truncate(true);

    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt as _;
        opts.custom_flags(libc::O_NOFOLLOW);
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt as _;
        opts.custom_flags(0x00200000); // FILE_FLAG_OPEN_REPARSE_POINT
    }

    opts.open(canonical)
        .map_err(|e| PathValidationError::OpenFailed(e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn write_intent_from_extension_recognizes_known_extensions() {
        assert_eq!(write_intent_from_extension("foo.protopulse"), WriteIntent::ProjectFile);
        assert_eq!(write_intent_from_extension("foo.csv"), WriteIntent::CsvExport);
        assert_eq!(write_intent_from_extension("foo.SVG"), WriteIntent::SvgExport);
        assert_eq!(write_intent_from_extension("foo.json"), WriteIntent::JsonExport);
        assert_eq!(write_intent_from_extension("foo.txt"), WriteIntent::TextExport);
        assert_eq!(write_intent_from_extension("foo.kicad_sch"), WriteIntent::KicadExport);
        assert_eq!(write_intent_from_extension("foo.gbr"), WriteIntent::GerberExport);
        assert_eq!(write_intent_from_extension("foo.unknown"), WriteIntent::Other);
        assert_eq!(write_intent_from_extension("noext"), WriteIntent::Other);
    }

    #[test]
    fn denied_names_match_case_insensitive() {
        let p = Path::new("/tmp/Secrets.JSON");
        assert!(matches!(
            is_denied_name_or_ext(p),
            Err(PathValidationError::DeniedByName(_))
        ));
    }

    #[test]
    fn denied_prefixes_catch_env_variants() {
        let p = Path::new("/tmp/.env.local");
        assert!(matches!(
            is_denied_name_or_ext(p),
            Err(PathValidationError::DeniedByName(_))
        ));
    }

    #[test]
    fn denied_extensions_match() {
        let p = Path::new("/tmp/api.KEY");
        assert!(matches!(
            is_denied_name_or_ext(p),
            Err(PathValidationError::DeniedByExtension(_))
        ));
    }

    #[test]
    fn id_rsa_variants_denied() {
        for name in &["id_rsa", "id_rsa.pub", "id_ed25519", "id_ecdsa.pub"] {
            let p = PathBuf::from("/tmp").join(name);
            assert!(
                matches!(
                    is_denied_name_or_ext(&p),
                    Err(PathValidationError::DeniedByName(_))
                ),
                "expected {} to be denied",
                name
            );
        }
    }

    #[test]
    fn denied_substrings_catch_credential_basenames() {
        // R4.5 fix (Codex R4 land review): broad substring deny catches
        // credential-bearing names even with otherwise-allowed extensions.
        for name in &[
            "my-api-key.csv",
            "OAuth-token.protopulse",
            "private-key.svg",
            "access_key.json",
            "secret-config.txt",
            "user-password.csv",
        ] {
            let p = PathBuf::from("/tmp").join(name);
            assert!(
                matches!(
                    is_denied_name_or_ext(&p),
                    Err(PathValidationError::DeniedByName(_))
                ),
                "expected {} to be denied by substring",
                name
            );
        }
    }

    #[test]
    fn public_scope_extensions_for_intent_project_file() {
        assert_eq!(public_scope_extensions_for_intent(WriteIntent::ProjectFile), &["protopulse"]);
    }

    #[test]
    fn public_scope_extensions_for_intent_other_is_empty() {
        // Other intent → app-data scopes only, empty public ext list rejects public writes
        let empty: &[&str] = &[];
        assert_eq!(public_scope_extensions_for_intent(WriteIntent::Other), empty);
    }
}
