fn main() {
    #[cfg(target_os = "macos")]
    {
        let swift_runtime = "/usr/lib/swift";

        if std::path::Path::new(swift_runtime).exists() {
            println!("cargo:rustc-link-arg=-Wl,-rpath,{swift_runtime}");
        }
    }

    tauri_build::build()
}
