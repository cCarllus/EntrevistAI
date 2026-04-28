================================================================
OBJETIVO FINAL
================================================================
Criar um app macOS funcional que:

- Tem mini chat para subir CV + vaga
- Ouve automaticamente Zoom/Teams/Meet
- Traduz Inglês → Português em tempo real
- Detecta pausa e gera resposta profissional em inglês automaticamente
- Interface side-by-side + botão Copiar

================================================================
DIVISÃO DO PROJETO EM 6 PASSOS (3 DIAS)
================================================================

PASSO 1 - Setup + Mini Chat de Preparação → Dia 1 (hoje)
PASSO 2 - Captura de Áudio do Sistema → Dia 2 (manhã)
PASSO 3 - Transcrição + Tradução com Gemini Live → Dia 2 (tarde)
PASSO 4 - Detecção de Pausa + Resposta Automática → Dia 3 (manhã)
PASSO 5 - Interface Side-by-Side + Botões → Dia 3 (tarde)
PASSO 6 - Stealth Mode, Atalhos e Testes Finais → Dia 3 (noite)

================================================================
PASSO 1 - SETUP + MINI CHAT DE PREPARAÇÃO
================================================================
Objetivo: Ter o app rodando com upload de CV e chat inicial

Requisitos:

- Criar projeto Tauri 2.0 (Rust + Svelte)
- Tela "Preparar Entrevista"
- Upload de PDF (CV) + extração de texto
- Upload de descrição da vaga
- Mini chat com Gemini usando o contexto do CV
- Salvar contexto em JSON local
- Botão "Iniciar Modo Entrevista"

Tech: Tauri 2 + Svelte 5 + Tailwind + pdf.js

================================================================
PASSO 2 - CAPTURA DE ÁUDIO DO SISTEMA (macOS)
================================================================
Objetivo: App consegue ouvir o que sai do Zoom/Teams

Requisitos:

- Usar ScreenCaptureKit para capturar áudio do sistema
- Permissões corretas (Screen Recording)
- Stream de áudio em 16kHz
- Filtro anti-loop (não capturar o próprio app)
- Comando Rust para iniciar/parar captura

================================================================
PASSO 3 - INTEGRAÇÃO GEMINI LIVE API
================================================================
Objetivo: Transcrição e tradução em tempo real

Requisitos:

- Conectar com Gemini Live API via WebSocket
- Enviar stream de áudio
- Receber transcrição incremental em inglês
- Traduzir automaticamente para PT-BR
- Mostrar na tela em tempo real

================================================================
PASSO 4 - DETECÇÃO DE PAUSA + RESPOSTA AUTOMÁTICA
================================================================
Objetivo: Gerar resposta sozinho quando a entrevistadora parar de falar

Requisitos:

- Detectar pausa de fala (Voice Activity Detection)
- Quando pausar: enviar pergunta + contexto (CV + vaga + histórico)
- Gerar resposta curta e profissional em inglês
- Mostrar automaticamente no painel direito

================================================================
PASSO 5 - INTERFACE SIDE-BY-SIDE
================================================================
Objetivo: Interface limpa e prática

Requisitos:

- Painel esquerdo: Tradução (EN + PT)
- Painel direito: Resposta sugerida + botão "Copiar"
- Modo flutuante / sempre no topo
- Botão grande Copiar (Cmd+C)
- Status: Listening / Processing

================================================================
PASSO 6 - STEALTH MODE + POLIMENTO FINAL
================================================================
Objetivo: App pronto para usar na entrevista real

Requisitos:

- Modo Stealth (só ícone na menu bar)
- Atalhos globais (Cmd+Shift+I, Cmd+K)
- Salvar histórico da entrevista
- Testes com Zoom/Meet
- DMG installer
- Otimização de latência

================================================================
TECH STACK GERAL (TODO O PROJETO)
================================================================

- Framework: Tauri 2.0 (melhor para macOS e leve)
- Frontend: Svelte 5 + Tailwind CSS
- Backend: Rust
- IA: Gemini Live API (gemini-2.5-flash ou superior)
- PDF: pdf.js
- Armazenamento: Tauri Store + JSON
- Distribuição: DMG

================================================================
PRÓXIMOS PASSOS (FAÇA NA ORDEM)
================================================================

1. Diga: "OK Passo 1" → Eu mando o código completo do Passo 1
2. Depois de terminar o Passo 1, diga "OK Passo 2"
3. Continuamos até terminar os 6 passos

Tempo estimado total: 3 dias trabalhando focado (8-10h/dia)

================================================================
DICAS IMPORTANTES
================================================================

- Use Apple Silicon (M1 ou superior)
- Tenha Node.js 20+ e Rust instalado
- Crie uma API Key do Gemini (Google AI Studio) - é grátis
- Teste cada passo antes de passar para o próximo
- Se travar em alguma parte, me avise imediatamente

FIM DO PLANO COMPLETO
