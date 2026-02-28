export interface ConversationMessage {
    role: 'user' | 'assistant';
    content: string;
}
export interface StreamChatDto {
    npc: {
        id: string;
        name: string;
        personality: string;
    };
    history: ConversationMessage[];
}
