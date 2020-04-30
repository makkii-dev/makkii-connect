/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Server } from "http";
import Express from "express";
import socketio from "socket.io";
import SocketMap from "./socketMap";
import { listenPort } from "./constant.json";

type BrowserMap = Map<string, SocketMap>;

const ServerFactory = (port = listenPort): Map<string, BrowserMap> => {
    const app = Express();
    const server = new Server(app);
    const soc = socketio(server);

    server.listen(port);

    const Maps: Map<string, BrowserMap> = new Map();

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
                    // when disconnect remove browser
                    socket.removeAllListeners("disconnect");
                    socket.addListener("disconnect", () =>
                        Maps.delete(socket.id)
                    );

                    // remove others connect
                    const browserMap: BrowserMap = new Map();

                    browserMap.set(ret.channel!, socketMap);
                    Maps.set(socket.id, browserMap);

                    socketMap.suicide = (id, channel): boolean =>
                        Maps.get(id)?.delete(channel);

                    socket.emit("register", {
                        result: true,
                        body: {
                            channel: `${socket.id}:${ret.channel}`,
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
                const [browserId, channel_] = channel.split(":");
                const browserMap: BrowserMap = Maps.get(browserId) || new Map();
                const socketMap = browserMap.get(channel_);
                if (typeof socketMap === "undefined") {
                    socket.emit("register", {
                        result: false,
                        body: "connection not found"
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
    return Maps;
};

export default ServerFactory;
