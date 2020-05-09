import Server from "../packages/server";
import repl from "repl";

const server = Server(8888, true, "./packages/server");

const context = repl.start(">").context;
context.server = server;
