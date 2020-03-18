/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import SocketIOClientStatic from "socket.io-client";
const SYNC_COMMAND = "ADAPTER:SYNC";

enum PayloadStatus {
    success,
    fail,
    pending
}

interface MsgPayload<T> {
    id: string;
    command: string;
    data: T;
    reply: boolean;
    status: PayloadStatus;
}

export class Deferred<T> implements Promise<T> {
    readonly [Symbol.toStringTag]: "Promise";
    promise: Promise<T>;
    resolve: (value?: T) => void = () => {};
    reject: (reason?: T) => void = () => {};

    constructor() {
        this.promise = new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }

    then<TResult1 = T, TResult2 = never>(
        onfulfilled?:
            | ((value: T) => TResult1 | PromiseLike<TResult1>)
            | null
            | undefined,
        onrejected?:
            | ((reason: any) => TResult2 | PromiseLike<TResult2>)
            | null
            | undefined
    ): Promise<TResult1 | TResult2> {
        return this.promise.then(onfulfilled, onrejected);
    }
    catch<TResult = never>(
        onrejected?:
            | ((reason: any) => TResult | PromiseLike<TResult>)
            | null
            | undefined
    ): Promise<T | TResult> {
        return this.promise.catch(onrejected);
    }
    finally(onfinally?: (() => void) | null | undefined): Promise<T> {
        return this.promise.finally(onfinally);
    }
}

type Callback = (...data: any[]) => any;

type BindFunction = (...args: any) => Deferred<any>;

class ConnectorAdapter {
    uid = 0;
    socket: SocketIOClientStatic["Socket"];
    // msg transaction
    transactions: Map<string, Deferred<any>> = new Map();

    // define function
    callbacks: Map<string, Callback> = new Map();

    // pending msg
    needWait: Array<MsgPayload<any>> = [];

    // bind function
    fns: Map<string, (...arg: any[]) => Deferred<any>> = new Map();

    __sync: BindFunction;

    constructor(socket: SocketIOClientStatic["Socket"], readonly prefix = "") {
        this.socket = socket;
        this.socket.addEventListener("msg", this.listener);
        this.__sync = this.bind(SYNC_COMMAND);
        this.define(SYNC_COMMAND, this._sync);
    }

    isConnect = (): boolean => {
        return this.socket.connected && this.needWait.length === 0;
    };

    getTransactionKey = (data: MsgPayload<any>): string => {
        return `${data.command}(${data.id})`;
    };

    getUID = (): string => {
        return `${this.prefix}:${this.uid++}`;
    };

    sender = (data: MsgPayload<any>): void => {
        const force = data.command == SYNC_COMMAND;
        if (!force && !this.isConnect()) {
            this.needWait.push(data);
        } else {
            if (this.socket.connected) {
                this.socket.emit("msg", data);
            } else {
                this.needWait.push(data);
            }
        }
    };

    listener = (data: MsgPayload<any>): void => {
        if (data.reply) {
            // reply from b
            const key = this.getTransactionKey(data);
            if (this.transactions.has(key)) {
                if (data.status === PayloadStatus.success) {
                    this.transactions.get(key)!.resolve(data.data);
                } else {
                    this.transactions.get(key)!.reject(data.data);
                }
                this.transactions.delete(key);
            }
        } else if (this.callbacks.has(data.command)) {
            // request from b and has bind callback
            const callback = this.callbacks.get(data.command)!;
            const result = callback(data.data);
            if (result && result.then) {
                result
                    .then((d: any) =>
                        this.reply(data, d, PayloadStatus.success)
                    )
                    .catch((e: any) => this.reply(data, e, PayloadStatus.fail));
            } else {
                this.reply(data, result, PayloadStatus.success);
            }
        } else {
            // request but not bind
            this.reply(data, null, PayloadStatus.fail);
        }
    };

    send = (command: string, data: any): Deferred<any> => {
        const payload: MsgPayload<any> = {
            command,
            data,
            id: this.getUID(),
            reply: false,
            status: PayloadStatus.pending
        };
        const defer = new Deferred<any>();
        this.transactions.set(this.getTransactionKey(payload), defer);
        this.sender(payload);
        return defer;
    };

    reply = (
        data: MsgPayload<any>,
        result: any,
        status: PayloadStatus
    ): void => {
        data.reply = true;
        data.data = result;
        data.status = status;
        this.sender(data);
    };

    initialize = (): void => {
        if (this.needWait.length > 0) {
            const waiting = this.needWait;
            this.needWait = [];
            waiting.forEach((payload: MsgPayload<any>) => this.sender(payload));
        }
    };

    _sync = (defines: string[] = []): string[] => {
        defines
            .filter(d => !this.fns.has(d))
            .map(d => {
                this.fns.set(d, this.bind(d));
            });
        this.initialize();
        return Array.from(this.callbacks.keys());
    };

    sync = (): void => {
        this.__sync(Array.from(this.callbacks.keys())).then(this._sync);
    };

    bind = (command: string): BindFunction => {
        return (...args: any): Deferred<any> => this.send(command, args);
    };

    define = (command: string, func: Callback): ConnectorAdapter => {
        this.callbacks.set(command, (args: any) => {
            return func(...args);
        });
        if (this.isConnect()) {
            this.sync();
        }
        return this;
    };
}

export default ConnectorAdapter;
