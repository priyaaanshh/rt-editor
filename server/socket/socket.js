import ACTIONS from "../utils/actions.js"; 
import compileRun from "../utils/compileRun.js"; 

const userSocketMap = {};
const roomCodeMap = {};

const getAllConnectedClients = (io, roomId) => {
    return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
        (socketId) => {
            return {
                socketId,
                username: userSocketMap[socketId],
            };
        }
    );
};

export const setupSocket = (io) => {
    io.on("connection", (socket) => {
        socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
            userSocketMap[socket.id] = username;
            socket.join(roomId);

            // If roomCodeMap doesn't have the roomId, initialize it with default values
            if (!roomCodeMap[roomId]) {
                roomCodeMap[roomId] = {
                    lang: "javascript",
                    code: `for(let i = 0; i < 5; i++) console.log(i);`,
                    output: "Run Code to see output."
                };
            }

            const clients = getAllConnectedClients(io, roomId);

            // Notify that new user joined
            clients.forEach(({ socketId }) => {
                io.to(socketId).emit(ACTIONS.JOINED, {
                    clients,
                    username,
                    socketId: socket.id,
                    roomCode: roomCodeMap[roomId],
                });
            });
        });

        // Sync the code
        socket.on(ACTIONS.CODE_CHANGE, ({ roomId, user, newCode }) => {
            if (roomCodeMap[roomId]) roomCodeMap[roomId].code = newCode;
            const data = { updatedCode: newCode, user };
            console.log("CODE_CHANGE : ", data);
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

        // Leave room
        socket.on("disconnecting", () => {
            const rooms = [...socket.rooms];
            // Leave all the rooms
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
};
