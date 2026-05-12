// build.rs — Tauri build-time configuration.
//
// Phase 2.1 (Native Authority): use AppManifest::commands(&[...]) to declare
// the explicit allowlist of custom Rust commands callable from the webview.
// By default Tauri allows EVERY registered command (per
// https://v2.tauri.app/security/capabilities). The previous generic
// `spawn_process(command, args)` was a full RCE primitive; it is deliberately
// EXCLUDED from this allowlist. Phase 9 will add typed sidecar replacements
// (arduino_compile, etc.) that go here.

fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(
            tauri_build::AppManifest::new().commands(&[
                "frontend_ready_for_project_open_requests",
                "show_save_dialog",
                "show_open_dialog",
                "read_file",
                "write_file",
                "get_version",
                "get_platform",
            ]),
        ),
    )
    .expect("tauri_build failed");
}
