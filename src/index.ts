import { Server } from "http";
import Express from "express";
import socketio from "socket.io";
import SocketMap from "./socketMap";
const app = Express();
const server = new Server(app);
const soc = socketio(server);

server.listen(8888);

const socketMaps: Map<string, SocketMap> = new Map();

soc.on("connection", socket => {
    console.log("conn", socket.id);
    socket.on("register", (payload: any) => {
        const { id, from } = payload;
        if (from === "browser") {
            // 1. gen uid
            const uid = socket.id;
            const socketMap = new SocketMap({
                browser: socket,
                burnConnect: (): void => {
                    socketMaps.delete(uid);
                }
            });
            socketMaps.set(uid, socketMap);
            socket.emit("register", {
                id: uid,
                success: true
            });
        } else {
            if (socketMaps.has(id)) {
                socketMaps.get(id)?.setMobileSocket(socket);
                socket.emit("register", {
                    id: id,
                    success: true
                });
            } else {
                socket.emit("register", {
                    id: id,
                    success: false
                });
            }
        }
    });
});
