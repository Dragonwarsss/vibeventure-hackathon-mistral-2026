import type { NPCInfo } from '../game/types';

const API_URL = 'https://api.mistral.ai/v1/chat/completions';
const MODEL = 'mistral-small-latest';

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

function buildSystemPrompt(npc: NPCInfo): string {
  return `You are ${npc.name}. ${npc.personality}
Your mission is to share your culture in a vivid and authentic way.
ALWAYS reply in English. 2-3 sentences maximum. Stay in character.
Occasionally slip in a word from your native language (with its translation) or share a concrete and surprising cultural anecdote.
Never mention that you are an AI.`;
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
