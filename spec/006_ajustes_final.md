================================================================

1. # OBJETIVO DO PASSO 6

Deixar o app **pronto para uso real na entrevista**:

- Modo Stealth (quase invisível)
- Atalhos globais confiáveis
- Otimização de performance e latência
- Empacotamento final (DMG limpo)
- Testes finais

# ================================================================ 2. REQUISITOS FUNCIONAIS

2.1 Stealth Mode (Menu Bar)

- Minimizar para ícone na barra superior do Mac (menu bar)
- Clique no ícone → abre/fecha a janela principal
- Janela principal pode ser escondida completamente

  2.2 Atalhos Globais

- Cmd + Shift + I → Iniciar/Parar Modo Entrevista
- Cmd + K → Gerar nova sugestão
- Cmd + C → Copiar resposta atual (quando janela visível)
- Cmd + Shift + H → Esconder/Mostrar janela

  2.3 Polimento Final

- Always On Top funcionando perfeitamente
- Opacidade ajustável salva
- Tratamento de erros amigável (ex: "Gemini desconectado")
- Mensagem inicial útil na primeira execução
- Performance: reduzir uso de CPU e memória

  2.4 Empacotamento

- Gerar DMG limpo e profissional
- Nome do app: EntrevistAI
- Ícone bonito (pode usar emoji ou simples)

# ================================================================ 3. ARQUIVOS A CRIAR / MODIFICAR

- src-tauri/src/main.rs → Menu bar / tray icon
- tauri.conf.json → Tray, shortcuts, bundle settings
- src/lib/components/MenuBar.svelte → (novo)
- src/lib/services/appSettings.ts → Salvar configurações
- Atualizar InterviewInterface.svelte

# ================================================================ 4. REQUISITOS NÃO-FUNCIONAIS

- App deve usar < 15% CPU durante uso normal
- Janela nunca cobre a tela da call
- Fácil de abrir/fechar durante a entrevista
- Estável por 2+ horas

# ================================================================ 5. TESTES FINAIS OBRIGATÓRIOS

1. Teste completo de 15 minutos simulando entrevista
2. Testar todos os atalhos
3. Testar Stealth Mode (minimizar e maximizar)
4. Testar com Zoom/Teams real
5. Verificar latência total (alvo < 4s)
6. Gerar DMG e testar instalação

# ================================================================ 6. ENTREGA FINAL

- Arquivo .dmg pronto para usar
- Instruções rápidas de como usar na entrevista
- Checklist final antes da entrevista

================================================================
