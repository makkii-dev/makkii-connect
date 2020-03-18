import ConnectorAdapter, { Deferred } from "./connectorAdapter";
import SocketIOClientStatic from "socket.io-client";

class BrowserConnectorAdapter extends ConnectorAdapter {
    connID = "";
    isConnectToServer = false;

    getAccount: (...args: any) => Promise<any> = () =>
        Promise.reject("not connect");
    sendTransaction: (...args: any) => Promise<any> = () =>
        Promise.reject("not connect");
    chatMobile: (...args: any) => Promise<any> = () =>
        Promise.reject("not connect");

    defer = new Deferred<any>();

    constructor(socket: SocketIOClientStatic["Socket"]) {
        super(socket, "browser");
    }

    private chat = (msg: string): void => {
        console.log(msg);
    };

    register = (): Deferred<any> => {
        this.defer = new Deferred<any>();
        const payload = {
            from: "browser"
        };
        this.socket.emit("register", payload);
        this.socket.removeEventListener("register", this.registerListener);
        this.socket.addEventListener("register", this.registerListener);
        return this.defer;
    };

    registerListener = (payload: any): void => {
        const { success, id } = payload;
        this.isConnectToServer = success;
        this.connID = id;
        if (success) {
            this.defer.resolve(id);
            // sync
            this.define("chatBrowser", this.chat);
            this.getAccount = this.bind("getAccount");
            this.sendTransaction = this.bind("sendTransaction");
            this.chatMobile = this.bind("chatMobile");
        } else {
            this.defer.reject("register failed");
        }
    };
}

export default BrowserConnectorAdapter;
