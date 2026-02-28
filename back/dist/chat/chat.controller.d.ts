import type { Response } from 'express';
import { ChatService } from './chat.service';
import type { StreamChatDto } from './chat.dto';
export declare class ChatController {
    private readonly chatService;
    constructor(chatService: ChatService);
    stream(dto: StreamChatDto, res: Response): Promise<void>;
}
