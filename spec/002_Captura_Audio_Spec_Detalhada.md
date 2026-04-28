================================================================

1. # OBJETIVO DO PASSO 2

Fazer o app capturar o áudio que está saindo dos alto-falantes do Mac (áudio do Zoom, Teams, Google Meet, etc.) de forma automática e contínua, enviando para o Gemini Live API posteriormente.

Este é o passo mais crítico para o funcionamento em tempo real.

# ================================================================ 2. REQUISITOS FUNCIONAIS

2.1 Funcionalidades Obrigatórias

- Capturar áudio do sistema (System Audio) via ScreenCaptureKit (macOS 13+)
- Converter o áudio para o formato exigido pelo Gemini Live:
  • Sample Rate: 16000 Hz (16kHz)
  • Channels: 1 (Mono)
  • Bit Depth: 16-bit
  • Format: Linear PCM (f32 ou i16)
- Iniciar e parar a captura via comandos do Tauri
- Filtro anti-loop: não capturar o áudio que o próprio EntrevistAI está reproduzindo
- Buffer de áudio em memória (ring buffer) para enviar chunks de ~0.5s
- Status em tempo real: "Listening", "Stopped", "Error"

  2.2 Permissões

- Solicitar automaticamente permissão de "Screen Recording"
- Se negada, mostrar mensagem clara com link para System Settings → Privacy & Security

  2.3 Comandos Tauri (Rust)

- start_audio_capture() → Result<String, String>
- stop_audio_capture() → Result<String, String>
- get_audio_chunk() → Vec<f32> (para enviar ao frontend ou diretamente para Gemini)

# ================================================================ 3. TECH STACK PARA ESTE PASSO

- Rust + Tauri 2
- ScreenCaptureKit (via bindings ou AVFoundation)
- cpal = "0.15" (para captura de áudio)
- ringbuf = "0.4" (buffer circular)
- once_cell ou tokio::sync::Mutex (para compartilhar buffer)
- tokio para async

# ================================================================ 4. ARQUIVOS A CRIAR / MODIFICAR

1. src-tauri/Cargo.toml → adicionar dependências
2. src-tauri/src/audio_capture.rs → novo arquivo (principal)
3. src-tauri/src/lib.rs → expor os comandos
4. src-tauri/src/main.rs → inicializações se necessário
5. src/lib/components/AudioStatus.svelte → novo componente
6. src/lib/services/audioService.ts → frontend service

# ================================================================ 5. CÓDIGO PRINCIPAL (audio_capture.rs)

(use o código que eu te passei anteriormente como base e vamos refinar)

# ================================================================ 6. FLUXO TÉCNICO

1. Usuário clica em "Iniciar Modo Entrevista"
2. App solicita permissões (se necessário)
3. Chama start_audio_capture()
4. ScreenCaptureKit começa a capturar áudio do sistema
5. Áudio é colocado em um ring buffer
6. Frontend ou backend pega chunks periodicamente (a cada 500ms)
7. Chunks são enviados para o Gemini Live API (próximo passo)

# ================================================================ 7. TESTES OBRIGATÓRIOS (ao final do Passo 2)

- Abrir Zoom/Teams e falar algo → app deve mostrar status "Listening"
- Verificar no console se áudio está sendo capturado (log de amplitude)
- Testar start/stop múltiplas vezes
- Confirmar que o áudio do próprio app NÃO é capturado (anti-loop)
- Testar em chamada real de 5 minutos

# ================================================================ 8. REQUISITOS NÃO-FUNCIONAIS

- Latência de captura: < 200ms
- Uso de CPU: < 8% durante captura
- Memória extra: < 100 MB
- Funcionar em background (quando app minimizado)
- Estável por pelo menos 2 horas contínuas

# ================================================================ 9. PRÓXIMOS PASSOS APÓS CONCLUIR O PASSO 2
