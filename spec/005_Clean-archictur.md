================================================================

1. # OBJETIVO DO PASSO 5

Criar uma interface limpa, profissional, discreta e prática para uso durante a entrevista real:

- Painel lado a lado (esquerda = transcrição/tradução | direita = resposta)
- Botões grandes e intuitivos
- Sempre visível, mas não invasivo
- Boa experiência visual durante a call

# ================================================================ 2. REQUISITOS FUNCIONAIS

2.1 Layout Principal (Side-by-Side)

- Janela flutuante ou painel dividido verticalmente
- Lado Esquerdo (60%):
  - Título: "Transcrição ao vivo"
  - Inglês original (cinza, menor)
  - Tradução PT-BR (verde escuro, fonte maior, destaque)
  - Histórico dos últimos 3-4 turnos (rolável)
- Lado Direito (40%):
  - Título: "Resposta Sugerida"
  - Texto da resposta em inglês (fácil de ler)
  - Botão grande "Copiar Resposta" (verde, Cmd/Ctrl + C)
  - Botão "Nova Sugestão"
  - Status: "Pensando..." durante geração

    2.2 Controles e Atalhos

- Botão "Iniciar / Parar Entrevista" (grande)
- Atalho global: Cmd + Shift + I (toggle listening)
- Atalho: Cmd + K → Nova sugestão
- Atalho: Cmd + C → Copiar resposta atual
- Botão para limpar histórico

  2.3 Modo Flutuante / Sempre no Topo

- Janela sempre visível (always on top)
- Opacidade ajustável (90% padrão)
- Tamanho mínimo: ~900x600 px
- Possibilidade de minimizar para Menu Bar (Stealth)

# ================================================================ 3. ARQUIVOS A CRIAR / MODIFICAR

- src/lib/components/InterviewInterface.svelte → (principal - novo)
- src/lib/components/TranscriptionPanel.svelte → (refinar)
- src/lib/components/ResponsePanel.svelte → (já existe - refinar)
- src/lib/components/MainWindow.svelte → (atualizar)
- Atualizar PreparationWindow.svelte (botão para abrir interface)

# ================================================================ 4. ESTILO E DESIGN (Tailwind)

- Tema escuro (bg-zinc-950)
- Cores:
  - Tradução PT: text-emerald-400
  - Resposta: text-white
  - Botão Copiar: bg-emerald-600 hover:bg-emerald-500
- Fontes legíveis (system-ui ou Inter)
- Bordas suaves, padding bom
- Scroll suave nos painéis

# ================================================================ 5. REQUISITOS NÃO-FUNCIONAIS

- Interface responsiva dentro da janela
- Não atrapalhar tela compartilhada (não muito grande)
- Alta legibilidade mesmo com pressa
- Transições suaves (fade-in nas respostas)
- Testar em tela de MacBook (13" e 16")

# ================================================================ 6. TESTES OBRIGATÓRIOS

- Abrir em modo entrevista e testar layout em tela cheia
- Verificar se botões funcionam (copiar, nova sugestão)
- Testar atalhos de teclado
- Verificar legibilidade durante uma simulação de 10 minutos
- Testar "always on top"

================================================================
