//! tauri-plugin-store wrappers for R5 Deferral #2 (user-settings,
//! kanban-state, design-variables workflows).
//!
//! Architecture (per Codex R3 ratified):
//! - Three per-concern store files: `user-settings.json`, `kanban-state.json`,
//!   `design-variables.json`.
//! - Backend-only plugin use: webview cannot invoke plugin commands; only the
//!   typed commands below are reachable via `commands.*` bindings.
//! - Singleton Kanban: `read_kanban_state()` / `write_kanban_state(value)`
//!   — no `project_id` until a future per-project Kanban wave.
//! - Per-project design-variables: `read_project_design_variables(project_id)`
//!   / `write_project_design_variables(project_id, value)`.
//! - Key-namespaced user-settings: `read_user_setting(key)` / `write_user_setting(key, value)`.
//! - Explicit `save()` after every write to ensure durability without relying
//!   on graceful exit autosave.
//! - Payload size caps: 512 KB whole-snapshot, 64 KB per user-setting value.

use serde_json::Value;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

// Per-command payloads use JSON-serialized strings to avoid the specta
// stack-overflow on recursive `serde_json::Value` type generation. The
// frontend adapter handles JSON.stringify / JSON.parse transparently;
// consumers see typed shapes via the adapter.

pub const MAX_SNAPSHOT_BYTES: usize = 512 * 1024;
pub const MAX_USER_SETTING_VALUE_BYTES: usize = 64 * 1024;

/// User-settings store filename. Per-concern store keyed by setting name.
const USER_SETTINGS_STORE: &str = "user-settings.json";

/// Kanban-state store filename. Singleton — one key `kanban-board`.
const KANBAN_STATE_STORE: &str = "kanban-state.json";

/// Design-variables store filename. Per-project — keyed by `project_id`.
const DESIGN_VARIABLES_STORE: &str = "design-variables.json";

/// Singleton key inside the Kanban store.
const KANBAN_STATE_KEY: &str = "kanban-board";

/// Normalize and validate a project_id (per Codex R3 ratified rules).
fn normalize_and_validate_project_id(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("project_id is empty after trim".to_string());
    }
    if trimmed != raw {
        return Err(format!("project_id has surrounding whitespace: '{}'", raw));
    }
    if !trimmed
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
    {
        return Err(format!("project_id has invalid characters: '{}'", trimmed));
    }
    if trimmed.len() > 64 {
        return Err(format!(
            "project_id too long ({}): '{}'",
            trimmed.len(),
            trimmed
        ));
    }
    Ok(trimmed.to_string())
}

/// Validate a user-setting key against the migration allowlist + ad-hoc
/// preferences. R5 #2 hard-excludes session-auth keys; this function is the
/// runtime safeguard (the migration runner uses a fixed allowlist too).
fn is_allowed_user_setting_key(key: &str) -> bool {
    // Reject any oracle-matched credential-bearing pattern at runtime.
    // Mirrors the SENSITIVE_KEY_ORACLE regex in
    // client/src/lib/desktop/storage-migration.ts plus the explicit
    // inventory-flagged keys.
    let lower = key.to_ascii_lowercase();
    const CREDENTIAL_NEEDLES: &[&str] = &[
        // Hyphen/underscore/no-separator variants
        "api-key", "api_key", "apikey",
        "private-key", "private_key", "privatekey",
        "access-key", "access_key", "accesskey",
        // Colon-delimited variants (e.g., `protopulse:public-api:keys`,
        // `protopulse:public-api:webhooks`).
        "api:key", "api:keys",
        "api:webhook", "api:webhooks",
        "public-api:",
        // Generic credential terms
        "secret", "oauth", "bearer", "credential",
        "token", "password",
    ];
    for needle in CREDENTIAL_NEEDLES {
        if lower.contains(needle) {
            return false;
        }
    }
    // Also reject the session-id pattern explicitly.
    if lower == "sessionid" || lower.ends_with("-session-id") || lower.ends_with("session-id") {
        return false;
    }
    true
}

