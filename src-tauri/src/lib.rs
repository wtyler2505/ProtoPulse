use serde::{Deserialize, Serialize};
use specta::Type;
use std::process::Stdio;
use tauri::menu::{MenuBuilder, MenuItem, PredefinedMenuItem, SubmenuBuilder};
use tauri::{Emitter, Manager};
use tauri_specta::{collect_commands, Builder};

// Phase 2.2 (R4 retro): scoped path validation for custom file commands.
mod path_validation;

// Phase 4.2 (R4 retro Wave 5): native project-open lifecycle bridge
// (cold-start + deep-link + single-instance forwarding → frontend listener).
mod native_project_open;

// ── Command payloads ────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct DialogFilter {
    pub name: String,
    pub extensions: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct SaveDialogResult {
    pub canceled: bool,
    #[serde(rename = "filePath")]
    pub file_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct OpenDialogResult {
    pub canceled: bool,
    #[serde(rename = "filePaths")]
    pub file_paths: Vec<String>,
}

// ── Commands ────────────────────────────────────────────────────────────────

#[tauri::command]
#[specta::specta]
async fn show_save_dialog(
    app: tauri::AppHandle,
    title: Option<String>,
    default_path: Option<String>,
    filters: Option<Vec<DialogFilter>>,
) -> Result<SaveDialogResult, String> {
    use tauri_plugin_dialog::DialogExt;

    let mut builder = app.dialog().file();

    if let Some(t) = title {
        builder = builder.set_title(t);
    }
    if let Some(p) = default_path {
        builder = builder.set_file_name(p);
    }
    if let Some(filters) = filters {
        for f in filters {
            let exts: Vec<&str> = f.extensions.iter().map(|s| s.as_str()).collect();
            builder = builder.add_filter(f.name, &exts);
        }
    }

    let (tx, rx) = std::sync::mpsc::channel();
    builder.save_file(move |path| {
        let result = match path {
            Some(p) => SaveDialogResult {
                canceled: false,
                file_path: Some(p.to_string()),
            },
            None => SaveDialogResult {
                canceled: true,
                file_path: None,
            },
        };
        let _ = tx.send(result);
    });

    rx.recv()
        .map_err(|e| format!("Dialog channel error: {}", e))
}

#[tauri::command]
#[specta::specta]
async fn show_open_dialog(
    app: tauri::AppHandle,
    title: Option<String>,
    default_path: Option<String>,
    filters: Option<Vec<DialogFilter>>,
    properties: Option<Vec<String>>,
) -> Result<OpenDialogResult, String> {
    use tauri_plugin_dialog::DialogExt;

    let mut builder = app.dialog().file();

    if let Some(t) = title {
        builder = builder.set_title(t);
    }
    if let Some(p) = default_path {
        builder = builder.set_file_name(p);
    }
    if let Some(filters) = filters {
        for f in filters {
            let exts: Vec<&str> = f.extensions.iter().map(|s| s.as_str()).collect();
            builder = builder.add_filter(f.name, &exts);
        }
    }

    let multi = properties
        .as_ref()
        .map(|p| p.iter().any(|s| s == "multiSelections"))
        .unwrap_or(false);

    let pick_dir = properties
        .as_ref()
        .map(|p| p.iter().any(|s| s == "openDirectory"))
        .unwrap_or(false);

    if pick_dir {
        let (tx, rx) = std::sync::mpsc::channel();
        builder.pick_folder(move |path| {
            let result = match path {
                Some(p) => OpenDialogResult {
                    canceled: false,
                    file_paths: vec![p.to_string()],
                },
                None => OpenDialogResult {
                    canceled: true,
                    file_paths: vec![],
                },
            };
            let _ = tx.send(result);
        });
        return rx
            .recv()
            .map_err(|e| format!("Dialog channel error: {}", e));
    }

    if multi {
        let (tx, rx) = std::sync::mpsc::channel();
        builder.pick_files(move |paths| {
            let result = match paths {
                Some(ps) => OpenDialogResult {
                    canceled: false,
                    file_paths: ps.iter().map(|p| p.to_string()).collect(),
                },
                None => OpenDialogResult {
                    canceled: true,
                    file_paths: vec![],
                },
            };
            let _ = tx.send(result);
        });
        return rx
            .recv()
            .map_err(|e| format!("Dialog channel error: {}", e));
    }

    let (tx, rx) = std::sync::mpsc::channel();
    builder.pick_file(move |path| {
        let result = match path {
            Some(p) => OpenDialogResult {
                canceled: false,
                file_paths: vec![p.to_string()],
            },
            None => OpenDialogResult {
                canceled: true,
                file_paths: vec![],
            },
        };
        let _ = tx.send(result);
    });

    rx.recv()
        .map_err(|e| format!("Dialog channel error: {}", e))
}

// Phase 2.2 (R4 retro): scope-validated read/write.
//
// The custom #[tauri::command] commands `read_file` and `write_file` are
// NOT protected by `tauri-plugin-fs` capability scopes — capabilities only
// cover plugin-fs calls. These commands run their own validation via
// `crate::path_validation::*` before any I/O happens. The read/write open
// uses `O_NOFOLLOW` / `FILE_FLAG_OPEN_REPARSE_POINT` so a symlink leaf
// planted between validate and open cannot be silently traversed.
//
// Per Codex R6 acceptance guard: the read MUST happen through the no-follow
// handle (not a path-based `tokio::fs::read_to_string` after a probe).
#[tauri::command]
#[specta::specta]
async fn read_file(app: tauri::AppHandle, file_path: String) -> Result<String, String> {
    let canonical = path_validation::validate_existing_read_path(
        &app,
        &file_path,
        path_validation::ReadIntent::Generic,
    )
    .map_err(|e| e.to_string())?;

    // Size check via metadata BEFORE opening — fail fast on oversized files.
    let meta = std::fs::metadata(&canonical)
        .map_err(|e| format!("Failed to stat file: {}", e))?;
    if meta.len() > path_validation::MAX_READ_SIZE_BYTES {
        return Err(format!(
            "File too large: {} bytes > max {}",
            meta.len(),
            path_validation::MAX_READ_SIZE_BYTES
        ));
    }

    // Open with no-follow; read through the OPENED HANDLE (not path-based).
    let std_file = path_validation::open_no_follow_read(&canonical)
        .map_err(|e| e.to_string())?;
    let bytes = tokio::task::spawn_blocking(move || -> std::io::Result<Vec<u8>> {
        use std::io::Read as _;
        let mut buf = Vec::new();
        let mut f = std_file;
        f.read_to_end(&mut buf)?;
        Ok(buf)
    })
    .await
    .map_err(|e| format!("Join error: {}", e))?
    .map_err(|e| format!("Read failed: {}", e))?;

    String::from_utf8(bytes).map_err(|e| format!("File is not valid UTF-8: {}", e))
}

#[tauri::command]
#[specta::specta]
async fn write_file(
    app: tauri::AppHandle,
    file_path: String,
    data: String,
) -> Result<(), String> {
    let intent = path_validation::write_intent_from_extension(&file_path);
    let canonical = path_validation::validate_new_write_path(&app, &file_path, intent)
        .map_err(|e| e.to_string())?;

    let canonical_for_blocking = canonical.clone();
    let data_owned = data;
    tokio::task::spawn_blocking(move || -> Result<(), path_validation::PathValidationError> {
        use std::io::Write as _;
        let mut f = path_validation::open_no_follow_write(&canonical_for_blocking)?;
        f.write_all(data_owned.as_bytes())
            .map_err(|e| path_validation::PathValidationError::WriteFailed(e.to_string()))?;
        f.sync_all()
            .map_err(|e| path_validation::PathValidationError::WriteFailed(e.to_string()))?;
        Ok(())
    })
    .await
    .map_err(|e| format!("Join error: {}", e))?
    .map_err(|e| e.to_string())
}

// `spawn_process` was removed in Phase 2.1 (Native Authority). The previous
// `spawn_process(command, args)` was a generic process primitive with no
// allowlist, timeout, cwd/env control, or output cap — a full RCE primitive
// reachable from any compromised webview script. Phase 9 (Hardware Authority)
// will add typed sidecar replacements (e.g., `arduino_compile(sketch_path)`,
// `arduino_upload(port, fqbn, hex_path)`) with strict argument validation,
// path scopes, and timeouts.

#[tauri::command]
#[specta::specta]
fn get_version(app: tauri::AppHandle) -> String {
    app.package_info().version.to_string()
}

#[tauri::command]
#[specta::specta]
fn get_platform() -> String {
    std::env::consts::OS.to_string()
}

// ── tauri-specta Builder factory ────────────────────────────────────────────
//
// Single source of truth for the command set. Used by both the live `run()`
// app and the standalone `export_bindings` binary so generated bindings.ts
// never drifts from the registered command list.
pub fn specta_builder() -> Builder<tauri::Wry> {
    Builder::<tauri::Wry>::new().commands(collect_commands![
        native_project_open::frontend_ready_for_project_open_requests,
        show_save_dialog,
        show_open_dialog,
        read_file,
        write_file,
        get_version,
        get_platform,
    ])
}

// ── Express server sidecar ──────────────────────────────────────────────────
//
// Per `docs/decisions/2026-05-10-adr-tauri-runtime-topology.md` (Path C), the
// desktop runtime does NOT hard-require the Express sidecar. If `dist/index.cjs`
// exists in the resource dir, we spawn Node against it for backend compatibility;
// if it is absent, we log a warning and continue without Express. Desktop-
// privileged work routes through typed Rust commands instead.
//
// A future Phase 3 decision will resolve whether Express is retired, kept as a
// scoped sidecar with target triples + signing, or moved fully to native Rust.

fn start_express_server(app: &tauri::AppHandle) {
    // In debug (dev) mode, the Express server is started separately via `npm run dev`
    if cfg!(debug_assertions) {
        return;
    }

    let resource_dir = match app.path().resource_dir() {
        Ok(dir) => dir,
        Err(e) => {
            eprintln!(
                "[tauri] Could not resolve resource directory; skipping Express sidecar: {}",
                e
            );
            return;
        }
    };
    let server_entry = resource_dir.join("dist").join("index.cjs");

    if !server_entry.exists() {
        eprintln!(
            "[tauri] Express sidecar binary not found at {} — continuing without sidecar. \
            Per Path C topology, desktop runtime does not hard-require this. \
            If you need the Express sidecar, run `npm run build` to produce dist/index.cjs.",
            server_entry.display()
        );
        return;
    }

    std::thread::spawn(move || {
        let mut child = match std::process::Command::new("node")
            .arg(&server_entry)
            .env("NODE_ENV", "production")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
        {
            Ok(child) => child,
            Err(e) => {
                eprintln!(
                    "[tauri] Failed to spawn Express sidecar via global `node`: {}. \
                    The desktop app will continue without the Express sidecar.",
                    e
                );
                return;
            }
        };

        // Log stdout
        if let Some(stdout) = child.stdout.take() {
            std::thread::spawn(move || {
                use std::io::BufRead;
                let reader = std::io::BufReader::new(stdout);
                for line in reader.lines() {
                    if let Ok(line) = line {
                        println!("[server] {}", line);
                    }
                }
            });
        }

        // Log stderr
        if let Some(stderr) = child.stderr.take() {
            std::thread::spawn(move || {
                use std::io::BufRead;
                let reader = std::io::BufReader::new(stderr);
                for line in reader.lines() {
                    if let Ok(line) = line {
                        eprintln!("[server] {}", line);
                    }
                }
            });
        }

        // Wait for process to exit (keeps child alive)
        let _ = child.wait();
    });
}

// ── Menu ────────────────────────────────────────────────────────────────────

fn setup_menu(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // ── File submenu ────────────────────────────────────────────────────
    let new_project = MenuItem::with_id(app, "new-project", "New Project", true, Some("CmdOrCtrl+N"))?;
    let open_project = MenuItem::with_id(app, "open-project", "Open Project\u{2026}", true, Some("CmdOrCtrl+O"))?;
    let save = MenuItem::with_id(app, "save", "Save", true, Some("CmdOrCtrl+S"))?;

    let file_menu = SubmenuBuilder::new(app, "File")
        .item(&new_project)
        .item(&open_project)
        .item(&save)
        .separator()
        .quit()
        .build()?;

    // ── Edit submenu ────────────────────────────────────────────────────
    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    // ── View submenu ────────────────────────────────────────────────────
    // Phase 6.1: the "Toggle Developer Tools" menu item only ships in debug
    // builds. Release builds get a View menu without it.
    #[cfg(debug_assertions)]
    let toggle_devtools = MenuItem::with_id(app, "toggle-devtools", "Toggle Developer Tools", true, Some("CmdOrCtrl+Shift+I"))?;

    #[cfg(debug_assertions)]
    let view_menu = SubmenuBuilder::new(app, "View")
        .item(&toggle_devtools)
        .separator()
        .item(&PredefinedMenuItem::fullscreen(app, None)?)
        .build()?;

    #[cfg(not(debug_assertions))]
    let view_menu = SubmenuBuilder::new(app, "View")
        .item(&PredefinedMenuItem::fullscreen(app, None)?)
        .build()?;

    // ── Help submenu ────────────────────────────────────────────────────
    let about = MenuItem::with_id(app, "about", "About ProtoPulse", true, None::<&str>)?;
    let learn_more = MenuItem::with_id(app, "learn-more", "Learn More", true, None::<&str>)?;

    let help_menu = SubmenuBuilder::new(app, "Help")
        .item(&about)
        .separator()
        .item(&learn_more)
        .build()?;

    // ── Build & set ─────────────────────────────────────────────────────
    let menu = MenuBuilder::new(app)
        .item(&file_menu)
        .item(&edit_menu)
        .item(&view_menu)
        .item(&help_menu)
        .build()?;

    app.set_menu(menu)?;

    Ok(())
}

fn handle_menu_events(app: &tauri::AppHandle, event: tauri::menu::MenuEvent) {
    match event.id().0.as_str() {
        "new-project" => {
            let _ = app.emit("menu:new-project", ());
        }
        "open-project" => {
            let _ = app.emit("menu:open-project", ());
        }
        "save" => {
            let _ = app.emit("menu:save", ());
        }
        "about" => {
            use tauri_plugin_dialog::DialogExt;
            let version = app.package_info().version.to_string();
            app.dialog()
                .message(format!(
                    "ProtoPulse v{}\n\nAI-assisted EDA platform for makers, hobbyists, and embedded engineers.",
                    version
                ))
                .title("About ProtoPulse")
                .blocking_show();
        }
        "learn-more" => {
            use tauri_plugin_opener::OpenerExt;
            let _ = app.opener().open_url("https://github.com/protopulse", None::<&str>);
        }
        // Phase 6.1: devtools menu handler only compiles in debug builds.
        #[cfg(debug_assertions)]
        "toggle-devtools" => {
            if let Some(window) = app.get_webview_window("main") {
                if window.is_devtools_open() {
                    window.close_devtools();
                } else {
                    window.open_devtools();
                }
            }
        }
        _ => {}
    }
}

// ── App entry point ─────────────────────────────────────────────────────────

pub fn run() {
    let specta = specta_builder();

    // Re-export TypeScript bindings on every debug startup so adding/removing
    // a Rust #[tauri::command] surfaces the diff in client/src/lib/bindings.ts
    // before the frontend can drift. Production builds skip the export — they
    // ship with whatever bindings.ts was committed at release time.
    #[cfg(debug_assertions)]
    {
        use specta_typescript::Typescript;
        if let Err(e) = specta.export(
            Typescript::default().header("/* eslint-disable */\n// Generated by tauri-specta — do not edit.\n"),
            "../client/src/lib/bindings.ts",
        ) {
            eprintln!("[tauri-specta] Failed to export bindings.ts: {}", e);
        }
    }

    let mut builder = tauri::Builder::default()
        // R4 retro Wave 5: managed state for the project-open lifecycle bridge.
        // Created BEFORE single-instance plugin so the handler can access the
        // queue/ready state via app.state().
        .manage(native_project_open::PendingProjectOpenState::default());

    // Phase 4.2 lifecycle: single-instance MUST be registered before deep-link
    // so .protopulse file associations + protopulse:// URLs route through one
    // running app instance via argv forwarding on Linux/Windows. Requires
    // tauri-plugin-single-instance features = ["deep-link"] (set in Cargo.toml).
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // Warm-start: another instance was launched with argv (possibly
            // a .protopulse path or protopulse:// URL). Route through the
            // project-open queue.
            let argv_strings: Vec<String> = argv.iter().map(|s| s.clone()).collect();
            for req in
                native_project_open::requests_from_argv(&argv_strings, "warm-start")
            {
                native_project_open::enqueue_or_emit(app, req);
            }
        }));
    }

    builder = builder
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_window_state::Builder::new().build());

    builder
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(specta.invoke_handler())
        .setup(|app| {
            setup_menu(app)?;

            // R4 retro Wave 5: capture cold-start argv (initial launch) and
            // register the deep-link runtime callback. Both feed the
            // project-open queue; the frontend drains via the
            // frontend_ready_for_project_open_requests command on mount.
            #[cfg(desktop)]
            {
                let cold_argv: Vec<String> = std::env::args().collect();
                for req in native_project_open::requests_from_argv(&cold_argv, "cold-start") {
                    native_project_open::enqueue_or_emit(app.handle(), req);
                }

                // Deep-link callback per official Tauri Rust API
                // (https://v2.tauri.app/plugin/deep-linking/, verified 2026-05-12).
                use tauri_plugin_deep_link::DeepLinkExt;
                let app_handle = app.handle().clone();
                app.deep_link().on_open_url(move |event| {
                    for url in event.urls() {
                        let req = native_project_open::PendingProjectOpenRequest {
                            source: "deep-link".to_string(),
                            path: url.to_string(),
                        };
                        native_project_open::enqueue_or_emit(&app_handle, req);
                    }
                });
            }

            // Start Express server in production builds
            start_express_server(app.handle());

            // Show the main window (configured as visible: false in tauri.conf.json)
            if let Some(window) = app.get_webview_window("main") {
                window.show().unwrap_or_default();
            }

            Ok(())
        })
        .on_menu_event(handle_menu_events)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
