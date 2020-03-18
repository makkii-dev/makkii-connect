import ConnectorAdapter, { Deferred } from "./connectorAdapter";
import SocketIOClientStatic from "socket.io-client";

class MobileConnectorAdapter extends ConnectorAdapter {
    connID = "";
    isConnectToServer = false;
    referred = new Deferred();
    chatBrowser: (...args: any) => Promise<any> = () =>
        Promise.reject("not connect");

    constructor(sokect: SocketIOClientStatic["Socket"]) {
        super(sokect, "mobile");
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

    register = (id: string): Promise<any> => {
        const payload = {
            from: "mobile",
            id
        };
        this.referred = new Deferred();
        this.socket.emit("register", payload);
        this.socket.removeEventListener("register", this.registerListener);
        this.socket.addEventListener("register", this.registerListener);
        return this.referred;
    };

    registerListener = (payload: any): void => {
        const { success, id } = payload;
        this.isConnectToServer = success;
        this.connID = id;
        if (success) {
            this.referred.resolve(payload);
            // sync
            this.define("chatMobile", this.chat);
            this.define("getAccount", this.getAccount);
            this.define("sendTransaction", this.sendTransaction);
            this.chatBrowser = this.bind("chatBrowser");
        } else {
            this.referred.reject("regester failed");
        }
    };
}

export default MobileConnectorAdapter;
