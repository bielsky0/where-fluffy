import type { ChatMessage } from '../types/chat.types';

interface ChatMessageBubbleProps {
  message: ChatMessage;
  isOwnMessage: boolean;
}

export function ChatMessageBubble({ message, isOwnMessage }: ChatMessageBubbleProps) {
  return (
    <div data-own={isOwnMessage}>
      <strong>{message.sender.name}</strong>
      <p>{message.text}</p>
      <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString()}</time>
    </div>
  );
}
