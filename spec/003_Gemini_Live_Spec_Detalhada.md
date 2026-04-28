================================================================

1. # OBJETIVO DO PASSO 3

Conectar o stream de áudio capturado no Passo 2 com o Gemini Live API para obter:

- Transcrição em tempo real do que a entrevistadora fala (inglês)
- Tradução automática e natural para português brasileiro
- Exibição contínua na interface enquanto a pessoa está falando

Este passo transforma o áudio bruto em texto utilizável.

# ================================================================ 2. REQUISITOS FUNCIONAIS

2.1 Conexão com Gemini Live API

- Usar WebSocket do Gemini Live (não o REST normal)
- Model recomendado: gemini-2.5-flash-live (ou o mais atual com suporte a áudio streaming)
- Enviar áudio em chunks de 500ms ~ 1000ms (16kHz mono PCM)
- Manter conexão WebSocket viva durante toda a entrevista

  2.2 Transcrição em Tempo Real

- Receber transcrição incremental (streaming)
- Mostrar o texto em inglês sendo digitado em tempo real (como legendas)
- Alta precisão mesmo com sotaque americano/britânico

  2.3 Tradução Automática

- Traduzir a transcrição para português brasileiro claro e natural
- Atualizar a tradução junto com a transcrição
- Manter contexto da conversa (não traduzir frase a frase isolada)

  2.4 Exibição na Interface

- Painel esquerdo:
  - Inglês original (fonte cinza, menor)
  - Tradução PT-BR (fonte verde, maior, mais destacada)
- Atualização suave (sem piscar a tela)
- Histórico dos últimos 3-5 turnos da entrevistadora

  2.5 Controle da Sessão

- Iniciar streaming automaticamente quando "Modo Entrevista" for ativado
- Parar streaming quando o usuário parar a captura de áudio
- Reconexão automática caso a conexão caia

# ================================================================ 3. TECH STACK E INTEGRAÇÕES

- Gemini Live API (WebSocket)
- Biblioteca recomendada: @google/generative-ai (versão mais recente)
- Svelte Stores para gerenciar estado da transcrição
- Tauri Events para comunicação Rust ↔ Frontend
- API Key armazenada de forma segura

# ================================================================ 4. ARQUIVOS A CRIAR / MODIFICAR

- src/lib/services/geminiLiveService.ts → Arquivo principal
- src/lib/stores/transcriptionStore.ts → Novo
- src/lib/components/TranscriptionPanel.svelte → Novo ou expandir
- src/lib/services/audioService.ts → Modificar (enviar chunks)
- src-tauri/src/lib.rs → Emitir eventos se necessário

# ================================================================ 5. CONFIGURAÇÃO DO GEMINI LIVE (System Instruction)

System Instruction (fixo):

"Você é um assistente de transcrição preciso e rápido para entrevistas de emprego em inglês.
Transcreva tudo que ouvir com máxima precisão.
Após cada transcrição, forneça também a tradução clara para português brasileiro (Brasil).
Mantenha o contexto da conversa."

# ================================================================ 6. FLUXO TÉCNICO DETALHADO

1. Usuário clica "Iniciar Modo Entrevista"
2. Áudio começa a ser capturado (Passo 2)
3. AudioService envia chunks para GeminiLiveService
4. GeminiLiveService abre WebSocket e envia áudio
5. Gemini retorna deltas de transcrição
6. Frontend recebe → atualiza TranscriptionPanel
7. Tradução é gerada em paralelo
8. Quando pausa for detectada (Passo 4) → finaliza turno atual

# ================================================================ 7. REQUISITOS NÃO-FUNCIONAIS

- Latência total (áudio → texto + tradução): alvo < 2.5 segundos
- Uso de CPU adicional: < 6%
- Memória adicional: < 80 MB
- Reconexão automática em até 3 segundos
- Funcionar offline? Não (exigir internet estável)

# ================================================================ 8. TESTES OBRIGATÓRIOS AO FINAL DO PASSO

- Testar com vídeo do YouTube em inglês (falar perguntas de entrevista)
- Verificar transcrição precisa
- Verificar tradução natural em português
- Testar com chamada real no Zoom/Meet (5 minutos)
- Testar reconexão (desligar Wi-Fi por 10s)
- Verificar que o histórico de turnos é mantido

# ================================================================ 9. PRÓXIMOS PASSOS
