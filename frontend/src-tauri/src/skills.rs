// Agent skills live in directories on this machine, one directory per skill with
// a SKILL.md inside it, and every tool reads its own root. A skill sitting in one
// root is invisible to a tool that reads another, which is the whole problem this
// file solves.
//
// It solves it with a directory link, not with a copy. One directory stays the
// only copy on disk and the other roots get a door into it, so there is no second
// version, no drift, and nothing to keep in step afterwards. On Windows that door
// is a junction, which needs no privileges; on Unix it is a symlink.
//
// Two commands and nothing else: read what is on disk, and open the missing doors.

use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::{AppHandle, Manager};

/// The three roots, in the order the settings screen lists them. `agents` leads
/// because it is the vendor-neutral one and the natural home for a new skill.
const ROOTS: [(&str, &str); 3] = [
    ("agents", ".agents"),
    ("claude", ".claude"),
    ("codex", ".codex"),
];

/// The file that makes a directory a skill. A directory without one is somebody's
/// stray folder, and linking it into two more roots would spread the mess.
const MANIFEST: &str = "SKILL.md";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RootInfo {
    id: String,
    path: String,
    /// False when the tool is not installed on this machine. The screen says so
    /// rather than offering to fill a directory nothing reads.
    exists: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillEntry {
    root: String,
    name: String,
    path: String,
    /// Where this entry points, when it is a link rather than a real directory.
    /// This is what tells "Claude has its own copy" from "Claude has a door".
    link: Option<String>,
    /// Whether the directory holds a SKILL.md.
    manifest: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Scan {
    roots: Vec<RootInfo>,
    entries: Vec<SkillEntry>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkReport {
    created: Vec<Made>,
    /// Names held by a different real directory in more than one root. Two
    /// skills wearing one name, so neither is touched and a person decides.
    /// Listed once, not once per root.
    conflicts: Vec<String>,
    failed: Vec<Failed>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Made {
    root: String,
    name: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Failed {
    root: String,
    name: String,
    /// "name" when the directory name cannot be passed to the shell safely,
    /// "refused" when the system said no. Never "overwritten": this module does
    /// not overwrite and does not delete.
    reason: String,
}

fn home(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .home_dir()
        .map_err(|error| format!("no home directory: {error}"))
}

fn skills_dir(home: &Path, root: &str) -> PathBuf {
    home.join(root).join("skills")
}

/// Whether this name is safe to hand to `cmd /C mklink`.
///
/// Names come off the disk rather than out of a form, so this is not about a
/// hostile user; it is about `cmd.exe` re-parsing its own command line, where a
/// space or an `&` in a directory name turns one argument into two commands.
/// Rust's own quoting does not survive that second parse, so anything outside
/// this set is reported as skipped instead of being linked with fingers crossed.
fn linkable_name(name: &str) -> bool {
    !name.is_empty()
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == '_')
        && !name.starts_with('.')
}

/// What is on disk right now, in one call.
///
/// One level deep and no further. A skill carries scripts and reference files of
/// its own; none of them are this screen's business, and walking into a directory
/// that links back out of itself is how a scan hangs.
#[tauri::command]
pub fn skills_scan(app: AppHandle) -> Result<Scan, String> {
    scan(&home(&app)?)
}

/// The scan itself, against any home directory. Split from the command so the
/// tests below can point it at a temporary tree instead of the real one.
fn scan(home: &Path) -> Result<Scan, String> {
    let mut roots = Vec::new();
    let mut entries = Vec::new();

    for (id, dir) in ROOTS {
        let path = skills_dir(home, dir);
        let exists = path.is_dir();
        roots.push(RootInfo {
            id: id.to_string(),
            path: path.to_string_lossy().into_owned(),
            exists,
        });
        if !exists {
            continue;
        }

        // A root that cannot be read is reported as empty rather than failing the
        // whole scan: two working roots are still worth showing.
        let Ok(listing) = fs::read_dir(&path) else {
            continue;
        };

        for entry in listing.flatten() {
            let entry_path = entry.path();
            // read_link answers "is this a door" for both junctions and symlinks,
            // and errors on a real directory. That is the whole test, and it
            // avoids asking Windows about reparse-point attributes directly.
            let link = fs::read_link(&entry_path)
                .ok()
                .map(|target| target.to_string_lossy().into_owned());
            // is_dir() follows the link on purpose: a door into a real skill is
            // a skill. A link that resolves to nothing is kept anyway, with no
            // manifest, so the screen can say a door leads nowhere instead of
            // quietly showing one skill fewer than the tool sees.
            if link.is_none() && !entry_path.is_dir() {
                continue;
            }
            entries.push(SkillEntry {
                root: id.to_string(),
                name: entry.file_name().to_string_lossy().into_owned(),
                path: entry_path.to_string_lossy().into_owned(),
                manifest: entry_path.join(MANIFEST).is_file(),
                link,
            });
        }
    }

    Ok(Scan { roots, entries })
}

/// Open every missing door, in every direction.
///
/// Additive and nothing else. It never writes into a skill, never moves one, and
/// never removes anything: a name already taken in a target root is left exactly
/// as it is and reported. The worst outcome of pressing the button twice is that
/// the second press creates nothing.
#[tauri::command]
pub fn skills_link_all(app: AppHandle) -> Result<LinkReport, String> {
    link_all(&home(&app)?)
}

fn link_all(home: &Path) -> Result<LinkReport, String> {
    let scan = scan(home)?;

    // The real directories, keyed by name. A name held by a real directory in two
    // roots is two different skills wearing one name; linking either one over the
    // other would hide somebody's work, so both are left alone and reported.
    let mut sources: Vec<(String, PathBuf)> = Vec::new();
    let mut conflicting: Vec<String> = Vec::new();
    for entry in &scan.entries {
        if entry.link.is_some() || !entry.manifest {
            continue;
        }
        if sources.iter().any(|(name, _)| name == &entry.name) {
            if !conflicting.contains(&entry.name) {
                conflicting.push(entry.name.clone());
            }
            continue;
        }
        sources.push((entry.name.clone(), PathBuf::from(&entry.path)));
    }
    sources.retain(|(name, _)| !conflicting.contains(name));

    let mut report = LinkReport {
        created: Vec::new(),
        conflicts: conflicting,
        failed: Vec::new(),
    };

    for (id, dir) in ROOTS {
        let root_path = skills_dir(home, dir);
        // A root that does not exist means the tool is not installed. Creating it
        // would plant a directory for a program that is not here.
        if !root_path.is_dir() {
            continue;
        }

        for (name, source) in &sources {
            let target = root_path.join(name);
            // Already here, as a real directory or as a door. Nothing to do, and
            // nothing to report: this is the state the button is aiming at.
            if target.symlink_metadata().is_ok() {
                continue;
            }
            if !linkable_name(name) {
                report.failed.push(Failed {
                    root: id.to_string(),
                    name: name.clone(),
                    reason: "name".into(),
                });
                continue;
            }
            match make_link(&target, source) {
                Ok(()) => report.created.push(Made {
                    root: id.to_string(),
                    name: name.clone(),
                }),
                Err(_) => report.failed.push(Failed {
                    root: id.to_string(),
                    name: name.clone(),
                    reason: "refused".into(),
                }),
            }
        }
    }

    Ok(report)
}

/// A junction, not a symlink: `symlink_dir` needs administrator rights or
/// developer mode, a junction needs neither, and a junction is what the links
/// already sitting on this machine are.
#[cfg(windows)]
fn make_link(link: &Path, target: &Path) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    // Without this the child console flashes a black window over the app on every
    // single link, and this button makes dozens at a time.
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    let output = Command::new("cmd")
        .args(["/C", "mklink", "/J"])
        .arg(link)
        .arg(target)
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|error| error.to_string())?;

    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).into_owned())
    }
}

