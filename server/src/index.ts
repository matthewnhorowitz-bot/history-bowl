import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import path from "path";
import fs from "fs";
import { registerRoomHandlers } from "./socket/roomHandlers";
import { registerGameHandlers } from "./socket/gameHandlers";
import { registerBuzzHandlers } from "./socket/buzzHandlers";

const PORT = Number(process.env.PORT) || 3001;

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

// In production, serve the built React client from this same server so the
// whole app runs as a single service (and the socket connects same-origin).
const clientDist = path.join(__dirname, "..", "..", "client", "dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
}

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
  console.log(`[server] listening on port ${PORT}`);
});
