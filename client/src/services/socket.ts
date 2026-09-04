import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io('http://localhost:4000', {
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
