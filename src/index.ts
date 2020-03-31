/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Server } from "http";
import Express from "express";
import socketio from "socket.io";
import SocketMap from "./socketMap";
const app = Express();
const server = new Server(app);
const soc = socketio(server);

server.listen(8888);

const Maps: Map<string, SocketMap> = new Map();

soc.on("connection", socket => {
    console.log("conn", socket.id);
    socket.on("register", (payload: any) => {
        const { from } = payload;
        if (from === "browser") {
            // 1. gen uid
            const { pubkey } = payload;
            const socketMap = new SocketMap();
            const ret = socketMap.setBrowserSocket(socket, pubkey);
            if (ret.result) {
                const idx = ret.channel!;
                socketMap.setDisconnectHandler((id: string) => {
                    Maps.delete(id);
                });
                Maps.set(idx, socketMap);
                socket.emit("register", {
                    result: true,
                    body: {
                        channel: ret.channel,
                        id: idx
                    }
                });
            } else {
                socket.emit("register", {
                    result: false,
                    body: ret.reason
                });
            }
        } else if (payload.from === "mobile") {
            const { id, signature = "" } = payload;
            const socketMap = Maps.get(id);
            if (typeof socketMap === "undefined") {
                socket.emit("register", {
                    result: false,
                    body: "socketMap not found"
                });
            } else {
                const ret = socketMap.setMobileSocket(socket, signature);
                if (ret.result) {
                    socket.emit("register", {
                        result: true,
                        body: {
                            channel: socketMap.channel
                        }
                    });
                } else {
                    socket.emit("register", {
                        result: false,
                        body: ret.reason
                    });
                }
            }
        }
    });
});
