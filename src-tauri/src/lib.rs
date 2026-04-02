use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::{Emitter, Manager};

struct PendingFile(Mutex<Option<String>>);

fn take_pending_file_inner(pending: &Mutex<Option<String>>) -> Option<String> {
    pending.lock().unwrap().take()
}

#[tauri::command]
fn take_pending_file(state: tauri::State<'_, PendingFile>) -> Option<String> {
    take_pending_file_inner(&state.0)
}

fn read_file_inner(path: &str) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| format!("Failed to read {}: {}", path, e))
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    read_file_inner(&path)
}

fn write_file_inner(path: &str, content: &str) -> Result<(), String> {
    if let Some(parent) = PathBuf::from(path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    fs::write(path, content).map_err(|e| format!("Failed to write {}: {}", path, e))
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    write_file_inner(&path, &content)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn read_file_returns_content() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.md");
        fs::write(&path, "# Hello").unwrap();

        let result = read_file_inner(path.to_str().unwrap());
        assert_eq!(result.unwrap(), "# Hello");
    }

    #[test]
    fn read_file_error_on_missing() {
        let result = read_file_inner("/nonexistent/path/file.md");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to read"));
    }

    #[test]
    fn write_file_creates_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("output.md");

        write_file_inner(path.to_str().unwrap(), "# Test content").unwrap();

        let content = fs::read_to_string(&path).unwrap();
        assert_eq!(content, "# Test content");
    }

    #[test]
    fn write_file_creates_parent_dirs() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("sub").join("deep").join("file.md");

        write_file_inner(path.to_str().unwrap(), "nested content").unwrap();

        let content = fs::read_to_string(&path).unwrap();
        assert_eq!(content, "nested content");
    }

    #[test]
    fn write_file_overwrites_existing() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.md");
        fs::write(&path, "old content").unwrap();

        write_file_inner(path.to_str().unwrap(), "new content").unwrap();

        let content = fs::read_to_string(&path).unwrap();
        assert_eq!(content, "new content");
    }

    #[test]
    fn write_file_empty_content() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("empty.md");

        write_file_inner(path.to_str().unwrap(), "").unwrap();

        let content = fs::read_to_string(&path).unwrap();
        assert_eq!(content, "");
    }

    #[test]
    fn write_file_unicode_content() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("unicode.md");

        write_file_inner(path.to_str().unwrap(), "# Unicode: \u{1f680} \u{00e9}\u{00e8}\u{00ea}").unwrap();

        let content = fs::read_to_string(&path).unwrap();
        assert!(content.contains("\u{1f680}"));
    }

    #[test]
    fn take_pending_file_returns_some_then_none() {
        let pending = Mutex::new(Some("/path/to/file.md".to_string()));

        let first = take_pending_file_inner(&pending);
        assert_eq!(first, Some("/path/to/file.md".to_string()));

        let second = take_pending_file_inner(&pending);
        assert_eq!(second, None);
    }

    #[test]
    fn take_pending_file_returns_none_when_empty() {
        let pending = Mutex::new(None);
        assert_eq!(take_pending_file_inner(&pending), None);
    }

    #[test]
    fn read_then_write_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("roundtrip.md");
        let content = "# Roundtrip Test\n\nThis is a **test** with `code`.";

        write_file_inner(path.to_str().unwrap(), content).unwrap();
        let read_back = read_file_inner(path.to_str().unwrap()).unwrap();

        assert_eq!(read_back, content);
    }
}

#[tauri::command]
fn print_webview(webview: tauri::Webview) -> Result<(), String> {
    webview
        .with_webview(move |platform_wv| {
            #[cfg(target_os = "macos")]
            {
                use objc2_app_kit::{NSPrintInfo, NSPrintOperation};
                use objc2_foundation::NSCopying;
                use objc2_web_kit::WKWebView;

                unsafe {
                    let wk: *mut WKWebView = platform_wv.inner().cast();
                    let wk = &*wk;

                    // Copy shared print info so we don't mutate the global
                    let shared = NSPrintInfo::sharedPrintInfo();
                    let print_info: objc2::rc::Retained<NSPrintInfo> =
                        objc2::rc::Retained::cast_unchecked(shared.copy());

                    // US Letter = 612 x 792 points
                    print_info.setPaperSize(objc2_foundation::NSSize::new(612.0, 792.0));
                    // 0.75in = 54pt margins on all sides
                    print_info.setTopMargin(54.0);
                    print_info.setRightMargin(54.0);
                    print_info.setBottomMargin(54.0);
                    print_info.setLeftMargin(54.0);
                    print_info.setHorizontallyCentered(false);
                    print_info.setVerticallyCentered(false);

                    let print_op: objc2::rc::Retained<NSPrintOperation> =
                        wk.printOperationWithPrintInfo(&print_info);
                    print_op.setCanSpawnSeparateThread(true);

                    if let Some(window) = wk.window() {
                        print_op.runOperationModalForWindow_delegate_didRunSelector_contextInfo(
                            &window,
                            None,
                            None,
                            std::ptr::null_mut(),
                        );
                    }
                }
            }
        })
        .map_err(|e| format!("Print failed: {}", e))
}

