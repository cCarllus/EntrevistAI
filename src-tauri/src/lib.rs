mod audio_capture;

use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
#[cfg(not(target_os = "macos"))]
use tauri::Manager;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager as _, WindowEvent,
};

const MAIN_WINDOW_LABEL: &str = "main";
const SHORTCUT_EVENT: &str = "entrevistai://shortcut";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    role: String,
    content: String,
    created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InterviewContext {
    cv_text: String,
    cv_file_name: Option<String>,
    job_text: String,
    job_file_name: Option<String>,
    chat_messages: Vec<ChatMessage>,
    updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(default)]
    gemini_api_key: String,
    #[serde(default = "default_opacity_percent")]
    opacity_percent: u8,
    #[serde(default = "default_always_on_top")]
    always_on_top: bool,
    #[serde(default)]
    has_seen_interview_intro: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ShortcutPayload {
    action: &'static str,
}

impl Default for InterviewContext {
    fn default() -> Self {
        Self {
            cv_text: String::new(),
            cv_file_name: None,
            job_text: String::new(),
            job_file_name: None,
            chat_messages: Vec::new(),
            updated_at: String::new(),
        }
    }
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            gemini_api_key: String::new(),
            opacity_percent: default_opacity_percent(),
            always_on_top: default_always_on_top(),
            has_seen_interview_intro: false,
        }
    }
}

#[tauri::command]
fn load_context(app: tauri::AppHandle) -> Result<InterviewContext, String> {
    read_json(context_path(&app)?, InterviewContext::default())
}

#[tauri::command]
fn save_context(app: tauri::AppHandle, context: InterviewContext) -> Result<(), String> {
    write_json(context_path(&app)?, &context)
}

#[tauri::command]
fn load_settings(app: tauri::AppHandle) -> Result<AppSettings, String> {
    read_json(settings_path(&app)?, AppSettings::default())
}

#[tauri::command]
fn save_settings(app: tauri::AppHandle, settings: AppSettings) -> Result<(), String> {
    write_json(settings_path(&app)?, &settings)
}

#[tauri::command]
fn start_audio_capture() -> Result<String, String> {
    audio_capture::start_audio_capture()
}

#[tauri::command]
fn stop_audio_capture() -> Result<String, String> {
    audio_capture::stop_audio_capture()
}

#[tauri::command]
fn get_audio_chunk() -> Vec<f32> {
    audio_capture::get_audio_chunk()
}

#[tauri::command]
fn get_audio_capture_status() -> audio_capture::AudioCaptureStatus {
    audio_capture::get_audio_capture_status()
}

#[tauri::command]
fn show_main_window(app: tauri::AppHandle) {
    show_main_window_impl(&app);
}

#[tauri::command]
fn hide_main_window(app: tauri::AppHandle) {
    hide_main_window_impl(&app);
}

#[tauri::command]
fn toggle_main_window(app: tauri::AppHandle) {
    toggle_main_window_impl(&app);
}

fn default_opacity_percent() -> u8 {
    90
}

fn default_always_on_top() -> bool {
    true
}

fn context_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join("context.json"))
}

fn settings_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join("settings.json"))
}

fn app_data_dir(_app: &tauri::AppHandle) -> Result<PathBuf, String> {
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var_os("HOME")
            .ok_or_else(|| "Não foi possível localizar a pasta HOME do usuário.".to_string())?;

        return Ok(PathBuf::from(home)
            .join("Library")
            .join("Application Support")
            .join("EntrevistAI"));
    }

    #[cfg(not(target_os = "macos"))]
    {
        _app.path()
            .app_data_dir()
            .map_err(|error| format!("Não foi possível localizar a pasta do aplicativo: {error}"))
    }
}

fn read_json<T>(path: PathBuf, fallback: T) -> Result<T, String>
where
    T: for<'de> Deserialize<'de>,
{
    if !path.exists() {
        return Ok(fallback);
    }

    let contents = fs::read_to_string(&path)
        .map_err(|error| format!("Não foi possível ler {}: {error}", path.display()))?;

    serde_json::from_str(&contents)
        .map_err(|error| format!("Não foi possível interpretar {}: {error}", path.display()))
}

