import { randomUUID } from 'node:crypto';
import { createChatGateway } from './chat.gateway.js';
import { ChatIoServer, ChatIoSocket, JoinChatPayload, SendMessagePayload, SocketData } from './interface/chat.interface.js';
import { buildMockChatService } from './chat.test-helpers.js';

// Minimalne, ręcznie skonstruowane mocki io/socket — Socket.io Server/Socket mają bardzo szeroki
// API (rooms, broadcast, volatile, compress, ...), którego gateway w ogóle nie używa poza
// on/to/emit/join/disconnect/id/data. Typujemy więc dokładnie to, czego gateway realnie
// dotyka, i rzutujemy na granicy wywołania createChatGateway (as unknown as ChatIoServer/Socket) —
// to nie jest `any`, tylko jawne, częściowe odwzorowanie realnego kontraktu.
type MockChatIoServer = {
  on: jest.Mock;
  to: jest.Mock;
};

type MockChatIoSocket = {
  id: string;
  data: SocketData;
  on: jest.Mock;
  emit: jest.Mock;
  join: jest.Mock;
  disconnect: jest.Mock;
};

const buildMockIo = (): { io: MockChatIoServer; roomEmit: jest.Mock } => {
  const roomEmit = jest.fn();
  const io: MockChatIoServer = {
    on: jest.fn(),
    to: jest.fn().mockReturnValue({ emit: roomEmit }),
  };
  return { io, roomEmit };
};

const buildMockSocket = (userId: string): MockChatIoSocket => ({
  id: `socket-${userId}`,
  data: { userId, user: { id: userId } },
  on: jest.fn(),
  emit: jest.fn(),
  join: jest.fn(),
  disconnect: jest.fn(),
});

// Jest's `mock.calls` is untyped (`any[][]`) by design; ta funkcja nadaje wyciągniętemu
// handlerowi jawny, konkretny typ w miejscu wywołania zamiast pozwolić mu "przeciekać" jako `any`.
const getRegisteredHandler = <Args extends unknown[]>(mockOn: jest.Mock, eventName: string): ((...args: Args) => unknown) => {
  const call = mockOn.mock.calls.find(([event]) => event === eventName);
  if (!call) {
    throw new Error(`No handler registered for event "${eventName}"`);
  }
  return call[1] as (...args: Args) => unknown;
};

const connect = async (io: MockChatIoServer, socket: MockChatIoSocket): Promise<void> => {
  const connectionHandler = getRegisteredHandler<[ChatIoSocket]>(io.on, 'connection');
  await connectionHandler(socket as unknown as ChatIoSocket);
};

