import { Server, Socket } from "socket.io";
import { rooms } from "../rooms";
import { handleBuzz, handleSubmitAnswer } from "../game/GameController";
import { handleGameBuzz, handleGameSubmitAnswer } from "../game/ActualGameController";
import * as E from "../../../shared/events";
import { BuzzPayload, SubmitAnswerPayload } from "../../../shared/types";

export function registerBuzzHandlers(io: Server, socket: Socket): void {
  socket.on(E.C_BUZZ, ({ roomCode }: BuzzPayload) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    if (room.mode === "GAME") handleGameBuzz(io, room, socket.id);
    else handleBuzz(io, room, socket.id);
  });

  socket.on(E.C_SUBMIT_ANSWER, ({ roomCode, answer }: SubmitAnswerPayload) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    if (room.mode === "GAME") handleGameSubmitAnswer(io, room, socket.id, answer ?? "");
    else handleSubmitAnswer(io, room, socket.id, answer ?? "");
  });
}
