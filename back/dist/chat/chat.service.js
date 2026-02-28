"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatService = void 0;
const common_1 = require("@nestjs/common");
const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const MODEL = 'mistral-small-latest';
let ChatService = class ChatService {
    buildSystemPrompt(npc) {
        return `Tu es ${npc.name}. ${npc.personality}
Ta mission est de faire découvrir ta culture de façon vivante et authentique.
Réponds TOUJOURS en français. 2-3 phrases maximum. Reste dans ton personnage.
Glisse parfois un mot dans ta langue natale (avec sa traduction) ou partage une anecdote culturelle concrète et surprenante.
Ne mentionne jamais que tu es une IA.`;
    }
    async stream(dto, res) {
        const apiKey = process.env.MISTRAL_API_KEY;
        if (!apiKey) {
            res.write(`data: ${JSON.stringify({ error: 'MISTRAL_API_KEY non configurée' })}\n\n`);
            res.end();
            return;
        }
        const messages = [
            { role: 'system', content: this.buildSystemPrompt(dto.npc) },
            ...dto.history,
        ];
        const mistralRes = await fetch(MISTRAL_API_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ model: MODEL, messages, stream: true, max_tokens: 160 }),
        });
        if (!mistralRes.ok) {
            const text = await mistralRes.text();
            res.write(`data: ${JSON.stringify({ error: `Mistral ${mistralRes.status}: ${text}` })}\n\n`);
            res.end();
            return;
        }
        const reader = mistralRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data:'))
                    continue;
                const data = trimmed.slice(5).trim();
                if (data === '[DONE]') {
                    res.write('data: [DONE]\n\n');
                    res.end();
                    return;
                }
                try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices[0]?.delta?.content;
                    if (content)
                        res.write(`data: ${JSON.stringify({ content })}\n\n`);
                }
                catch {
                }
            }
        }
        res.end();
    }
};
exports.ChatService = ChatService;
exports.ChatService = ChatService = __decorate([
    (0, common_1.Injectable)()
], ChatService);
//# sourceMappingURL=chat.service.js.map