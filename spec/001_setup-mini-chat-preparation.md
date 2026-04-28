# PASSO 1 - SETUP + MINI CHAT DE PREPARAÇÃO

## Objective

Criar a base completa do projeto Tauri 2.0 e implementar a tela inicial de preparação da entrevista, onde o usuário pode fazer upload do currículo (PDF), descrição da vaga, manter um mini chat com a IA usando o contexto do CV e salvar tudo para ser usado nas próximas etapas.

## Context

Esta é a primeira tela que o usuário vê ao abrir o app. É fundamental ter um onboarding rápido e funcional, pois a entrevista está próxima. O contexto do CV e da vaga precisa ser extraído e armazenado para ser usado na geração de respostas durante a entrevista.

## Domain / Package

entrevistai-core / preparation

## Inputs

- Arquivo PDF ou TXT do Currículo (CV)
- Texto ou arquivo da Descrição da Vaga
- Mensagens digitadas pelo usuário no mini chat
- API Key do Gemini (configurada uma única vez)

## Expected Output

- Projeto Tauri rodando no Mac
- Tela "Preparar Entrevista" funcional
- Texto extraído do CV e da vaga
- Mini chat respondendo com base no CV + vaga
- Arquivo JSON local com o contexto salvo (context.json)
- Botão "Iniciar Modo Entrevista" habilitado

## Business Rules

- O app deve aceitar PDF, DOCX e TXT para CV
- Extração de texto do PDF deve ser automática e precisa
- O mini chat deve sempre ter acesso ao contexto completo (CV + vaga)
- O contexto deve ser salvo localmente e carregado automaticamente na próxima abertura
- O botão "Iniciar Modo Entrevista" só fica ativo quando existir CV + vaga carregados
- Interface em português brasileiro
- Tema escuro por padrão

## Main Flow

1. Usuário abre o app → vê tela "Preparar Entrevista"
2. Clica em "Anexar Currículo" → seleciona PDF → app extrai texto automaticamente
3. Clica em "Anexar Descrição da Vaga" → cola texto ou anexa arquivo
4. Usuário conversa no mini chat (ex: "Me ajude a preparar respostas sobre minha experiência")
5. App envia prompt para Gemini com o contexto completo
6. Usuário clica em "Iniciar Modo Entrevista"
7. App salva o contexto em JSON e avisa que está pronto para o próximo passo

## Alternative Flows / Errors

- PDF não legível ou protegido → mostrar erro claro + opção de colar texto manualmente
- Sem internet → aviso "Gemini precisa de conexão" no chat
- Arquivo muito grande (> 5MB) → limitar e avisar
- Usuário fecha o app sem salvar → contexto deve ser salvo automaticamente
- Permissão de leitura de arquivo negada → pedir permissão novamente

## Classes Involved

- PreparationWindow (Svelte component)
- FileUploader (componente reutilizável)
- GeminiService (Rust + JS)
- ContextStore (Tauri Store / JSON)
- PdfExtractor (Rust ou JS pdf.js)

## Acceptance Criteria

- Projeto Tauri cria e roda sem erros no macOS (Apple Silicon)
- Upload de PDF extrai texto corretamente (testar com CV real)
- Mini chat responde usando o contexto do CV (visível na resposta)
- Contexto é salvo em ~/Library/Application Support/EntrevistAI/context.json
- Botão "Iniciar Modo Entrevista" só ativa quando CV + vaga existem
- Interface limpa, responsiva e em português
- Tempo de abertura do app < 2 segundos

# Demais contextos dinâmicos

- Usar Tailwind CSS para estilização rápida
- Manter o código extremamente limpo e comentado (vamos evoluir rápido nos próximos passos)
- Priorizar simplicidade: MVP funcional em 1 dia
- Preparar estrutura de pastas para facilitar adição de áudio nos próximos passos
- Recomendado: Criar uma pasta "assets" para ícones e imagens
- API Key do Gemini deve ser configurada na primeira execução (tela de settings simples)
