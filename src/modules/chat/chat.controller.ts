import { Response } from 'express';
import { AuthenticatedRequest } from '../../shared/middleware/auth.middleware.js';
import { ChatService } from './chat.service.js';

export type ChatController = {
  listUserChats: (req: AuthenticatedRequest, res: Response) => Promise<void>;
  getMessages: (req: AuthenticatedRequest, res: Response) => Promise<void>;
};

export const createChatController = (chatService: ChatService): ChatController => {
  const listUserChats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    // Ponieważ przeszliśmy przez middleware auth, req.user na 100% istnieje
    const userId = req.user!.id;

    const chats = await chatService.getActiveChats(userId);
    res.status(200).json(chats);
  };

  const getMessages = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const roomId = req.params.roomId as string;

    if (!roomId) {
      res.status(400).json({ message: 'Parametr roomId jest wymagany.' });
      return;
    }

    const messages = await chatService.getChatHistory(roomId);
    res.status(200).json(messages);
  };

  return { listUserChats, getMessages };
};
