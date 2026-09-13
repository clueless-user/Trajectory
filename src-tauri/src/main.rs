// Windows entry point. Hides the console window in release builds so the app
// launches as a proper desktop binary; keep it in debug for log visibility.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    trajectory_lib::run();
}
