//! Phase 2 (Native Authority) regression tests — command manifest parity and
//! capability/CSP least-privilege invariants.
//!
//! Plan: docs/plans/2026-05-10-tauri-v2-desktop-migration.md, Tasks 2.1 + 2.2.
//! ADR:  docs/decisions/2026-06-12-adr-tauri-phase2-native-authority-threat-model.md
//!
//! These are static-file contract tests (no app boot needed). They guard:
//!   1. `spawn_process` (the removed generic RCE primitive) never reappears in
//!      build.rs, lib.rs registration, or the generated bindings.
//!   2. The `AppManifest::commands` allowlist in build.rs stays in exact-set
//!      parity with `collect_commands![]` in lib.rs — a command registered but
//!      not allowlisted is dead; a command allowlisted but not registered is
//!      drift.
//!   3. Capabilities (capabilities/default.json) carry no broad shell
//!      execute/spawn grants, every fs:allow-* permission is path-scoped, and
//!      `fs:scope` hard-denies the WebView profile dir
//!      (`$APPLOCALDATA/EBWebView/**`) per https://v2.tauri.app/plugin/file-system.
//!   4. tauri.conf.json: CSP contains no `http://localhost`, and
//!      `withGlobalTauri` stays false.

use std::collections::BTreeSet;
use std::fs;
use std::path::PathBuf;

fn manifest_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

fn read(rel: &str) -> String {
    let path = manifest_dir().join(rel);
    fs::read_to_string(&path).unwrap_or_else(|e| panic!("failed to read {}: {e}", path.display()))
}

/// Extract the string-literal command names from the
/// `AppManifest::new().commands(&[ ... ])` block in build.rs.
fn build_rs_allowlist() -> BTreeSet<String> {
    let src = read("build.rs");
    let start = src
        .find(".commands(&[")
        .expect("build.rs must declare AppManifest::new().commands(&[...]) (Phase 2.1)");
    let rest = &src[start..];
    let end = rest
        .find("])")
        .expect("unterminated commands(&[...]) block in build.rs");
    let block = &rest[..end];

    let mut names = BTreeSet::new();
    let mut chars = block.char_indices();
    while let Some((i, c)) = chars.next() {
        if c == '"' {
            if let Some(close) = block[i + 1..].find('"') {
                names.insert(block[i + 1..i + 1 + close].to_string());
                // Skip past the closing quote.
                for _ in 0..close + 1 {
                    chars.next();
                }
            }
        }
    }
    assert!(!names.is_empty(), "build.rs command allowlist parsed empty");
    names
}

/// Extract registered command names from `collect_commands![ ... ]` in lib.rs.
/// Handles module paths (`desktop_store::read_user_setting` -> `read_user_setting`).
fn lib_rs_registered() -> BTreeSet<String> {
    let src = read("src/lib.rs");
    let start = src
        .find("collect_commands![")
        .expect("lib.rs must register commands via collect_commands![...]");
    let rest = &src[start + "collect_commands![".len()..];
    let end = rest.find(']').expect("unterminated collect_commands![...]");
    let block = &rest[..end];

    let mut names = BTreeSet::new();
    for raw in block.split(',') {
        // Strip line comments, whitespace.
        let item = raw
            .lines()
            .map(|l| l.split("//").next().unwrap_or(""))
            .collect::<String>();
        let item = item.trim();
        if item.is_empty() {
            continue;
        }
        let terminal = item.rsplit("::").next().unwrap_or(item).trim();
        if !terminal.is_empty()
            && terminal
                .chars()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_')
        {
            names.insert(terminal.to_string());
        }
    }
    assert!(!names.is_empty(), "lib.rs collect_commands parsed empty");
    names
}

#[test]
fn spawn_process_is_not_registered_anywhere() {
    assert!(
        !build_rs_allowlist().contains("spawn_process"),
        "spawn_process must never return to the build.rs AppManifest allowlist"
    );
    assert!(
        !lib_rs_registered().contains("spawn_process"),
        "spawn_process must never be registered in collect_commands![]"
    );
    // Belt-and-suspenders: no live `#[tauri::command]` named spawn_process.
    let lib = read("src/lib.rs");
    assert!(
        !lib.contains("fn spawn_process"),
        "a spawn_process function definition reappeared in lib.rs"
    );
}