describe('createChatGateway', () => {
  it('marks the user online and registers join_chat/send_message/disconnect listeners on connection', async () => {
    const chatService = buildMockChatService();
    const { io } = buildMockIo();
    const socket = buildMockSocket('user-1');

    createChatGateway(io as unknown as ChatIoServer, chatService);
    await connect(io, socket);

    expect(chatService.markUserOnline).toHaveBeenCalledWith('user-1', socket.id);
    expect(getRegisteredHandler(socket.on, 'join_chat')).toBeInstanceOf(Function);
    expect(getRegisteredHandler(socket.on, 'send_message')).toBeInstanceOf(Function);
    expect(getRegisteredHandler(socket.on, 'disconnect')).toBeInstanceOf(Function);
  });

  it('disconnects immediately and never marks the user online when socket.data.userId is missing', async () => {
    const chatService = buildMockChatService();
    const { io } = buildMockIo();
    const socket = buildMockSocket('');

    createChatGateway(io as unknown as ChatIoServer, chatService);
    await connect(io, socket);

    expect(socket.disconnect).toHaveBeenCalled();
    expect(chatService.markUserOnline).not.toHaveBeenCalled();
    expect(socket.on).not.toHaveBeenCalled();
  });

  describe('join_chat', () => {
    const setup = async (chatServiceOverrides: Partial<ReturnType<typeof buildMockChatService>> = {}) => {
      const chatService = { ...buildMockChatService(), ...chatServiceOverrides };
      const { io } = buildMockIo();
      const socket = buildMockSocket('user-1');

      createChatGateway(io as unknown as ChatIoServer, chatService);
      await connect(io, socket);

      const joinChatHandler = getRegisteredHandler<[JoinChatPayload]>(socket.on, 'join_chat');
      return { chatService, socket, joinChatHandler };
    };

    it('calls chatService.joinChatRoom and emits chat_joined with its result on success', async () => {
      const petId = randomUUID();
      const finderId = randomUUID();
      const { chatService, socket, joinChatHandler } = await setup();
      chatService.joinChatRoom.mockResolvedValue({ roomId: 'room-1', history: [] });

      await joinChatHandler({ petId, finderId });

      expect(chatService.joinChatRoom).toHaveBeenCalledWith('user-1', petId, finderId);
      expect(socket.join).toHaveBeenCalledWith('room-1');
      expect(socket.emit).toHaveBeenCalledWith('chat_joined', { roomId: 'room-1', history: [] });
    });

    it('rejects a malformed payload with "Błędne dane." without ever calling the service', async () => {
      const { chatService, socket, joinChatHandler } = await setup();

      await joinChatHandler({ petId: 'not-a-uuid' } as JoinChatPayload);

      expect(chatService.joinChatRoom).not.toHaveBeenCalled();
      expect(socket.emit).toHaveBeenCalledWith('error_response', { message: 'Błędne dane.' });
      expect(socket.join).not.toHaveBeenCalled();
    });

    it('emits "Brak uprawnień lub błąd." and does not join the room when the service rejects', async () => {
      const petId = randomUUID();
      const finderId = randomUUID();
      const { socket, joinChatHandler } = await setup({
        joinChatRoom: jest.fn().mockRejectedValue(new Error('UNAUTHORIZED')),
      });

      await joinChatHandler({ petId, finderId });

      expect(socket.emit).toHaveBeenCalledWith('error_response', { message: 'Brak uprawnień lub błąd.' });
      expect(socket.join).not.toHaveBeenCalled();
    });
  });

  describe('send_message', () => {
    const setup = async (chatServiceOverrides: Partial<ReturnType<typeof buildMockChatService>> = {}) => {
      const chatService = { ...buildMockChatService(), ...chatServiceOverrides };
      const { io, roomEmit } = buildMockIo();
      const socket = buildMockSocket('user-1');

      createChatGateway(io as unknown as ChatIoServer, chatService);
      await connect(io, socket);

      const sendMessageHandler = getRegisteredHandler<[SendMessagePayload]>(socket.on, 'send_message');
      return { chatService, io, roomEmit, socket, sendMessageHandler };
    };

    it('calls chatService.sendMessage then broadcasts via io.to(roomId).emit("new_message", ...)', async () => {
      const chatRoomId = randomUUID();
      const messageDTO = {
        id: 'message-1',
        chatRoomId,
        text: 'hello',
        createdAt: '2026-01-01T10:00:00.000Z',
        sender: { id: 'user-1', name: 'Jane' },
      };
      const { chatService, io, roomEmit, sendMessageHandler } = await setup({
        sendMessage: jest.fn().mockResolvedValue(messageDTO),
      });

      await sendMessageHandler({ chatRoomId, text: 'hello' });

      expect(chatService.sendMessage).toHaveBeenCalledWith('user-1', chatRoomId, 'hello');
      expect(io.to).toHaveBeenCalledWith(chatRoomId);
      expect(roomEmit).toHaveBeenCalledWith('new_message', messageDTO);
    });

    it('rejects a malformed payload with "Błędny format." without calling the service or broadcasting', async () => {
      const { chatService, io, roomEmit, sendMessageHandler } = await setup();

      await sendMessageHandler({ chatRoomId: 'not-a-uuid', text: '' });

      expect(chatService.sendMessage).not.toHaveBeenCalled();
      expect(io.to).not.toHaveBeenCalled();
      expect(roomEmit).not.toHaveBeenCalled();
    });

    it('emits "Brak dostępu do pokoju." and does not broadcast when the service throws FORBIDDEN', async () => {
      const chatRoomId = randomUUID();
      const { socket, io, roomEmit, sendMessageHandler } = await setup({
        sendMessage: jest.fn().mockRejectedValue(new Error('FORBIDDEN')),
      });

      await sendMessageHandler({ chatRoomId, text: 'hello' });

      expect(socket.emit).toHaveBeenCalledWith('error_response', { message: 'Brak dostępu do pokoju.' });
      expect(io.to).not.toHaveBeenCalled();
      expect(roomEmit).not.toHaveBeenCalled();
    });

    it('emits the generic "Błąd zapisu wiadomości." for any other service failure', async () => {
      const chatRoomId = randomUUID();
      const { socket, sendMessageHandler } = await setup({
        sendMessage: jest.fn().mockRejectedValue(new Error('connection refused')),
      });

      await sendMessageHandler({ chatRoomId, text: 'hello' });

      expect(socket.emit).toHaveBeenCalledWith('error_response', { message: 'Błąd zapisu wiadomości.' });
    });
  });

  describe('disconnect', () => {
    it('marks the user offline', async () => {
      const chatService = buildMockChatService();
      const { io } = buildMockIo();
      const socket = buildMockSocket('user-1');

      createChatGateway(io as unknown as ChatIoServer, chatService);
      await connect(io, socket);

      const disconnectHandler = getRegisteredHandler<[]>(socket.on, 'disconnect');
      disconnectHandler();

      expect(chatService.markUserOffline).toHaveBeenCalledWith('user-1');
    });
  });
});
