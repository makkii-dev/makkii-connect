import MobileConnectorAdapter from "../src/connectors/mobileConnectorAdapter";
import io from "socket.io-client";
import repl from "repl";

const socket = io("ws://localhost:8888");

const mobileConnectorAdapter = new MobileConnectorAdapter(socket);

const context = repl.start(">").context;
context.mobile = mobileConnectorAdapter;
