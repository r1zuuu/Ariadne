// The shell is a window and nothing else: every screen is the Next.js export and
// every piece of data comes over REST from the backend.
//
// One exception, and it is the reason this file has an invoke_handler at all:
// agent skills are directories on this machine, so no server can see them and no
// web API can reach them. skills.rs reads those directories and links them
// between tools.
mod skills;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      skills::skills_scan,
      skills::skills_link_all
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
