import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || 'http://localhost:4000';

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnectionAttempts: 10,
    });
  }
  return socket;
};

export const joinRunRoom = (runId: string) => {
  const s = getSocket();
  s.emit('join_run', runId);
};

export const leaveRunRoom = (runId: string) => {
  const s = getSocket();
  s.emit('leave_run', runId);
};
