import { Socket } from "socket.io";

type Connector = Socket | undefined;

class SocketMap {
    private browserSocket: Connector;
    private mobileSocket: Connector;
    mobileWaitings: Array<any> = [];
    browserWaitings: Array<any> = [];

    burnConnect: () => any;

    constructor(opts: {
        browser?: Connector;
        mobile?: Connector;
        burnConnect: () => any;
    }) {
        this.browserSocket = opts.browser;
        this.mobileSocket = opts.mobile;
        this.burnConnect = opts.burnConnect;
        this.init();
    }

    setBrowserSocket = (socket: Socket): void => {
        this.browserSocket = socket;
        this.init();
    };

    setMobileSocket = (socket: Socket): void => {
        this.mobileSocket = socket;
        this.init();
    };
    disconnectAll = (): void => {
        this.browserSocket?.disconnect();
        this.mobileSocket?.disconnect();
        this.burnConnect();
    };

    sendToMobile = (payload: any): void => {
        console.log("msg=>[mobile]", payload);
        if (
            this.mobileSocket === undefined ||
            !this.mobileSocket?.emit("msg", payload)
        ) {
            this.mobileWaitings.push(payload);
        }
    };

    sendToBrowser = (payload: any): void => {
        console.log("msg=>[browser]", payload);
        if (
            this.browserSocket === undefined ||
            !this.browserSocket?.emit("msg", payload)
        ) {
            this.browserWaitings.push(payload);
        }
    };

    init = (): void => {
        this.browserSocket?.on("disconnect", this.disconnectAll);
        this.mobileSocket?.on("disconnect", this.disconnectAll);
        this.browserSocket?.removeAllListeners("msg");
        this.mobileSocket?.removeAllListeners("msg");
        this.browserSocket?.addListener("msg", (payload: any) => {
            if (this.mobileWaitings.length) {
                const waitings = this.mobileWaitings;
                this.mobileWaitings = [];
                waitings.forEach(payload_ => this.sendToMobile(payload_));
            }
            this.sendToMobile(payload);
        });
        this.mobileSocket?.addListener("msg", (payload: any) => {
            if (this.browserWaitings.length) {
                const waitings = this.browserWaitings;
                this.browserWaitings = [];
                waitings.forEach(payload_ => this.sendToBrowser(payload_));
            }
            this.sendToBrowser(payload);
        });
    };
}

export default SocketMap;
