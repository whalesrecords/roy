#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use tauri::{Manager, WindowBuilder, WindowUrl};

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let url = std::env::var("ROYALTIES_URL")
                .unwrap_or_else(|_| "http://localhost:3000".to_string());

            WindowBuilder::new(
                app,
                "main",
                WindowUrl::External(url.parse().unwrap())
            )
            .title("Royalties - Whales Music")
            .inner_size(1200.0, 800.0)
            .min_inner_size(900.0, 600.0)
            .build()?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
