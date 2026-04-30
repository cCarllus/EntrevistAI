import type { InterviewContext } from '../types';

const geminiEndpoint =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

export interface GenerateResponseInput {
  apiKey: string;
  context: InterviewContext;
  history: string;
  question: string;
  previousResponses?: string[];
}

export async function generateInterviewResponse(input: GenerateResponseInput): Promise<string> {
  const apiKey = input.apiKey.trim();

  if (!apiKey) {
    throw new Error('Configure sua API Key do Gemini antes de gerar respostas automáticas.');
  }

  if (!navigator.onLine) {
    throw new Error('Gemini precisa de conexão com a internet.');
  }

  const prompt = buildResponsePrompt(input);
  const fullPrompt =
    input.previousResponses?.length
      ? [
          prompt,
          '',
          'Respostas anteriores para evitar repetição:',
          input.previousResponses.map((response, index) => `${index + 1}. ${response}`).join('\n')
        ].join('\n')
      : prompt;

  const response = await fetch(`${geminiEndpoint}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: fullPrompt }]
        }
      ],
      generationConfig: {
        temperature: input.previousResponses?.length ? 0.65 : 0.45,
        maxOutputTokens: 600
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

function buildResponsePrompt(input: GenerateResponseInput): string {
  return [
    'Você é o candidato numa entrevista de emprego em inglês.',
    'Gere EXATAMENTE o que o candidato deveria dizer em voz alta como resposta.',
    'NÃO explique, NÃO cite a pergunta, NÃO use aspas, NÃO comece com "He said" ou "She asked".',
    'A resposta deve ser uma fala direta, natural e pronta para ser lida em voz alta.',
    '',
    'CV do candidato:',
    input.context.cvText || 'Ainda não informado.',
    '',
    'Descrição da vaga:',
    input.context.jobText || 'Ainda não informada.',
    '',
    'Histórico da conversa:',
    input.history || 'Sem histórico anterior.',
    '',
    'O entrevistador acabou de dizer:',
    input.question,
    '',
    'Gere a resposta em inglês que o candidato deve falar:',
    '',
    '- Máximo 4-6 frases',
    '- Linguagem simples e natural, como uma conversa real',
    '- Confiante, mas humilde',
    '- Use dados do CV quando relevante',
    '- NÃO inclua introduções como "Sure!" ou "Great question!"',
    '- Comece direto com a resposta substantiva'
  ].join('\n');
}
