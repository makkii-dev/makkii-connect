/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-var-requires */
import { Socket } from "socket.io";
import { genChannel, stripZeroXString } from "./util";
import nacl from "tweetnacl";
import { expiration_ms as EXPIRATION } from "./constant.json";
const blake2b = require("blake2b");

type Connector = Socket | undefined;
class SocketMap {
    browserSocket: Connector;
    mobileSocket: Connector;
    private browserPubkey = "";
    private timestamp = 0; // map init timestamp, use to calculate signature message
    private expiration = EXPIRATION; // signature exipiration

    private mobileWaitings: Array<any> = [];
    private browserWaitings: Array<any> = [];

    channel = "";

    setChannel = (channel_: string): void => {
        this.channel = channel_;
    };

    setBrowserSocket = (
        socket: Socket,
        pubkey: string
    ): {
        result: boolean;
        channel?: string;
        reason?: string;
        timestamp?: number;
        expiration?: number | string;
    } => {
        if (
            typeof pubkey !== "string" ||
            stripZeroXString(pubkey).length !== 64
        ) {
            return { result: false, reason: "invalid public key" };
        }
        this.browserSocket = socket;
        this.browserPubkey = pubkey;
        const channel = genChannel();
        this.channel = `${socket.id}:${channel}`;
        this.timestamp = Date.now();
        this.setSessionListners();

        return {
            result: true,
            channel: channel,
            timestamp: this.timestamp,
            expiration: this.expiration
        };
    };

    setMobileSocket = (
        socket: Socket,
        signature: string
    ): { result: boolean; reason?: string } => {
        if (typeof this.browserSocket === "undefined") {
            return { result: false, reason: "seller sokcet not set" };
        }
        const msg_ =
            EXPIRATION === "INFINITY"
                ? this.channel
                : `${this.channel}:${Math.ceil(
                      Date.now() / Number(EXPIRATION)
                  )}`;
        const msg = blake2b(32)
            .update(Buffer.from(msg_))
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
        if (
            typeof this.mobileSocket != "undefined" &&
            this.mobileSocket.connected
        ) {
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
        this.browserSocket?.removeAllListeners(this.channel);
        this.mobileSocket?.removeAllListeners(this.channel);
        this.browserSocket?.addListener(this.channel, this.browserListener);
        this.mobileSocket?.addListener(this.channel, this.mobileListener);

        // disconnect
        this.browserSocket?.removeAllListeners(`disconnect:${this.channel}`);
        this.mobileSocket?.removeAllListeners(`disconnect:${this.channel}`);
        this.browserSocket?.addListener(`disconnect:${this.channel}`, () =>
            this.disconnectChannel()
        );
        this.mobileSocket?.addListener(`disconnect:${this.channel}`, () =>
            this.disconnectChannel()
        );
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

    getSessionStatus = (): SessionStatus => {
        const isConnect = !!(this.browserSocket && this.mobileSocket);
        const isAlive = !isConnect
            ? false
            : this.browserSocket.connected && this.mobileSocket.connected;
        const isExired =
            this.expiration === "INFINITY"
                ? true
                : Number(this.expiration) + this.timestamp < Date.now();
        return {
            isAlive,
            isConnect,
            isExired,
            browserId: this.browserSocket?.id,
            mobileId: this.mobileSocket?.id
        };
    };

    sessionListener = (sender: Socket): void => {
        sender.emit(`session:${this.channel}`, this.getSessionStatus());
    };

    disconnectChannel = (): void => {
        this.mobileSocket = undefined;
    };
}

export default SocketMap;
