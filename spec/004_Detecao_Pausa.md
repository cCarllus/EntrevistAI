================================================================

1. # OBJETIVO DO PASSO 4

Quando a entrevistadora parar de falar (pausa natural), o app deve:

- Detectar o fim do turno dela
- Gerar automaticamente uma resposta profissional, natural e curta em inglês
- Mostrar a resposta no painel direito, pronta para o usuário copiar

Este é o recurso mais importante para sua entrevista.

# ================================================================ 2. REQUISITOS FUNCIONAIS

2.1 Detecção de Pausa

- Usar Voice Activity Detection (VAD) do Gemini Live (melhor opção)
- Ou implementar VAD simples no frontend (silêncio por 1.0 ~ 1.5 segundos)
- Quando detectar pausa → finalizar o turno atual da entrevistadora

  2.2 Geração Automática de Resposta

- Enviar para Gemini (generateContent ou continuation):
  - Contexto completo (CV + vaga do Passo 1)
  - Histórico da conversa
  - Última pergunta da entrevistadora (transcrição completa)
- Gerar resposta curta (3-6 frases), confiante, natural, nível intermediário

  2.3 Prompt Base (obrigatório - copie exatamente)

System Instruction / Prompt:

"Você é um excelente coach de entrevistas para candidatos brasileiros com inglês intermediário.
Use o contexto abaixo para responder de forma natural.

CV do candidato:
{CV_COMPLETO}

Descrição da vaga:
{VAGA}

Histórico da conversa:
{HISTORICO}

Última pergunta da entrevistadora:
{PERGUNTA}

Responda em inglês:

- Máximo 4-6 frases
- Linguagem simples e natural (não robótica)
- Confiante, mas humilde
- Use STAR method quando for útil
- Resposta pronta para falar em voz alta"

  2.4 Interface

- Resposta aparece automaticamente no painel direito
- Botão grande "Copiar Resposta" (Cmd + C)
- Botão "Nova Sugestão" (caso queira outra versão)
- Status: "Pensando..." enquanto gera

# ================================================================ 3. ARQUIVOS A CRIAR / MODIFICAR

- src/lib/services/responseService.ts → Novo (principal)
- src/lib/stores/responseStore.ts → Novo
- src/lib/components/ResponsePanel.svelte → Novo ou expandir
- Atualizar geminiLiveService.ts → Chamar resposta automática na pausa
- Atualizar PreparationWindow.svelte / main UI

# ================================================================ 4. LÓGICA DE DETECÇÃO DE PAUSA (Recomendada)

- Usar o campo "isFinal" ou silence detection do Gemini Live
- Ou no frontend: monitorar se a transcrição não mudou por 1200ms
- Quando pausa detectada → chamar generateResponse()

# ================================================================ 5. REQUISITOS NÃO-FUNCIONAIS

- Tempo para gerar resposta: alvo < 2.5 segundos | máximo 4 segundos
- Respostas consistentes e profissionais
- Não gerar resposta se o turno for muito curto (< 4 palavras)
- Evitar respostas repetitivas

# ================================================================ 6. TESTES OBRIGATÓRIOS

- Fazer uma simulação de entrevista (perguntas + pausas)
- Verificar se a resposta aparece automaticamente após cada pausa
- Testar qualidade das respostas com seu CV real
- Testar botão Copiar
- Verificar latência total (fala → resposta pronta)

================================================================
