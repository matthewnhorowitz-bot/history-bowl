import { Server, Socket } from "socket.io";
import { rooms, createRoom, generateRoomCode, getPlayers } from "../rooms";
import * as E from "../../../shared/events";
import { CreateRoomPayload, JoinRoomPayload } from "../../../shared/types";

export function registerRoomHandlers(io: Server, socket: Socket): void {
  socket.on(E.C_CREATE_ROOM, ({ hostName }: CreateRoomPayload) => {
    if (!hostName?.trim()) {
      socket.emit(E.S_ERROR, { message: "Name is required", code: "INVALID_NAME" });
      return;
    }

    const code = generateRoomCode();
    const room = createRoom(code, socket.id, hostName.trim());
    socket.join(code);

    socket.emit(E.S_ROOM_JOINED, {
      roomCode: code,
      players: getPlayers(room),
      isHost: true,
      playerId: socket.id,
    });
  });

  socket.on(E.C_JOIN_ROOM, ({ roomCode, playerName }: JoinRoomPayload) => {
    const code = roomCode?.toUpperCase().trim();
    const name = playerName?.trim();

    if (!name) {
      socket.emit(E.S_ERROR, { message: "Name is required", code: "INVALID_NAME" });
      return;
    }

    const room = rooms.get(code);
    if (!room) {
      socket.emit(E.S_ERROR, { message: "Room not found", code: "ROOM_NOT_FOUND" });
      return;
    }

    if (room.state !== "LOBBY") {
      socket.emit(E.S_ERROR, { message: "Game already in progress", code: "GAME_IN_PROGRESS" });
      return;
    }

    const nameTaken = Array.from(room.players.values()).some((p) => p.name.toLowerCase() === name.toLowerCase());
    if (nameTaken) {
      socket.emit(E.S_ERROR, { message: "Name already taken", code: "NAME_TAKEN" });
      return;
    }

    room.players.set(socket.id, { id: socket.id, name, score: 0, isHost: false });
    socket.join(code);

    socket.emit(E.S_ROOM_JOINED, {
      roomCode: code,
      players: getPlayers(room),
      isHost: false,
      playerId: socket.id,
    });

    socket.to(code).emit(E.S_PLAYER_JOINED, { players: getPlayers(room) });
  });

  socket.on(E.C_LEAVE_ROOM, ({ roomCode }: { roomCode: string }) => {
    handlePlayerLeave(io, socket, roomCode);
  });

  socket.on("disconnect", () => {
    // Find any room this socket is in
    for (const [code] of rooms) {
      handlePlayerLeave(io, socket, code);
    }
  });
}

export function handlePlayerLeave(io: Server, socket: Socket, roomCode: string): void {
  const room = rooms.get(roomCode);
  if (!room || !room.players.has(socket.id)) return;

  room.players.delete(socket.id);
  socket.leave(roomCode);

  if (room.players.size === 0) {
    // Clean up empty room after delay
    if (room.cleanupTimer) clearTimeout(room.cleanupTimer);
    room.cleanupTimer = setTimeout(() => {
      if (rooms.get(roomCode)?.players.size === 0) {
        if (room.readingTimer) clearInterval(room.readingTimer);
        if (room.answerTimer) clearTimeout(room.answerTimer);
        rooms.delete(roomCode);
      }
    }, 60_000);
    return;
  }

  // Migrate host if needed
  if (room.hostSocketId === socket.id) {
    const next = Array.from(room.players.values())[0];
    next.isHost = true;
    room.hostSocketId = next.id;
    io.to(roomCode).emit(E.S_HOST_CHANGED, { newHostId: next.id });
  }

  io.to(roomCode).emit(E.S_PLAYER_LEFT, { players: getPlayers(room) });
}
