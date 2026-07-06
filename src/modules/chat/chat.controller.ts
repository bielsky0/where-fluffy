import { Response } from 'express';
import { AuthenticatedRequest } from '../../shared/middleware/auth.middleware.js';
import { getActiveChats, getChatHistory } from './chat.service.js';


export const listUserChats = async (req: AuthenticatedRequest, res: Response) => {
  // Ponieważ przeszliśmy przez middleware auth, req.user na 100% istnieje
  const userId = req.user!.id;
  
  const chats = await getActiveChats(userId);
  return res.status(200).json(chats);
};

export const getMessages = async (req: AuthenticatedRequest, res: Response) => {
  const roomId = req.params.roomId as string;
  
  if (!roomId) {
    return res.status(400).json({ message: 'Parametr roomId jest wymagany.' });
  }

  const messages = await getChatHistory(roomId);
  return res.status(200).json(messages);
};