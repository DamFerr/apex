// Native core. Later steps add modules here: overlay, store.
mod lcu;
mod overlay;

pub fn run() {
    tauri::Builder::default()
        // Remembers window size and position between launches.
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![lcu::lcu_sync, lcu::lcu_request, overlay::set_overlay])
        .setup(|app| {
            lcu::start(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Apex");
}
