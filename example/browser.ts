import BrowserConnectorAdapter from "../packages/browser";
import io from "socket.io-client";
import repl from "repl";

const socket = io("ws://localhost:8888");

const browserConnectorAdapter = new BrowserConnectorAdapter(socket);

const context = repl.start(">").context;
context.browser = browserConnectorAdapter;
