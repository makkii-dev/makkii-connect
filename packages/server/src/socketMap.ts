/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-var-requires */
import { Socket } from "socket.io";
import { genChannel, stripZeroXString } from "./util";
import nacl from "tweetnacl";
import { expiration_ms as EXPIRATION } from "./constant.json";
const blake2b = require("blake2b");

type Connector = Socket | undefined;
type DisconnectHandler = (id: string) => void;

class SocketMap {
    private browserSocket: Connector;
    private mobileSocket: Connector;
    private browserPubkey = "";
    private timestamp = 0;

    mobileWaitings: Array<any> = [];
    browserWaitings: Array<any> = [];

    channel = "";

    setChannel = (channel_: string): void => {
        this.channel = channel_;
    };

    disconnectHandler = (id: string): void => {
        console.log("disconnect id:", id);
    };

    setDisconnectHandler = (handler: DisconnectHandler): void => {
        this.disconnectHandler = handler;
    };

    setBrowserSocket = (
        socket: Socket,
        pubkey: string
    ): {
        result: boolean;
        channel?: string;
        reason?: string;
        timestamp?: number;
        expiration?: number;
    } => {
        if (
            typeof pubkey !== "string" ||
            stripZeroXString(pubkey).length !== 64
        ) {
            return { result: false, reason: "invalid public key" };
        }
        this.browserSocket = socket;
        this.browserPubkey = pubkey;
        this.channel = genChannel();
        this.timestamp = Date.now();
        this.setSessionListners();
        setTimeout(() => {
            if (
                !(
                    this.browserSocket &&
                    this.mobileSocket &&
                    this.browserSocket.connected &&
                    this.mobileSocket.connected
                )
            ) {
                this.disconnectHandler(this.channel);
            }
        }, EXPIRATION);
        return {
            result: true,
            channel: this.channel,
            timestamp: this.timestamp,
            expiration: EXPIRATION
        };
    };

    setMobileSocket = (
        socket: Socket,
        signature: string
    ): { result: boolean; reason?: string } => {
        if (typeof this.browserSocket === "undefined") {
            return { result: false, reason: "seller sokcet not set" };
        }

        const msg = blake2b(32)
            .update(
                Buffer.from(
                    `${this.channel}:${Math.ceil(Date.now() / EXPIRATION)}`
                )
            )
            .digest();

        const res = nacl.sign.detached.verify(
            msg,
            Buffer.from(stripZeroXString(signature), "hex"),
            Buffer.from(stripZeroXString(this.browserPubkey), "hex")
        );
        if (!res) {
            return {
                result: false,
                reason: "invalid signture or signature timeout"
            };
        }
        if (typeof this.mobileSocket != "undefined") {
            return { result: false, reason: "this channel already use" };
        }

        this.mobileSocket = socket;
        this.init();
        this.setSessionListners();
        return { result: true };
    };

    sendToMobile = (payload: any): void => {
        console.log("msg=>[mobile]", payload);
        if (
            this.mobileSocket === undefined ||
            !this.mobileSocket?.emit(this.channel, payload)
        ) {
            this.mobileWaitings.push(payload);
        }
    };

    sendToBrowser = (payload: any): void => {
        console.log("msg=>[browser]", payload);
        if (
            this.browserSocket === undefined ||
            !this.browserSocket?.emit(this.channel, payload)
        ) {
            this.browserWaitings.push(payload);
        }
    };

    init = (): void => {
        this.browserSocket?.on("disconnect", () =>
            this.disconnectHandler(this.channel)
        );
        this.mobileSocket?.on("disconnect", () =>
            this.disconnectHandler(this.channel)
        );
        this.browserSocket?.removeAllListeners(this.channel);
        this.mobileSocket?.removeAllListeners(this.channel);
        this.browserSocket?.addListener(this.channel, this.browserListener);
        this.mobileSocket?.addListener(this.channel, this.mobileListener);
    };

    setSessionListners = (): void => {
        this.browserSocket?.removeAllListeners(`session:${this.channel}`);
        this.mobileSocket?.removeAllListeners(`session:${this.channel}`);
        this.browserSocket?.addListener(`session:${this.channel}`, () =>
            this.sessionListener(this.browserSocket!)
        );
        this.mobileSocket?.addListener(`session:${this.channel}`, () =>
            this.sessionListener(this.mobileSocket!)
        );
    };

    browserListener = (payload: any): void => {
        if (this.mobileWaitings.length) {
            const waitings = this.mobileWaitings;
            this.mobileWaitings = [];
            waitings.forEach(payload_ => this.sendToMobile(payload_));
        }
        this.sendToMobile(payload);
    };

    mobileListener = (payload: any): void => {
        if (this.browserWaitings.length) {
            const waitings = this.browserWaitings;
            this.browserWaitings = [];
            waitings.forEach(payload_ => this.sendToBrowser(payload_));
        }
        this.sendToBrowser(payload);
    };

    sessionListener = (sender: Socket): void => {
        if (
            this.browserSocket &&
            this.mobileSocket &&
            this.browserSocket.connected &&
            this.mobileSocket.connected
        ) {
            sender.emit(`session:${this.channel}`, {
                connect: true,
                browser: {
                    id: this.browserSocket.id,
                    pendingTxLen: this.browserWaitings.length
                },
                mobile: {
                    id: this.mobileSocket.id,
                    pendingTxLen: this.mobileWaitings.length
                }
            });
        }
        sender.emit(`session:${this.channel}`, {
            connect: false
        });
    };
}

export default SocketMap;