/// Check that a serialized JSON payload is within the size cap.
fn check_payload_size(value: &Value, max: usize, label: &str) -> Result<(), String> {
    let serialized = serde_json::to_vec(value).map_err(|e| format!("serialize failed: {}", e))?;
    if serialized.len() > max {
        return Err(format!(
            "{} payload too large: {} bytes > max {} bytes",
            label,
            serialized.len(),
            max
        ));
    }
    Ok(())
}

// ── User-settings commands ─────────────────────────────────────────────────

fn parse_json_string(s: &str, label: &str) -> Result<Value, String> {
    serde_json::from_str(s).map_err(|e| format!("{} invalid JSON: {}", label, e))
}

fn stringify_json(v: &Value, label: &str) -> Result<String, String> {
    serde_json::to_string(v).map_err(|e| format!("{} serialize failed: {}", label, e))
}

#[tauri::command]
#[specta::specta]
pub async fn read_user_setting(
    app: AppHandle,
    key: String,
) -> Result<Option<String>, String> {
    if !is_allowed_user_setting_key(&key) {
        return Err(format!("user-setting key '{}' rejected (credential-bearing)", key));
    }
    let store = app.store(USER_SETTINGS_STORE).map_err(|e| format!("open store: {}", e))?;
    match store.get(&key) {
        Some(v) => Ok(Some(stringify_json(&v, "read_user_setting")?)),
        None => Ok(None),
    }
}

#[tauri::command]
#[specta::specta]
pub async fn write_user_setting(
    app: AppHandle,
    key: String,
    value_json: String,
) -> Result<(), String> {
    if !is_allowed_user_setting_key(&key) {
        return Err(format!("user-setting key '{}' rejected (credential-bearing)", key));
    }
    let value = parse_json_string(&value_json, "write_user_setting")?;
    check_payload_size(&value, MAX_USER_SETTING_VALUE_BYTES, "user-setting")?;
    let store = app.store(USER_SETTINGS_STORE).map_err(|e| format!("open store: {}", e))?;
    store.set(&key, value);
    store.save().map_err(|e| format!("save store: {}", e))?;
    Ok(())
}

// ── Kanban-state commands (SINGLETON per Codex R3) ─────────────────────────

#[tauri::command]
#[specta::specta]
pub async fn read_kanban_state(app: AppHandle) -> Result<Option<String>, String> {
    let store = app.store(KANBAN_STATE_STORE).map_err(|e| format!("open store: {}", e))?;
    match store.get(KANBAN_STATE_KEY) {
        Some(v) => Ok(Some(stringify_json(&v, "read_kanban_state")?)),
        None => Ok(None),
    }
}

#[tauri::command]
#[specta::specta]
pub async fn write_kanban_state(app: AppHandle, value_json: String) -> Result<(), String> {
    let value = parse_json_string(&value_json, "write_kanban_state")?;
    check_payload_size(&value, MAX_SNAPSHOT_BYTES, "kanban-state snapshot")?;
    let store = app.store(KANBAN_STATE_STORE).map_err(|e| format!("open store: {}", e))?;
    store.set(KANBAN_STATE_KEY, value);
    store.save().map_err(|e| format!("save store: {}", e))?;
    Ok(())
}

// ── Design-variables commands (per-project) ────────────────────────────────

#[tauri::command]
#[specta::specta]
pub async fn read_project_design_variables(
    app: AppHandle,
    project_id: String,
) -> Result<Option<String>, String> {
    let pid = normalize_and_validate_project_id(&project_id)?;
    let store = app
        .store(DESIGN_VARIABLES_STORE)
        .map_err(|e| format!("open store: {}", e))?;
    match store.get(&pid) {
        Some(v) => Ok(Some(stringify_json(&v, "read_project_design_variables")?)),
        None => Ok(None),
    }
}

