import React, { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

const SocketContext = createContext<Socket | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const s = io({ transports: ["websocket", "polling"] });
    setSocket(s);
    return () => { s.disconnect(); };
  }, []);

  // Don't render the app (which calls useSocket) until the socket exists.
  if (!socket) return null;

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket(): Socket {
  const socket = useContext(SocketContext);
  if (!socket) throw new Error("useSocket must be used inside SocketProvider");
  return socket;
}