#[cfg(unix)]
fn make_link(link: &Path, target: &Path) -> Result<(), String> {
    std::os::unix::fs::symlink(target, link).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::{link_all, linkable_name, scan, MANIFEST};
    use std::fs;
    use std::path::{Path, PathBuf};

    /// A home directory of our own, so the tests never touch the real one.
    fn temp_home(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("ariadne-skills-{tag}"));
        let _ = fs::remove_dir_all(&dir);
        for root in ["agents", "claude", "codex"] {
            fs::create_dir_all(dir.join(format!(".{root}")).join("skills")).unwrap();
        }
        dir
    }

    fn put_skill(home: &Path, root: &str, name: &str, body: &str) -> PathBuf {
        let path = home.join(format!(".{root}")).join("skills").join(name);
        fs::create_dir_all(&path).unwrap();
        fs::write(path.join(MANIFEST), body).unwrap();
        path
    }

    #[test]
    fn rejects_names_that_would_break_the_shell() {
        for good in ["impeccable", "remotion-best-practices", "a", "web_vitals.v2"] {
            assert!(linkable_name(good), "{good} should be linkable");
        }
        for bad in [
            "",
            "..",
            ".hidden",
            "my skill",
            "a&calc",
            "a|b",
            "a\"b",
            "sub/dir",
            "sub\\dir",
        ] {
            assert!(!linkable_name(bad), "{bad} should be refused");
        }
    }

    /// The property the whole feature rests on: opening a door never touches the
    /// room. If this ever fails, someone reached for remove_dir_all or for a
    /// move, and pressing the button would eat the user's skills.
    #[test]
    fn linking_leaves_every_source_untouched() {
        let home = temp_home("sources");
        let body = "---\nname: impeccable\n---\nbody";
        let source = put_skill(&home, "agents", "impeccable", body);

        let report = link_all(&home).unwrap();

        assert_eq!(report.created.len(), 2, "one door per remaining root");
        assert!(report.conflicts.is_empty());
        assert!(report.failed.is_empty());
        // The real directory is still a real directory, with its file in it.
        assert!(fs::read_link(&source).is_err(), "source became a link");
        assert_eq!(fs::read_to_string(source.join(MANIFEST)).unwrap(), body);
        // And the other two roots reach that same file through their door.
        for root in ["claude", "codex"] {
            let door = home.join(format!(".{root}")).join("skills").join("impeccable");
            assert!(fs::read_link(&door).is_ok(), "{root} did not get a link");
            assert_eq!(fs::read_to_string(door.join(MANIFEST)).unwrap(), body);
        }

        // Pressing it twice is a no-op, not a second set of doors and not an error.
        assert!(link_all(&home).unwrap().created.is_empty());
    }

    /// Two different skills wearing one name. Neither may be linked over the
    /// other, and the person has to be told rather than left with one of them
    /// silently winning.
    #[test]
    fn one_name_two_real_directories_is_left_alone() {
        let home = temp_home("conflict");
        put_skill(&home, "agents", "review", "from agents");
        put_skill(&home, "claude", "review", "from claude");

        let report = link_all(&home).unwrap();

        assert_eq!(report.conflicts, vec!["review".to_string()]);
        assert!(
            report.created.is_empty(),
            "nothing may be linked under a contested name"
        );
        assert_eq!(
            fs::read_to_string(home.join(".claude/skills/review").join(MANIFEST)).unwrap(),
            "from claude",
            "the second directory was overwritten"
        );
    }

    /// A folder without a SKILL.md is somebody's stray directory, not a skill.
    #[test]
    fn skips_directories_without_a_manifest() {
        let home = temp_home("stray");
        fs::create_dir_all(home.join(".agents/skills/notes")).unwrap();
        put_skill(&home, "agents", "real", "x");

        let scanned = scan(&home).unwrap();
        assert!(scanned
            .entries
            .iter()
            .any(|entry| entry.name == "notes" && !entry.manifest));

        let report = link_all(&home).unwrap();
        assert!(report.created.iter().all(|made| made.name == "real"));
    }
}