fn write_json<T>(path: PathBuf, value: &T) -> Result<(), String>
where
    T: Serialize,
{
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Não foi possível criar {}: {error}", parent.display()))?;
    }

    let contents = serde_json::to_string_pretty(value)
        .map_err(|error| format!("Não foi possível serializar JSON: {error}"))?;

    fs::write(&path, contents)
        .map_err(|error| format!("Não foi possível salvar {}: {error}", path.display()))
}

fn setup_tray(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let show_i = MenuItem::with_id(app, "show", "Mostrar EntrevistAI", true, None::<&str>)?;
    let hide_i = MenuItem::with_id(app, "hide", "Esconder janela", true, None::<&str>)?;
    let quit_i = MenuItem::with_id(app, "quit", "Sair", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_i, &hide_i, &quit_i])?;

    let mut tray_builder = TrayIconBuilder::new()
        .tooltip("EntrevistAI")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_main_window_impl(app),
            "hide" => hide_main_window_impl(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_main_window_impl(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        tray_builder = tray_builder.icon(icon.clone());
    }

    tray_builder.build(app)?;
    Ok(())
}

#[cfg(desktop)]
fn setup_global_shortcuts(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri_plugin_global_shortcut::{
        Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
    };

    #[cfg(target_os = "macos")]
    let command_modifier = Modifiers::SUPER;
    #[cfg(not(target_os = "macos"))]
    let command_modifier = Modifiers::CONTROL;

    let toggle_interview = Shortcut::new(Some(command_modifier | Modifiers::SHIFT), Code::KeyI);
    let new_suggestion = Shortcut::new(Some(command_modifier), Code::KeyK);
    let copy_response = Shortcut::new(Some(command_modifier), Code::KeyC);
    let toggle_window = Shortcut::new(Some(command_modifier | Modifiers::SHIFT), Code::KeyH);

    let toggle_interview_handler = toggle_interview.clone();
    let new_suggestion_handler = new_suggestion.clone();
    let copy_response_handler = copy_response.clone();
    let toggle_window_handler = toggle_window.clone();

    app.handle().plugin(
        tauri_plugin_global_shortcut::Builder::new()
            .with_handler(move |app, shortcut, event| {
                if event.state() != ShortcutState::Pressed {
                    return;
                }

                if shortcut == &toggle_interview_handler {
                    emit_shortcut(app, "toggle_interview");
                } else if shortcut == &new_suggestion_handler {
                    emit_shortcut(app, "new_suggestion");
                } else if shortcut == &copy_response_handler {
                    emit_shortcut(app, "copy_response");
                } else if shortcut == &toggle_window_handler {
                    toggle_main_window_impl(app);
                    emit_shortcut(app, "toggle_window");
                }
            })
            .build(),
    )?;

    for shortcut in [toggle_interview, new_suggestion, copy_response, toggle_window] {
        if let Err(error) = app.global_shortcut().register(shortcut) {
            eprintln!("Não foi possível registrar atalho global {shortcut:?}: {error}");
        }
    }

    Ok(())
}

#[cfg(not(desktop))]
fn setup_global_shortcuts(_app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    Ok(())
}

fn emit_shortcut(app: &tauri::AppHandle, action: &'static str) {
    let _ = app.emit(SHORTCUT_EVENT, ShortcutPayload { action });
}

fn show_main_window_impl(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        let _ = window.set_skip_taskbar(false);
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn hide_main_window_impl(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        let _ = window.set_skip_taskbar(true);
        let _ = window.hide();
    }
}

fn toggle_main_window_impl(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        let is_visible = window.is_visible().unwrap_or(false);

        if is_visible {
            let _ = window.set_skip_taskbar(true);
            let _ = window.hide();
        } else {
            let _ = window.set_skip_taskbar(false);
            let _ = window.unminimize();
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            setup_tray(app)?;
            setup_global_shortcuts(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.set_skip_taskbar(true);
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            load_context,
            save_context,
            load_settings,
            save_settings,
            start_audio_capture,
            stop_audio_capture,
            get_audio_chunk,
            get_audio_capture_status,
            show_main_window,
            hide_main_window,
            toggle_main_window
        ])
        .run(tauri::generate_context!())
        .expect("erro ao executar EntrevistAI");
}
