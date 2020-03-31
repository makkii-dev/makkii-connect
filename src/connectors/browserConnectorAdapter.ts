/* eslint-disable @typescript-eslint/no-var-requires */
import ConnectorAdapter, { Deferred } from "./connectorAdapter";
import { stripZeroXString } from "../utils";
import nacl from "tweetnacl";
const blake2b = require("blake2b");
class BrowserConnectorAdapter extends ConnectorAdapter {
    private priKey: string;
    private pubkey: string;

    getAccount: (...args: any) => Promise<any> = () =>
        Promise.reject("not connect");
    sendTransaction: (...args: any) => Promise<any> = () =>
        Promise.reject("not connect");
    chatMobile: (...args: any) => Promise<any> = () =>
        Promise.reject("not connect");

    deferred = new Deferred<any>();

    constructor(socket: SocketIOClientStatic["Socket"], priKey?: string) {
        super({ socket, prefix: "browser" });
        if (typeof priKey != "undefined") {
            this.priKey = stripZeroXString(priKey);
            try {
                this.pubkey = Buffer.from(
                    nacl.sign.keyPair.fromSecretKey(
                        Buffer.from(stripZeroXString(priKey), "hex")
                    ).publicKey
                ).toString("hex");
            } catch (err) {
                throw new Error("invalid prikey=>" + priKey);
            }
        } else {
            const keyPair = nacl.sign.keyPair.fromSeed(
                nacl.randomBytes(nacl.sign.seedLength)
            );

            this.priKey = Buffer.from(keyPair.secretKey).toString("hex");
            this.pubkey = Buffer.from(keyPair.publicKey).toString("hex");
        }
    }

    private chat = (msg: string): void => {
        console.log(msg);
    };

    register = (): Deferred<any> => {
        this.deferred = new Deferred<any>();
        const payload = {
            pubkey: this.pubkey,
            from: "browser"
        };
        this.socket.emit("register", payload);
        this.socket.removeEventListener("register", this.registerListener);
        this.socket.addEventListener("register", this.registerListener);
        return this.deferred;
    };

    private init = (): void => {
        this.baseInit();
        // sync
        this.define("chatBrowser", this.chat);
        this.getAccount = this.bind("getAccount");
        this.sendTransaction = this.bind("sendTransaction");
        this.chatMobile = this.bind("chatMobile");
    };

    registerListener = (payload: any): void => {
        const { result, body } = payload;
        if (result) {
            const { channel, id } = body;
            this.setChannel(channel);
            this.init();
            const sig = this.genSig(channel);
            this.deferred.resolve({
                result: true,
                body: { signature: sig, id }
            });
        } else {
            this.deferred.reject(payload);
        }
    };
    genSig = (msg: string): string => {
        const hash = blake2b(32)
            .update(Buffer.from(msg))
            .digest();
        const sig = nacl.sign.detached(hash, Buffer.from(this.priKey, "hex"));
        return Buffer.from(sig).toString("hex");
    };
}

export default BrowserConnectorAdapter;
