// Tauri 2 application setup. Trajectory keeps its persistence layer entirely
// frontend-side via tauri-plugin-sql (SQLite), so the Rust side only hosts
// plugins — no custom commands or state.
//
// Note: dragDropEnabled=false is set in tauri.conf.json; WebView2's native
// drag-and-drop handling would otherwise hijack HTML5 drag events used by
// the UI.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // SQLite access for all repositories (tasks, sessions, rabbit holes…).
        .plugin(tauri_plugin_sql::Builder::default().build())
        // Native OS notifications (e.g. deep-work session end).
        .plugin(tauri_plugin_notification::init())
        .run(tauri::generate_context!())
        .expect("error while running Trajectory application");
}
