import Server from "../packages/server";
import repl from "repl";

const server = Server();

const context = repl.start(">").context;
context.server = server;
