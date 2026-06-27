import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { registerRoomHandlers } from "./socket/roomHandlers";
import { registerGameHandlers } from "./socket/gameHandlers";
import { registerBuzzHandlers } from "./socket/buzzHandlers";

const PORT = 3001;

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

io.on("connection", (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  registerRoomHandlers(io, socket);
  registerGameHandlers(io, socket);
  registerBuzzHandlers(io, socket);

  socket.on("disconnect", (reason) => {
    console.log(`[socket] disconnected: ${socket.id} (${reason})`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
