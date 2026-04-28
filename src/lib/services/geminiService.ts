import type { ChatMessage, InterviewContext } from '../types';

const geminiEndpoint =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

export async function sendPreparationMessage(
  apiKey: string,
  context: InterviewContext,
  message: string
): Promise<string> {
  if (!apiKey.trim()) {
    throw new Error('Configure sua API Key do Gemini antes de enviar mensagens.');
  }

  if (!navigator.onLine) {
    throw new Error('Gemini precisa de conexão com a internet.');
  }

  const recentHistory = context.chatMessages.slice(-8).map(formatMessage).join('\n');
  const prompt = [
    'Você é um assistente de preparação para entrevistas.',
    'Responda em português brasileiro, com objetividade e foco em ações práticas.',
    'Use sempre o contexto do currículo e da vaga ao responder.',
    '',
    'CURRÍCULO:',
    context.cvText || 'Ainda não informado.',
    '',
    'DESCRIÇÃO DA VAGA:',
    context.jobText || 'Ainda não informada.',
    '',
    'HISTÓRICO RECENTE:',
    recentHistory || 'Sem mensagens anteriores.',
    '',
    `PERGUNTA DO USUÁRIO: ${message}`
  ].join('\n');

  const response = await fetch(`${geminiEndpoint}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 900
      }
    })
  });

  if (!response.ok) {
    throw new Error('Gemini não respondeu agora. Verifique a API Key e sua conexão.');
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text ?? '')
    .join('')
    .trim();

  if (!text) {
    throw new Error('Gemini retornou uma resposta vazia. Tente novamente.');
  }

  return text;
}

function formatMessage(message: ChatMessage): string {
  const author = message.role === 'user' ? 'Usuário' : 'Gemini';
  return `${author}: ${message.content}`;
}
