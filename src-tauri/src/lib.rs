use std::fs;
use std::path::PathBuf;
use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::{Emitter, Manager};

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read {}: {}", path, e))
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = PathBuf::from(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    fs::write(&path, &content).map_err(|e| format!("Failed to write {}: {}", path, e))
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
        .setup(|app| {
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
            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .item(&PredefinedMenuItem::undo(app, None)?)
                .item(&PredefinedMenuItem::redo(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::cut(app, None)?)
                .item(&PredefinedMenuItem::copy(app, None)?)
                .item(&PredefinedMenuItem::paste(app, None)?)
                .item(&PredefinedMenuItem::select_all(app, None)?)
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
        .invoke_handler(tauri::generate_handler![read_file, write_file, print_webview, export_pdf])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
