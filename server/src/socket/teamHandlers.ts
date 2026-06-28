import { Server, Socket } from "socket.io";
import { rooms, getTeams, removeFromTeam, generateTeamId } from "../rooms";
import * as E from "../../../shared/events";

// Teams are formed in the lobby and only matter for the Category Round.
// Any player may create a team or join an existing one.
export function registerTeamHandlers(io: Server, socket: Socket): void {
  socket.on(E.C_CREATE_TEAM, ({ roomCode, name }: { roomCode: string; name: string }) => {
    const room = rooms.get(roomCode);
    if (!room || !room.players.has(socket.id)) return;
    if (room.state !== "LOBBY" || room.mode !== "CATEGORY") return;

    const teamName = (name ?? "").trim().slice(0, 24) || `Team ${room.teams.size + 1}`;
    removeFromTeam(room, socket.id);

    const id = generateTeamId();
    room.teams.set(id, { id, name: teamName, score: 0, memberIds: new Set([socket.id]) });
    room.players.get(socket.id)!.teamId = id;

    io.to(room.code).emit(E.S_TEAMS_UPDATED, { teams: getTeams(room) });
  });

  socket.on(E.C_JOIN_TEAM, ({ roomCode, teamId }: { roomCode: string; teamId: string }) => {
    const room = rooms.get(roomCode);
    if (!room || !room.players.has(socket.id)) return;
    if (room.state !== "LOBBY" || room.mode !== "CATEGORY") return;
    const team = room.teams.get(teamId);
    if (!team) return;

    removeFromTeam(room, socket.id);
    team.memberIds.add(socket.id);
    room.players.get(socket.id)!.teamId = teamId;

    io.to(room.code).emit(E.S_TEAMS_UPDATED, { teams: getTeams(room) });
  });

  socket.on(E.C_LEAVE_TEAM, ({ roomCode }: { roomCode: string }) => {
    const room = rooms.get(roomCode);
    if (!room || !room.players.has(socket.id)) return;
    if (room.state !== "LOBBY" || room.mode !== "CATEGORY") return;

    if (removeFromTeam(room, socket.id)) {
      io.to(room.code).emit(E.S_TEAMS_UPDATED, { teams: getTeams(room) });
    }
  });
}
