/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
const SYNC_COMMAND = "ADAPTER:SYNC";
const LISTENRER_TIMEOUT = 2 * 60 * 1000;
const SESSION_TIMEOUT = 5 * 1000;
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
type BindFunction = (...args: any) => Deferred<any>;

type Callback = (...data: any[]) => any;

type SessionStatus = {
    isConnect: boolean; // is connect to mobile
    isAlive: boolean; // is mobile socket alive
    isExired: boolean; // is signature expired
    browserId: string; // browser socket id
    mobileId: string; // mobile socket id
};

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

class ConnectorAdapter {
    private uid = 0;
    socket: SocketIOClientStatic["Socket"];
    private channel: string | undefined;
    private prefix: string | undefined;
    // msg transaction
    private transactions: Map<string, Deferred<any>> = new Map();

    // define function
    private callbacks: Map<string, Callback> = new Map();

    // pending msg
    private needWait: Array<MsgPayload<any>> = [];

    // bind function
    fns: Map<string, (...arg: any[]) => Deferred<any>> = new Map();

    private __sync: BindFunction | undefined;

    onDisconnect = () => {};

    constructor(opts: {
        prefix: string;
        socket: SocketIOClientStatic["Socket"];
        channel?: string;
    }) {
        this.socket = opts.socket;
        this.channel = opts.channel;
        this.prefix = opts.prefix;
    }

    setChannel = (channel_: string): void => {
        this.channel = channel_;
    };

    baseInit = (): void => {
        this.socket.addEventListener(this.channel!, this.listener);
        this.__sync = this.bind(SYNC_COMMAND);
        this.define(SYNC_COMMAND, this._sync);
        this.socket.addEventListener(`disconnect:${this.channel}`, () =>
            this.onDisconnect()
        );
    };

    private isConnect = (): boolean => {
        return this.socket.connected && this.needWait.length === 0;
    };

    getSessionStatus = (timeout = SESSION_TIMEOUT): Promise<SessionStatus> => {
        return new Promise((resolve, reject) => {
            if (this.socket.disconnected) {
                return reject("Unable to connect to server");
            } else {
                const timer = setTimeout(() => {
                    reject("request to server time out");
                }, timeout);
                const listener = (payload: SessionStatus): void => {
                    clearTimeout(timer);
                    resolve(payload);
                };
                this.socket.removeEventListener(`session:${this.channel}`);
                this.socket.addEventListener(
                    `session:${this.channel}`,
                    listener
                );
                this.socket.emit(`session:${this.channel}`);
            }
        });
    };

    private getTransactionKey = (data: MsgPayload<any>): string => {
        return `${data.command}(${data.id})`;
    };

    private getUID = (): string => {
        return `${this.prefix}:${this.uid++}`;
    };

    private sender = (data: MsgPayload<any>): void => {
        const force = data.command == SYNC_COMMAND;
        if (!force && !this.isConnect()) {
            this.needWait.push(data);
        } else {
            if (this.socket.connected) {
                this.socket.emit(this.channel!, data);
            } else {
                this.needWait.push(data);
            }
        }
    };

    private listener = (data: MsgPayload<any>): void => {
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
            const timer = setTimeout(() => {
                this.reply(data, "request time out", PayloadStatus.fail);
            }, LISTENRER_TIMEOUT);
            try {
                const result = callback(data.data);
                if (result && result.then) {
                    result
                        .then((d: any) => {
                            this.reply(data, d, PayloadStatus.success);
                            clearTimeout(timer);
                        })
                        .catch((e: any) => {
                            this.reply(data, e, PayloadStatus.fail);
                            clearTimeout(timer);
                        });
                } else {
                    this.reply(data, result, PayloadStatus.success);
                    clearTimeout(timer);
                }
            } catch (err) {
                this.reply(data, err, PayloadStatus.success);
                clearTimeout(timer);
            }
        } else {
            // request but not bind
            this.reply(data, null, PayloadStatus.fail);
        }
    };

    private send = (command: string, data: any): Deferred<any> => {
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

    private reply = (
        data: MsgPayload<any>,
        result: any,
        status: PayloadStatus
    ): void => {
        data.reply = true;
        data.data = result;
        data.status = status;
        this.sender(data);
    };

    private initialize = (): void => {
        if (this.needWait.length > 0) {
            const waiting = this.needWait;
            this.needWait = [];
            waiting.forEach((payload: MsgPayload<any>) => this.sender(payload));
        }
    };

    private _sync = (defines: string[] = []): string[] => {
        defines
            .filter(d => !this.fns.has(d))
            .map(d => {
                this.fns.set(d, this.bind(d));
            });
        this.initialize();
        return Array.from(this.callbacks.keys());
    };

    private sync = (): void => {
        this.__sync!(Array.from(this.callbacks.keys())).then(this._sync);
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

    disconnectChannel = (): void => {
        this.socket.emit(`disconnect:${this.channel}`);
    };
}

export default ConnectorAdapter;
