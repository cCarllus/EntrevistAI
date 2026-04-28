use once_cell::sync::Lazy;
use ringbuf::{
    traits::{Consumer, Observer, Producer, Split},
    HeapCons, HeapProd, HeapRb,
};
use serde::Serialize;
use std::sync::{Arc, Mutex};

const GEMINI_SAMPLE_RATE: usize = 16_000;
const CHUNK_SECONDS: f32 = 0.5;
const CHUNK_SAMPLES: usize = (GEMINI_SAMPLE_RATE as f32 * CHUNK_SECONDS) as usize;
const BUFFER_SECONDS: usize = 30;
const BUFFER_CAPACITY: usize = GEMINI_SAMPLE_RATE * BUFFER_SECONDS;

static CAPTURE_STATE: Lazy<Mutex<CaptureState>> = Lazy::new(|| {
    Mutex::new(CaptureState {
        session: None,
        status: AudioStatusKind::Stopped,
        last_error: None,
        last_amplitude: 0.0,
    })
});

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioCaptureStatus {
    pub status: AudioStatusKind,
    pub message: String,
    pub last_amplitude: f32,
    pub sample_rate: usize,
    pub channels: usize,
    pub chunk_samples: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum AudioStatusKind {
    Listening,
    Stopped,
    Error,
}

struct CaptureState {
    session: Option<ActiveCapture>,
    status: AudioStatusKind,
    last_error: Option<String>,
    last_amplitude: f32,
}

#[cfg(target_os = "macos")]
struct ActiveCapture {
    stream: screencapturekit::stream::SCStream,
    buffer: Arc<SharedAudioBuffer>,
    _content: screencapturekit::shareable_content::SCShareableContent,
    _filter: screencapturekit::stream::content_filter::SCContentFilter,
    _config: screencapturekit::stream::configuration::SCStreamConfiguration,
    _queue: screencapturekit::dispatch_queue::DispatchQueue,
}

#[cfg(not(target_os = "macos"))]
struct ActiveCapture {
    buffer: Arc<SharedAudioBuffer>,
}

struct SharedAudioBuffer {
    producer: Mutex<HeapProd<f32>>,
    consumer: Mutex<HeapCons<f32>>,
    capacity: usize,
}

impl SharedAudioBuffer {
    fn new(capacity: usize) -> Arc<Self> {
        let ring = HeapRb::<f32>::new(capacity);
        let (producer, consumer) = ring.split();

        Arc::new(Self {
            producer: Mutex::new(producer),
            consumer: Mutex::new(consumer),
            capacity,
        })
    }

    fn push_overwriting_oldest(&self, samples: &[f32]) {
        if samples.is_empty() {
            return;
        }

        let samples = if samples.len() > self.capacity {
            &samples[samples.len() - self.capacity..]
        } else {
            samples
        };

        let mut consumer = self.consumer.lock().expect("audio consumer lock poisoned");
        let mut producer = self.producer.lock().expect("audio producer lock poisoned");
        let overflow = samples.len().saturating_sub(producer.vacant_len());

        for _ in 0..overflow {
            let _ = consumer.try_pop();
        }

        let written = producer.push_slice(samples);
        if written < samples.len() {
            eprintln!(
                "EntrevistAI audio buffer dropped {} samples",
                samples.len() - written
            );
        }
    }

    fn pop_chunk(&self, max_samples: usize) -> Vec<f32> {
        let available = self
            .consumer
            .lock()
            .expect("audio consumer lock poisoned")
            .occupied_len();
        let sample_count = available.min(max_samples);

        if sample_count == 0 {
            return Vec::new();
        }

        let mut chunk = vec![0.0; sample_count];
        let mut consumer = self.consumer.lock().expect("audio consumer lock poisoned");
        let read = consumer.pop_slice(&mut chunk);
        chunk.truncate(read);
        chunk
    }
}

pub fn start_audio_capture() -> Result<String, String> {
    let mut state = CAPTURE_STATE
        .lock()
        .map_err(|_| "Estado de áudio indisponível.".to_string())?;

    if state.status == AudioStatusKind::Listening {
        return Ok("Captura de áudio já está ativa.".to_string());
    }

    match create_capture_session() {
        Ok(session) => {
            state.session = Some(session);
            state.status = AudioStatusKind::Listening;
            state.last_error = None;
            state.last_amplitude = 0.0;
            Ok("Captura de áudio iniciada.".to_string())
        }
        Err(error) => {
            state.session = None;
            state.status = AudioStatusKind::Error;
            state.last_error = Some(error.clone());
            Err(error)
        }
    }
}

pub fn stop_audio_capture() -> Result<String, String> {
    let mut state = CAPTURE_STATE
        .lock()
        .map_err(|_| "Estado de áudio indisponível.".to_string())?;

    if let Some(session) = state.session.take() {
        stop_capture_session(session)?;
    }

    state.status = AudioStatusKind::Stopped;
    state.last_error = None;
    state.last_amplitude = 0.0;

    Ok("Captura de áudio parada.".to_string())
}

pub fn get_audio_chunk() -> Vec<f32> {
    let mut state = match CAPTURE_STATE.lock() {
        Ok(state) => state,
        Err(_) => return Vec::new(),
    };

    let Some(session) = state.session.as_ref() else {
        return Vec::new();
    };

    let chunk = session.buffer.pop_chunk(CHUNK_SAMPLES);
    state.last_amplitude = rms_amplitude(&chunk);
    chunk
}

pub fn get_audio_capture_status() -> AudioCaptureStatus {
    let state = CAPTURE_STATE
        .lock()
        .expect("audio capture state lock poisoned");

    let message = match state.status {
        AudioStatusKind::Listening => "Listening".to_string(),
        AudioStatusKind::Stopped => "Stopped".to_string(),
        AudioStatusKind::Error => state
            .last_error
            .clone()
            .unwrap_or_else(|| "Erro na captura de áudio.".to_string()),
    };

    AudioCaptureStatus {
        status: state.status,
        message,
        last_amplitude: state.last_amplitude,
        sample_rate: GEMINI_SAMPLE_RATE,
        channels: 1,
        chunk_samples: CHUNK_SAMPLES,
    }
}

#[cfg(target_os = "macos")]
fn create_capture_session() -> Result<ActiveCapture, String> {
    use screencapturekit::{
        cm::CMSampleBuffer,
        dispatch_queue::{DispatchQoS, DispatchQueue},
        shareable_content::SCShareableContent,
        stream::{
            configuration::{
                audio::{AudioChannelCount, AudioSampleRate},
                SCStreamConfiguration,
            },
            content_filter::SCContentFilter,
            output_type::SCStreamOutputType,
            SCStream,
        },
    };

    let content = SCShareableContent::create()
        .with_exclude_desktop_windows(true)
        .with_on_screen_windows_only(true)
        .get()
        .map_err(screen_recording_error)?;

    let display =
        content.displays().into_iter().next().ok_or_else(|| {
            "Nenhum display disponível para capturar áudio do sistema.".to_string()
        })?;

    let filter = SCContentFilter::create()
        .with_display(&display)
        .with_excluding_windows(&[])
        .build();

    let config = SCStreamConfiguration::new()
        .with_width(2)
        .with_height(2)
        .with_captures_audio(true)
        .with_sample_rate(AudioSampleRate::Rate16000)
        .with_channel_count(AudioChannelCount::Mono)
        .with_excludes_current_process_audio(true);

    let buffer = SharedAudioBuffer::new(BUFFER_CAPACITY);
    let handler_buffer = Arc::clone(&buffer);

    let mut stream = SCStream::new(&filter, &config);
    let queue = DispatchQueue::new(
        "com.entrevistai.audio-capture",
        DispatchQoS::UserInteractive,
    );
    let handler_id = stream.add_output_handler_with_queue(
        move |sample: CMSampleBuffer, output_type: SCStreamOutputType| {
            if output_type != SCStreamOutputType::Audio || !sample.is_valid() {
                return;
            }

            let samples = pcm_samples_from_sample_buffer(&sample);
            let amplitude = rms_amplitude(&samples);

            if !samples.is_empty() {
                println!(
                    "EntrevistAI audio amplitude={:.5} samples={}",
                    amplitude,
                    samples.len()
                );
                handler_buffer.push_overwriting_oldest(&samples);
            }
        },
        SCStreamOutputType::Audio,
        Some(&queue),
    );

    if handler_id.is_none() {
        return Err(
            "Não foi possível registrar o handler de áudio do ScreenCaptureKit.".to_string(),
        );
    }

    stream
        .start_capture()
        .map_err(|error| format!("Não foi possível iniciar a captura de áudio: {error}"))?;

    Ok(ActiveCapture {
        stream,
        buffer,
        _content: content,
        _filter: filter,
        _config: config,
        _queue: queue,
    })
}

#[cfg(not(target_os = "macos"))]
fn create_capture_session() -> Result<ActiveCapture, String> {
    Err("Captura de áudio do sistema exige macOS 13+ com ScreenCaptureKit.".to_string())
}

#[cfg(target_os = "macos")]
fn stop_capture_session(session: ActiveCapture) -> Result<(), String> {
    session
        .stream
        .stop_capture()
        .map_err(|error| format!("Não foi possível parar a captura de áudio: {error}"))
}

#[cfg(not(target_os = "macos"))]
fn stop_capture_session(_session: ActiveCapture) -> Result<(), String> {
    Ok(())
}

#[cfg(target_os = "macos")]
fn screen_recording_error(error: screencapturekit::error::SCError) -> String {
    format!(
        "Permissão de Screen Recording negada ou indisponível. Abra System Settings > Privacy & Security > Screen Recording e habilite o EntrevistAI. Link: x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture. Detalhe: {error}"
    )
}

#[cfg(target_os = "macos")]
fn pcm_samples_from_sample_buffer(sample: &screencapturekit::cm::CMSampleBuffer) -> Vec<f32> {
    let Some(audio_buffers) = sample.audio_buffer_list() else {
        return Vec::new();
    };

    let format = sample.format_description();
    let channels = format
        .as_ref()
        .and_then(|format| format.audio_channel_count())
        .unwrap_or(1)
        .max(1) as usize;
    let bits_per_channel = format
        .as_ref()
        .and_then(|format| format.audio_bits_per_channel())
        .unwrap_or(32);
    let is_float = format
        .as_ref()
        .map(|format| format.audio_is_float())
        .unwrap_or(true);
    let is_big_endian = format
        .as_ref()
        .map(|format| format.audio_is_big_endian())
        .unwrap_or(false);

    if audio_buffers.num_buffers() > 1 {
        return planar_buffers_to_mono_f32(
            &audio_buffers,
            bits_per_channel,
            is_float,
            is_big_endian,
        );
    }

    let Some(buffer) = audio_buffers.get(0) else {
        return Vec::new();
    };

    interleaved_bytes_to_mono_f32(
        buffer.data(),
        buffer.number_channels.max(channels as u32) as usize,
        bits_per_channel,
        is_float,
        is_big_endian,
    )
}

#[cfg(target_os = "macos")]
fn planar_buffers_to_mono_f32(
    audio_buffers: &screencapturekit::cm::AudioBufferList,
    bits_per_channel: u32,
    is_float: bool,
    is_big_endian: bool,
) -> Vec<f32> {
    let decoded_channels: Vec<Vec<f32>> = audio_buffers
        .iter()
        .map(|buffer| {
            interleaved_bytes_to_mono_f32(
                buffer.data(),
                1,
                bits_per_channel,
                is_float,
                is_big_endian,
            )
        })
        .filter(|channel| !channel.is_empty())
        .collect();

    let Some(frame_count) = decoded_channels.iter().map(Vec::len).min() else {
        return Vec::new();
    };

    let channel_count = decoded_channels.len() as f32;
    (0..frame_count)
        .map(|index| {
            decoded_channels
                .iter()
                .map(|channel| channel[index])
                .sum::<f32>()
                / channel_count
        })
        .collect()
}

#[cfg(target_os = "macos")]
fn interleaved_bytes_to_mono_f32(
    bytes: &[u8],
    channels: usize,
    bits_per_channel: u32,
    is_float: bool,
    is_big_endian: bool,
) -> Vec<f32> {
    let bytes_per_sample = (bits_per_channel / 8).max(1) as usize;
    let channels = channels.max(1);
    let frame_size = bytes_per_sample.saturating_mul(channels);

    if frame_size == 0 {
        return Vec::new();
    }

    bytes
        .chunks_exact(frame_size)
        .map(|frame| {
            let sum = (0..channels)
                .map(|channel| {
                    let start = channel * bytes_per_sample;
                    decode_sample(
                        &frame[start..start + bytes_per_sample],
                        bits_per_channel,
                        is_float,
                        is_big_endian,
                    )
                })
                .sum::<f32>();
            (sum / channels as f32).clamp(-1.0, 1.0)
        })
        .collect()
}

#[cfg(target_os = "macos")]
fn decode_sample(bytes: &[u8], bits_per_channel: u32, is_float: bool, is_big_endian: bool) -> f32 {
    match (is_float, bits_per_channel) {
        (true, 32) if bytes.len() >= 4 => {
            let raw = [bytes[0], bytes[1], bytes[2], bytes[3]];
            if is_big_endian {
                f32::from_be_bytes(raw)
            } else {
                f32::from_le_bytes(raw)
            }
        }
        (false, 16) if bytes.len() >= 2 => {
            let raw = [bytes[0], bytes[1]];
            let value = if is_big_endian {
                i16::from_be_bytes(raw)
            } else {
                i16::from_le_bytes(raw)
            };
            value as f32 / i16::MAX as f32
        }
        (false, 24) if bytes.len() >= 3 => {
            let value = if is_big_endian {
                i32::from_be_bytes([0, bytes[0], bytes[1], bytes[2]]) >> 8
            } else {
                i32::from_le_bytes([bytes[0], bytes[1], bytes[2], 0]) >> 8
            };
            value as f32 / 8_388_607.0
        }
        (false, 32) if bytes.len() >= 4 => {
            let raw = [bytes[0], bytes[1], bytes[2], bytes[3]];
            let value = if is_big_endian {
                i32::from_be_bytes(raw)
            } else {
                i32::from_le_bytes(raw)
            };
            value as f32 / i32::MAX as f32
        }
        _ => 0.0,
    }
}

fn rms_amplitude(samples: &[f32]) -> f32 {
    if samples.is_empty() {
        return 0.0;
    }

    let sum = samples
        .iter()
        .map(|sample| sample.clamp(-1.0, 1.0).powi(2))
        .sum::<f32>();

    (sum / samples.len() as f32).sqrt()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rms_amplitude_returns_zero_for_empty_input() {
        assert_eq!(rms_amplitude(&[]), 0.0);
    }

    #[test]
    fn rms_amplitude_calculates_signal_level() {
        let amplitude = rms_amplitude(&[1.0, -1.0, 0.0, 0.0]);
        assert!((amplitude - 0.70710677).abs() < 0.00001);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn converts_interleaved_stereo_i16_to_mono_f32() {
        let bytes = [
            0x00, 0x40, // left: 16384
            0x00, 0x00, // right: 0
            0x00, 0xC0, // left: -16384
            0x00, 0x00, // right: 0
        ];
        let samples = interleaved_bytes_to_mono_f32(&bytes, 2, 16, false, false);

        assert_eq!(samples.len(), 2);
        assert!((samples[0] - 0.25).abs() < 0.0001);
        assert!((samples[1] + 0.25).abs() < 0.0001);
    }
}
