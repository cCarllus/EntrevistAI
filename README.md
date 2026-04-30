# EntrevistAI

EntrevistAI é um aplicativo desktop para apoiar entrevistas em inglês. Ele usa Gemini para preparar contexto, transcrever/traduzir áudio em tempo real e sugerir respostas curtas baseadas no currículo do candidato e na descrição da vaga.

O app foi feito com Svelte, Vite, Tauri 2 e Rust. No macOS, a captura de áudio do sistema usa ScreenCaptureKit.

## Funcionalidades

- Importação de currículo e descrição da vaga em `.pdf`, `.docx` ou `.txt`.
- Chat de preparação com Gemini usando o contexto do currículo e da vaga.
- Overlay desktop sempre visível para usar durante a entrevista.
- Captura de áudio do sistema no macOS 13+.
- Transcrição em inglês e tradução para português brasileiro via Gemini Live.
- Geração automática de sugestões de resposta em inglês, prontas para falar.
- Persistência local de contexto e configurações.
- Ícone de tray para esconder/mostrar a janela.

## Como funciona

1. O candidato informa uma API key do Gemini.
2. O app lê o currículo e a descrição da vaga e salva esse contexto localmente.
3. Durante a entrevista, o backend Tauri captura o áudio do sistema e envia chunks PCM 16 kHz para o Gemini Live.
4. O Gemini Live retorna transcrição e tradução.
5. Ao final de cada turno de fala, o app chama Gemini 2.5 Flash para sugerir uma resposta em inglês com base no contexto da vaga, currículo e histórico recente.

Os dados locais ficam no diretório de dados do aplicativo. No macOS:

```text
~/Library/Application Support/EntrevistAI
```

## Requisitos

- Node.js 18+.
- npm.
- Rust stable.
- Dependências do Tauri 2 para o seu sistema operacional.
- API key do Gemini com acesso aos modelos usados pelo app.
- macOS 13+ para captura real de áudio do sistema.

No macOS, conceda permissão em:

```text
System Settings > Privacy & Security > Screen Recording
```

Sem essa permissão, o app não consegue capturar o áudio da entrevista.

## Instalação para desenvolvimento

Clone o repositório e instale as dependências:

```bash
git clone https://github.com/cCarllus/EntrevistAI.git
cd EntrevistAI
npm install
```

Execute o app desktop em modo desenvolvimento:

```bash
npm run tauri dev
```

Para rodar apenas a interface web com Vite:

```bash
npm run dev
```

Também existe um ambiente Docker para subir o Vite:

```bash
docker compose up --build
```

Esse modo é útil para desenvolvimento da interface, mas não substitui o app Tauri para captura desktop de áudio.

## Uso

1. Abra o EntrevistAI.
2. Na aba de API, cole sua API key do Gemini e salve.
3. Carregue o currículo e a descrição da vaga.
4. Use o chat para se preparar antes da entrevista, se necessário.
5. Abra o modo entrevista.
6. Inicie a escuta e acompanhe a transcrição, tradução e sugestão de resposta.

Atalhos:

- `Cmd+Shift+I` no macOS ou `Ctrl+Shift+I` no Windows/Linux: iniciar/parar modo entrevista.
- `Cmd+Shift+H` no macOS ou `Ctrl+Shift+H` no Windows/Linux: mostrar/esconder janela.

## Scripts

```bash
npm run dev       # inicia o Vite
npm run build     # gera o build web
npm run check     # valida TypeScript/Svelte
npm run preview   # serve o build web localmente
npm run tauri     # executa a CLI do Tauri
```

## Gerar executável

Para gerar os artefatos desktop:

```bash
npm run tauri build
```

No macOS, os arquivos finais ficam em:

```text
src-tauri/target/release/bundle/macos/EntrevistAI.app
src-tauri/target/release/bundle/dmg/EntrevistAI_1.0.0_aarch64.dmg
```

O `.dmg` é o arquivo recomendado para publicar em uma release do GitHub.

## Publicar release v1 no GitHub

1. Gere o build:

   ```bash
   npm run tauri build
   ```

2. Crie a tag:

   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

3. No GitHub, crie uma release chamada `v1.0.0`.
4. Anexe o arquivo `.dmg` gerado em `src-tauri/target/release/bundle/dmg/`.

## Estrutura

```text
src/                 Interface Svelte
src/lib/components/  Componentes de tela e overlay
src/lib/services/    Integrações com Gemini, arquivos, áudio e persistência
src/lib/stores/      Stores de transcrição e respostas
src-tauri/           App Tauri, comandos Rust, tray, atalhos e captura de áudio
spec/                Documentos de especificação do projeto
```

## Observações

- A API key é salva localmente nas configurações do app.
- A captura de áudio do sistema está implementada para macOS. Em outros sistemas, o backend retorna uma mensagem indicando que a captura exige macOS 13+ com ScreenCaptureKit.
- O app depende da disponibilidade dos modelos Gemini configurados no código.
