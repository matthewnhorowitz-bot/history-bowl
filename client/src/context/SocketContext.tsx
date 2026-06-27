import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

const SocketContext = createContext<Socket | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const socket = io({ transports: ["websocket"] });
    socketRef.current = socket;
    forceUpdate((n) => n + 1);
    return () => { socket.disconnect(); };
  }, []);

  return (
    <SocketContext.Provider value={socketRef.current}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket(): Socket {
  const socket = useContext(SocketContext);
  if (!socket) throw new Error("useSocket must be used inside SocketProvider");
  return socket;
}
