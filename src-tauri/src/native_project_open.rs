//! Native project-open lifecycle bridge.
//!
//! Phase 4.2 (R4 retro Wave 5): when ProtoPulse is launched via file
//! association (`protopulse foo.protopulse`) or deep-link
//! (`protopulse://open?project=foo.protopulse`), the OS-level event arrives
//! BEFORE the React frontend mounts and installs its event listener.
//!
//! This module solves the race with a two-state machine:
//!
//!   - **Pending**: `frontend_ready` is false. All open requests queue.
//!   - **Live**:    `frontend_ready` is true. Open requests emit directly to
//!                  the frontend via `app.emit("project-open-request", ...)`;
//!                  if emit fails, the request is re-queued.
//!
//! The frontend transitions the state via the `frontend_ready_for_project_open_requests`
//! Tauri command (called once on mount after the listener is installed).

use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{Emitter, Manager, State};

#[derive(Clone, Debug, Serialize, Deserialize, Type)]
pub struct PendingProjectOpenRequest {
    /// Matches the TS `ProjectOpenSource` union in
    /// `client/src/lib/desktop/project-open-contract.ts`:
    /// `"cold-start" | "warm-start" | "deep-link" | "menu" | "drop"`.
    pub source: String,
    pub path: String,
}

#[derive(Default)]
pub struct PendingProjectOpenState {
    pub queue: Mutex<Vec<PendingProjectOpenRequest>>,
    /// `true` once the frontend calls `frontend_ready_for_project_open_requests`.
    /// Until then, all events queue. After, events emit live.
    pub frontend_ready: Mutex<bool>,
}

/// Frontend signals readiness + drains pending queue. Called once on mount
/// AFTER the listener is installed. Subsequent events emit live (and the
/// listener will pick them up).
#[tauri::command]
#[specta::specta]
pub fn frontend_ready_for_project_open_requests(
    state: State<'_, PendingProjectOpenState>,
) -> Vec<PendingProjectOpenRequest> {
    *state.frontend_ready.lock().unwrap() = true;
    let mut queue = state.queue.lock().unwrap();
    queue.drain(..).collect()
}

/// Push a request OR emit directly. Emit ONLY if frontend has signaled
/// readiness; otherwise queue. On emit failure (frontend gone, IPC error),
/// re-queue so the next drain catches it.
pub fn enqueue_or_emit(app: &tauri::AppHandle, request: PendingProjectOpenRequest) {
    let state: State<'_, PendingProjectOpenState> = app.state();
    let ready = *state.frontend_ready.lock().unwrap();

    if ready {
        if let Err(e) = app.emit("project-open-request", &request) {
            eprintln!(
                "[tauri::native_project_open] emit failed, re-queueing: {}",
                e
            );
            state.queue.lock().unwrap().push(request);
        }
    } else {
        state.queue.lock().unwrap().push(request);
    }
}

/// Extract pending requests from a process's argv (typically the
/// `std::env::args()` at startup OR the argv forwarded by single-instance
/// when a second launch happens). Filters Tauri's own `--` flags.
///
/// Returns a vector of `(source, path)` tuples ready to feed into
/// `enqueue_or_emit`.
pub fn requests_from_argv(argv: &[String], source_if_path: &str) -> Vec<PendingProjectOpenRequest> {
    let mut out = Vec::new();
    for arg in argv.iter().skip(1) {
        if arg.starts_with("--") {
            continue;
        }
        let source = if arg.starts_with("protopulse://") {
            "deep-link"
        } else {
            source_if_path
        };
        out.push(PendingProjectOpenRequest {
            source: source.to_string(),
            path: arg.clone(),
        });
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn requests_from_argv_extracts_protopulse_url() {
        let argv = vec![
            "/usr/bin/protopulse".to_string(),
            "protopulse://open?project=foo.protopulse".to_string(),
        ];
        let reqs = requests_from_argv(&argv, "cold-start");
        assert_eq!(reqs.len(), 1);
        assert_eq!(reqs[0].source, "deep-link");
        assert_eq!(reqs[0].path, "protopulse://open?project=foo.protopulse");
    }

    #[test]
    fn requests_from_argv_uses_source_for_path_args() {
        let argv = vec!["/usr/bin/protopulse".to_string(), "/tmp/foo.protopulse".to_string()];
        let reqs = requests_from_argv(&argv, "cold-start");
        assert_eq!(reqs.len(), 1);
        assert_eq!(reqs[0].source, "cold-start");
        assert_eq!(reqs[0].path, "/tmp/foo.protopulse");
    }

    #[test]
    fn requests_from_argv_skips_double_dash_flags() {
        let argv = vec![
            "/usr/bin/protopulse".to_string(),
            "--devtools".to_string(),
            "/tmp/foo.protopulse".to_string(),
        ];
        let reqs = requests_from_argv(&argv, "cold-start");
        assert_eq!(reqs.len(), 1);
        assert_eq!(reqs[0].path, "/tmp/foo.protopulse");
    }

    #[test]
    fn requests_from_argv_handles_warm_start_source() {
        let argv = vec!["irrelevant".to_string(), "/tmp/bar.protopulse".to_string()];
        let reqs = requests_from_argv(&argv, "warm-start");
        assert_eq!(reqs[0].source, "warm-start");
    }
}
