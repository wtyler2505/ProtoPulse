use serde::{Deserialize, Serialize};
use std::process::Stdio;
use tauri::menu::{MenuBuilder, MenuItem, PredefinedMenuItem, SubmenuBuilder};
use tauri::{Emitter, Manager};

// ── Command payloads ────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct DialogFilter {
    pub name: String,
    pub extensions: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaveDialogResult {
    pub canceled: bool,
    #[serde(rename = "filePath")]
    pub file_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OpenDialogResult {
    pub canceled: bool,
    #[serde(rename = "filePaths")]
    pub file_paths: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SpawnResult {
    pub stdout: String,
    pub stderr: String,
    #[serde(rename = "exitCode")]
    pub exit_code: Option<i32>,
}

// ── Commands ────────────────────────────────────────────────────────────────

#[tauri::command]
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

#[tauri::command]
async fn read_file(file_path: String) -> Result<String, String> {
    tokio::fs::read_to_string(&file_path)
        .await
        .map_err(|e| format!("Failed to read file '{}': {}", file_path, e))
}

#[tauri::command]
async fn write_file(file_path: String, data: String) -> Result<(), String> {
    tokio::fs::write(&file_path, &data)
        .await
        .map_err(|e| format!("Failed to write file '{}': {}", file_path, e))
}

#[tauri::command]
async fn spawn_process(command: String, args: Vec<String>) -> Result<SpawnResult, String> {
    let output = tokio::process::Command::new(&command)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|e| format!("Failed to spawn '{}': {}", command, e))?;

    Ok(SpawnResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code(),
    })
}

#[tauri::command]
fn get_version(app: tauri::AppHandle) -> String {
    app.package_info().version.to_string()
}

#[tauri::command]
fn get_platform() -> String {
    std::env::consts::OS.to_string()
}

// ── Express server sidecar ──────────────────────────────────────────────────

fn start_express_server(app: &tauri::AppHandle) {
    // In debug (dev) mode, the Express server is started separately via `npm run dev`
    if cfg!(debug_assertions) {
        return;
    }

    let resource_dir = app
        .path()
        .resource_dir()
        .expect("Failed to resolve resource directory");
    let server_entry = resource_dir.join("dist").join("index.cjs");

    std::thread::spawn(move || {
        let mut child = std::process::Command::new("node")
            .arg(&server_entry)
            .env("NODE_ENV", "production")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .expect("Failed to start Express server");

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
    let toggle_devtools = MenuItem::with_id(app, "toggle-devtools", "Toggle Developer Tools", true, Some("CmdOrCtrl+Shift+I"))?;
    let view_menu = SubmenuBuilder::new(app, "View")
        .item(&toggle_devtools)
        .separator()
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

fn handle_menu_events(app: &tauri::AppHandle, event: &tauri::menu::MenuEvent) {
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
            let _ = tauri_plugin_opener::open_url("https://github.com/protopulse", None::<&str>);
        }
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
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            show_save_dialog,
            show_open_dialog,
            read_file,
            write_file,
            spawn_process,
            get_version,
            get_platform,
        ])
        .setup(|app| {
            setup_menu(app)?;

            // Start Express server in production builds
            start_express_server(app.handle());

            // Show the main window once the webview is ready
            let window = app.get_webview_window("main")
                .expect("Main window not found");
            let w = window.clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::ThemeChanged(_) = event {
                    // Window is ready — show it
                }
                // We use the Moved event as a proxy for "ready" since
                // Tauri v2 doesn't have a direct ready-to-show event.
                // Instead, we show immediately and rely on the background color.
            });
            w.show().unwrap_or_default();

            Ok(())
        })
        .on_menu_event(handle_menu_events)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
