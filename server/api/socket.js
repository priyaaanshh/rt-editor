import { Server } from "socket.io";

let io;

export const setupSocket = (httpServer) => {
    if (!io) {
        io = new Server(httpServer);
        
        const userSocketMap = {};
        const roomCodeMap = {};

        const getAllConnectedClients = (roomId) => {
            return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
                (socketId) => {
                    return {
                        socketId,
                        username: userSocketMap[socketId],
                    };
                }
            );
        };

        io.on("connection", (socket) => {
            socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
                userSocketMap[socket.id] = username;
                socket.join(roomId);

                if (!roomCodeMap[roomId]) {
                    roomCodeMap[roomId] = {
                        lang: "javascript",
                        code: `for(let i = 0; i < 5; i++) console.log(i);`,
                        output: "Run Code to see output."
                    };
                }

                const clients = getAllConnectedClients(roomId);

                clients.forEach(({ socketId }) => {
                    io.to(socketId).emit(ACTIONS.JOINED, {
                        clients,
                        username,
                        socketId: socket.id,
                        roomCode: roomCodeMap[roomId],
                    });
                });
            });

            socket.on(ACTIONS.CODE_CHANGE, ({ roomId, user, newCode }) => {
                if (roomCodeMap[roomId]) roomCodeMap[roomId].code = newCode;
                const data = { updatedCode: newCode, user };
                socket.in(roomId).emit(ACTIONS.CODE_CHANGE, data);
            });

            socket.on(ACTIONS.RUN_CODE, async ({ roomId, code, language }) => {
                const output = await compileRun(code, language);
                roomCodeMap[roomId].output = output;
                io.to(roomId).emit(ACTIONS.RUN_CODE, { output });
            });

            socket.on(ACTIONS.CHANGE_LANG, ({ roomId, language }) => {
                roomCodeMap[roomId].lang = language;
                io.to(roomId).emit(ACTIONS.CHANGE_LANG, { language });
            });

            socket.on("disconnecting", () => {
                const rooms = [...socket.rooms];
                rooms.forEach((roomId) => {
                    socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
                        socketId: socket.id,
                        username: userSocketMap[socket.id],
                    });
                });

                delete userSocketMap[socket.id];
                socket.leave();
            });
        });
    }
};