#[test]
fn build_manifest_allowlist_matches_registered_commands_exactly() {
    let allow = build_rs_allowlist();
    let registered = lib_rs_registered();
    let missing_from_allow: Vec<_> = registered.difference(&allow).collect();
    let stale_in_allow: Vec<_> = allow.difference(&registered).collect();
    assert!(
        missing_from_allow.is_empty() && stale_in_allow.is_empty(),
        "AppManifest::commands drift — registered-but-not-allowlisted: {missing_from_allow:?}; \
         allowlisted-but-not-registered: {stale_in_allow:?}"
    );
}

#[test]
fn capabilities_have_no_generic_shell_or_unscoped_fs_authority() {
    let cap: serde_json::Value =
        serde_json::from_str(&read("capabilities/default.json")).expect("default.json parses");
    let perms = cap["permissions"].as_array().expect("permissions array");

    let mut saw_fs_scope_webview_deny = false;

    for p in perms {
        match p {
            serde_json::Value::String(s) => {
                // Bare string grants: forbid generic shell execution and broad
                // unscoped fs read/write families. `shell:allow-open` (opener-
                // style URL open) and `fs:default` (deny-by-default base) are OK.
                assert!(
                    !matches!(
                        s.as_str(),
                        "shell:allow-execute"
                            | "shell:allow-spawn"
                            | "shell:allow-kill"
                            | "fs:allow-read"
                            | "fs:allow-write"
                            | "fs:read-all"
                            | "fs:write-all"
                            | "fs:allow-read-file"
                            | "fs:allow-write-file"
                    ),
                    "broad/unscoped permission grant present: {s}"
                );
            }
            serde_json::Value::Object(obj) => {
                let ident = obj["identifier"].as_str().unwrap_or("");
                if ident.starts_with("fs:allow-") {
                    let allow = obj["allow"].as_array();
                    assert!(
                        allow.map(|a| !a.is_empty()).unwrap_or(false),
                        "{ident} must carry non-empty scoped allow paths"
                    );
                    for entry in allow.unwrap() {
                        let path = entry["path"].as_str().unwrap_or("");
                        assert!(
                            path.starts_with('$'),
                            "{ident} allow path must be rooted in a Tauri base-dir variable, got: {path}"
                        );
                        assert_ne!(path, "$HOME/**", "{ident} must not grant all of $HOME");
                        assert_ne!(path, "**", "{ident} must not grant the whole filesystem");
                    }
                }
                if ident == "fs:scope" {
                    if let Some(deny) = obj["deny"].as_array() {
                        saw_fs_scope_webview_deny = deny.iter().any(|d| {
                            d["path"].as_str() == Some("$APPLOCALDATA/EBWebView/**")
                        });
                    }
                }
            }
            other => panic!("unexpected permission entry shape: {other}"),
        }
    }

    assert!(
        saw_fs_scope_webview_deny,
        "fs:scope must hard-deny $APPLOCALDATA/EBWebView/** (WebView profile data)"
    );
}

#[test]
fn production_csp_and_global_tauri_stay_locked_down() {
    let conf: serde_json::Value =
        serde_json::from_str(&read("tauri.conf.json")).expect("tauri.conf.json parses");

    let csp = conf["app"]["security"]["csp"]
        .as_str()
        .expect("app.security.csp must be set (never null)");
    assert!(
        !csp.contains("http://localhost"),
        "production CSP must not allow http://localhost origins"
    );
    assert!(
        !csp.contains("'unsafe-eval'"),
        "production CSP must not allow unsafe-eval"
    );
    assert!(
        csp.contains("default-src 'self'"),
        "CSP must anchor on default-src 'self'"
    );

    assert_eq!(
        conf["app"]["withGlobalTauri"],
        serde_json::Value::Bool(false),
        "withGlobalTauri must remain false (no window.__TAURI__ surface)"
    );
}

#[test]
fn generated_bindings_do_not_expose_spawn_process() {
    let bindings_path = manifest_dir().join("../client/src/lib/bindings.ts");
    let bindings = fs::read_to_string(&bindings_path)
        .unwrap_or_else(|e| panic!("failed to read {}: {e}", bindings_path.display()));
    assert!(
        !bindings.contains("spawn_process") && !bindings.contains("spawnProcess"),
        "generated bindings.ts must not expose a process-spawn command"
    );
}
