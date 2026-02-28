import type { NPCInfo } from '../game/types';

const API_URL = 'https://api.mistral.ai/v1/chat/completions';
const MODEL = 'mistral-small-latest';

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

function buildSystemPrompt(npc: NPCInfo): string {
  return `Tu es ${npc.name}. ${npc.personality}
Ta mission est de faire découvrir ta culture de façon vivante et authentique.
Réponds TOUJOURS en français. 2-3 phrases maximum. Reste dans ton personnage.
Glisse parfois un mot dans ta langue natale (avec sa traduction) ou partage une anecdote culturelle concrète et surprenante.
Ne mentionne jamais que tu es une IA.`;
}

export async function* streamNPCResponse(
  npc: NPCInfo,
  history: ConversationMessage[],
  apiKey: string
): AsyncGenerator<string> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: buildSystemPrompt(npc) },
        ...history,
      ],
      stream: true,
      max_tokens: 160,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Mistral ${response.status}: ${text}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') return;

      try {
        const parsed = JSON.parse(data) as {
          choices: [{ delta: { content?: string } }];
        };
        const content = parsed.choices[0]?.delta?.content;
        if (content) yield content;
      } catch {
        // malformed SSE chunk — skip
      }
    }
  }
}
