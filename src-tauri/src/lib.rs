mod audio_capture;

use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
#[cfg(not(target_os = "macos"))]
use tauri::Manager;

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
    gemini_api_key: String,
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

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            load_context,
            save_context,
            load_settings,
            save_settings,
            start_audio_capture,
            stop_audio_capture,
            get_audio_chunk,
            get_audio_capture_status
        ])
        .run(tauri::generate_context!())
        .expect("erro ao executar EntrevistAI");
}
