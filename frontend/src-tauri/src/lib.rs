// The shell is a window and nothing else: every screen is the Next.js export and
// every piece of data comes over REST from the backend. No commands to register,
// so there is no Rust for the frontend to call.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
