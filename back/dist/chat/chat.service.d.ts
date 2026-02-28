import type { Response } from 'express';
import type { StreamChatDto } from './chat.dto';
export declare class ChatService {
    private buildSystemPrompt;
    stream(dto: StreamChatDto, res: Response): Promise<void>;
}