#[tauri::command]
fn export_pdf(webview: tauri::Webview) -> Result<(), String> {
    webview
        .with_webview(move |platform_wv| {
            #[cfg(target_os = "macos")]
            {
                use objc2_app_kit::{NSPrintInfo, NSPrintOperation};
                use objc2_foundation::{NSCopying, NSString};
                use objc2_web_kit::WKWebView;

                unsafe {
                    let wk: *mut WKWebView = platform_wv.inner().cast();
                    let wk = &*wk;

                    let shared = NSPrintInfo::sharedPrintInfo();
                    let print_info: objc2::rc::Retained<NSPrintInfo> =
                        objc2::rc::Retained::cast_unchecked(shared.copy());

                    print_info.setPaperSize(objc2_foundation::NSSize::new(612.0, 792.0));
                    print_info.setTopMargin(54.0);
                    print_info.setRightMargin(54.0);
                    print_info.setBottomMargin(54.0);
                    print_info.setLeftMargin(54.0);
                    print_info.setHorizontallyCentered(false);
                    print_info.setVerticallyCentered(false);

                    // Set job disposition to save as PDF
                    let save_job = NSString::from_str("NSPrintSaveJob");
                    let _: () =
                        objc2::msg_send![&*print_info, setJobDisposition: &*save_job];

                    let print_op: objc2::rc::Retained<NSPrintOperation> =
                        wk.printOperationWithPrintInfo(&print_info);
                    // Hide the print panel — the system save panel will still appear
                    print_op.setShowsPrintPanel(false);
                    print_op.setCanSpawnSeparateThread(true);

                    if let Some(window) = wk.window() {
                        print_op.runOperationModalForWindow_delegate_didRunSelector_contextInfo(
                            &window,
                            None,
                            None,
                            std::ptr::null_mut(),
                        );
                    }
                }
            }
        })
        .map_err(|e| format!("PDF export failed: {}", e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(PendingFile(Mutex::new(None)))
        .setup(|app| {
            // Check if a file path was passed as a CLI argument (e.g. binary invoked directly)
            let args: Vec<String> = std::env::args().collect();
            if args.len() > 1 {
                let path = PathBuf::from(&args[1]);
                if path.exists() && path.is_file() {
                    if let Some(state) = app.try_state::<PendingFile>() {
                        *state.0.lock().unwrap() = Some(args[1].clone());
                    }
                }
            }

            // File menu
            let new_file = MenuItemBuilder::with_id("new", "New")
                .accelerator("CmdOrCtrl+N")
                .build(app)?;
            let open = MenuItemBuilder::with_id("open", "Open...")
                .accelerator("CmdOrCtrl+O")
                .build(app)?;
            let save = MenuItemBuilder::with_id("save", "Save")
                .accelerator("CmdOrCtrl+S")
                .build(app)?;
            let save_as = MenuItemBuilder::with_id("save_as", "Save As...")
                .accelerator("CmdOrCtrl+Shift+S")
                .build(app)?;
            let export_html = MenuItemBuilder::with_id("export_html", "Export HTML...")
                .accelerator("CmdOrCtrl+Shift+E")
                .build(app)?;
            let export_pdf = MenuItemBuilder::with_id("export_pdf", "Export PDF...")
                .build(app)?;
            let print = MenuItemBuilder::with_id("print", "Print...")
                .accelerator("CmdOrCtrl+P")
                .build(app)?;

            let file_menu = SubmenuBuilder::new(app, "File")
                .item(&new_file)
                .item(&open)
                .separator()
                .item(&save)
                .item(&save_as)
                .separator()
                .item(&export_html)
                .item(&export_pdf)
                .item(&print)
                .separator()
                .item(&PredefinedMenuItem::close_window(app, None)?)
                .build()?;

            // Edit menu
            let find = MenuItemBuilder::with_id("find", "Find...")
                .accelerator("CmdOrCtrl+F")
                .build(app)?;
            let find_replace = MenuItemBuilder::with_id("find_replace", "Find and Replace...")
                .accelerator("CmdOrCtrl+Alt+F")
                .build(app)?;
            let find_next = MenuItemBuilder::with_id("find_next", "Find Next")
                .accelerator("CmdOrCtrl+G")
                .build(app)?;
            let find_prev = MenuItemBuilder::with_id("find_prev", "Find Previous")
                .accelerator("CmdOrCtrl+Shift+G")
                .build(app)?;

            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .item(&PredefinedMenuItem::undo(app, None)?)
                .item(&PredefinedMenuItem::redo(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::cut(app, None)?)
                .item(&PredefinedMenuItem::copy(app, None)?)
                .item(&PredefinedMenuItem::paste(app, None)?)
                .item(&PredefinedMenuItem::select_all(app, None)?)
                .separator()
                .item(&find)
                .item(&find_replace)
                .separator()
                .item(&find_next)
                .item(&find_prev)
                .build()?;

            // View menu
            let view_editor = MenuItemBuilder::with_id("view_editor", "Editor Only")
                .build(app)?;
            let view_hsplit = MenuItemBuilder::with_id("view_hsplit", "Split Horizontal")
                .build(app)?;
            let view_vsplit = MenuItemBuilder::with_id("view_vsplit", "Split Vertical")
                .build(app)?;
            let view_preview = MenuItemBuilder::with_id("view_preview", "Preview Only")
                .build(app)?;
            let view_swap = MenuItemBuilder::with_id("view_swap", "Swap Panes")
                .build(app)?;

            let view_menu = SubmenuBuilder::new(app, "View")
                .item(&view_editor)
                .item(&view_hsplit)
                .item(&view_vsplit)
                .item(&view_preview)
                .separator()
                .item(&view_swap)
                .separator()
                .item(&PredefinedMenuItem::fullscreen(app, None)?)
                .build()?;

            // Format menu
            let bold = MenuItemBuilder::with_id("format_bold", "Bold")
                .accelerator("CmdOrCtrl+B")
                .build(app)?;
            let italic = MenuItemBuilder::with_id("format_italic", "Italic")
                .accelerator("CmdOrCtrl+I")
                .build(app)?;
            let strikethrough = MenuItemBuilder::with_id("format_strike", "Strikethrough")
                .accelerator("CmdOrCtrl+Shift+X")
                .build(app)?;
            let code = MenuItemBuilder::with_id("format_code", "Inline Code")
                .accelerator("CmdOrCtrl+Shift+C")
                .build(app)?;

            let format_menu = SubmenuBuilder::new(app, "Format")
                .item(&bold)
                .item(&italic)
                .item(&strikethrough)
                .item(&code)
                .build()?;

            // Window menu
            let window_menu = SubmenuBuilder::new(app, "Window")
                .item(&PredefinedMenuItem::minimize(app, None)?)
                .item(&PredefinedMenuItem::maximize(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::close_window(app, None)?)
                .build()?;

            // App menu (macOS)
            let app_menu = SubmenuBuilder::new(app, "Mark Down")
                .item(&PredefinedMenuItem::about(app, None, None)?)
                .separator()
                .item(&PredefinedMenuItem::services(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::hide(app, None)?)
                .item(&PredefinedMenuItem::hide_others(app, None)?)
                .item(&PredefinedMenuItem::show_all(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::quit(app, None)?)
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&app_menu)
                .item(&file_menu)
                .item(&edit_menu)
                .item(&view_menu)
                .item(&format_menu)
                .item(&window_menu)
                .build()?;

            app.set_menu(menu)?;

            // Handle menu events
            app.on_menu_event(move |app_handle, event| {
                let id = event.id().0.to_string();
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.emit("menu-event", &id);
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![read_file, write_file, print_webview, export_pdf, take_pending_file])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, _event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = &_event {
                for url in urls {
                    let path: PathBuf = match url.to_file_path() {
                        Ok(p) => p,
                        Err(_) => continue,
                    };
                    let path_str = match path.to_str() {
                        Some(s) => s.to_string(),
                        None => continue,
                    };
                    if let Some(window) = _app_handle.get_webview_window("main") {
                        let _ = window.emit("file-open", &path_str);
                    }
                    if let Some(state) = _app_handle.try_state::<PendingFile>() {
                        *state.0.lock().unwrap() = Some(path_str);
                    }
                }
            }
        });
}
