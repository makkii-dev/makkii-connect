import ConnectorAdapter, { Deferred } from "./connectorAdapter";
import SocketIOClientStatic from "socket.io-client";

class MobileConnectorAdapter extends ConnectorAdapter {
    isConnectToServer = false;
    deferred = new Deferred();
    chatBrowser: (...args: any) => Promise<any> = () =>
        Promise.reject("not connect");

    constructor(socket: SocketIOClientStatic["Socket"]) {
        super({ socket, prefix: "mobile" });
    }

    getAccount = (): any => {
        throw new Error("get Account not implement");
    };

    sendTransaction = (): any => {
        throw new Error("send Transaction not implement");
    };

    chat = (msg: string): void => {
        console.log(msg);
    };

    register = (id: string, sig: string): Promise<any> => {
        const payload = {
            from: "mobile",
            id,
            signature: sig
        };
        this.deferred = new Deferred();
        this.socket.emit("register", payload);
        this.socket.removeEventListener("register", this.registerListener);
        this.socket.addEventListener("register", this.registerListener);
        return this.deferred;
    };

    init = (): void => {
        this.baseInit();
        // sync
        this.define("chatMobile", this.chat);
        this.define("getAccount", this.getAccount);
        this.define("sendTransaction", this.sendTransaction);
        this.chatBrowser = this.bind("chatBrowser");
    };

    registerListener = (payload: any): void => {
        const { result, body } = payload;
        if (result) {
            const { channel } = body;
            // register success
            this.setChannel(channel);
            this.init();
            this.deferred.resolve({ result: true });
        } else {
            this.deferred.reject(payload);
        }
    };
}

export default MobileConnectorAdapter;
