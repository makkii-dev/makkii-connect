/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Server } from "http";
import Express from "express";
import socketio from "socket.io";
import SocketMap from "./socketMap";
import { listenPort } from "./constant.json";

const app = Express();
const server = new Server(app);
const soc = socketio(server);

server.listen(listenPort);

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
                socketMap.setDisconnectHandler((id: string) => {
                    Maps.delete(id);
                });
                Maps.set(ret.channel!, socketMap);
                socket.emit("register", {
                    result: true,
                    body: {
                        channel: ret.channel,
                        timestamp: ret.timestamp,
                        expiration: ret.expiration
                    }
                });
            } else {
                socket.emit("register", {
                    result: false,
                    body: ret.reason
                });
            }
        } else if (payload.from === "mobile") {
            const { channel, signature = "" } = payload;
            const socketMap = Maps.get(channel);
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