#[tauri::command]
#[specta::specta]
pub async fn write_project_design_variables(
    app: AppHandle,
    project_id: String,
    value_json: String,
) -> Result<(), String> {
    let pid = normalize_and_validate_project_id(&project_id)?;
    let value = parse_json_string(&value_json, "write_project_design_variables")?;
    check_payload_size(&value, MAX_SNAPSHOT_BYTES, "design-variables snapshot")?;
    let store = app
        .store(DESIGN_VARIABLES_STORE)
        .map_err(|e| format!("open store: {}", e))?;
    store.set(&pid, value);
    store.save().map_err(|e| format!("save store: {}", e))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn project_id_accepts_alphanumeric_underscore_dash() {
        for valid in &["abc123", "my-project_v2", "p", "A_B-C-1"] {
            assert!(
                normalize_and_validate_project_id(valid).is_ok(),
                "expected '{}' to be valid",
                valid
            );
        }
    }

    #[test]
    fn project_id_rejects_invalid_chars() {
        for invalid in &[
            "../escape",
            "p/with/slash",
            "p.with.dot",
            "p:with:colon",
            "p with space",
            "",
        ] {
            assert!(
                normalize_and_validate_project_id(invalid).is_err(),
                "expected '{}' to be rejected",
                invalid
            );
        }
    }

    #[test]
    fn project_id_rejects_surrounding_whitespace() {
        // trim must NOT silently fix the ID; reject if trim changes the value.
        for ws in &[" abc", "abc ", "  abc  ", "\tabc"] {
            assert!(
                normalize_and_validate_project_id(ws).is_err(),
                "expected '{}' (with whitespace) to be rejected",
                ws
            );
        }
    }

    #[test]
    fn project_id_rejects_too_long() {
        let long = "a".repeat(65);
        assert!(normalize_and_validate_project_id(&long).is_err());
        let max = "a".repeat(64);
        assert!(normalize_and_validate_project_id(&max).is_ok());
    }

    #[test]
    fn user_setting_key_allowlist_accepts_known_prefs() {
        for key in &[
            "protopulse_ai_model",
            "protopulse-theme",
            "protopulse-keyboard-shortcuts",
            "protopulse:role-preset",
        ] {
            assert!(
                is_allowed_user_setting_key(key),
                "expected '{}' to be allowed",
                key
            );
        }
    }

    #[test]
    fn user_setting_key_rejects_credential_bearing() {
        for key in &[
            "protopulse-ai-api-key",
            "protopulse:public-api:keys",
            "protopulse-google-workspace-token",
            "some-oauth-token",
            "user-password-hash",
            "sessionId",
            "protopulse-session-id",
            "my-private-key",
            "access_key_id",
            "user-secret",
        ] {
            assert!(
                !is_allowed_user_setting_key(key),
                "expected '{}' to be rejected (credential)",
                key
            );
        }
    }

    #[test]
    fn payload_size_check_accepts_under_limit() {
        let small = json!({ "key": "small" });
        assert!(check_payload_size(&small, MAX_SNAPSHOT_BYTES, "test").is_ok());
    }

    #[test]
    fn payload_size_check_rejects_over_limit() {
        let big = json!({ "data": "x".repeat(MAX_SNAPSHOT_BYTES + 100) });
        assert!(check_payload_size(&big, MAX_SNAPSHOT_BYTES, "test").is_err());
    }

    #[test]
    fn payload_size_check_accepts_at_exact_limit() {
        // Construct a payload whose serialized form is exactly at the limit.
        // Format: {"d":"x...x"} — overhead is 8 chars; fill remaining with x.
        let overhead = r#"{"d":""}"#.len();
        let fill = MAX_USER_SETTING_VALUE_BYTES - overhead;
        let payload = json!({ "d": "x".repeat(fill) });
        let serialized = serde_json::to_vec(&payload).unwrap();
        assert_eq!(serialized.len(), MAX_USER_SETTING_VALUE_BYTES);
        assert!(check_payload_size(&payload, MAX_USER_SETTING_VALUE_BYTES, "test").is_ok());
    }
}
