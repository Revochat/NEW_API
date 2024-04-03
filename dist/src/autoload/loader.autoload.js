"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Autoload = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const logger_1 = __importDefault(require("../logger"));
const connect_database_1 = __importDefault(require("../database/connect.database"));
const socket_io_1 = __importDefault(require("socket.io"));
const fs_1 = __importDefault(require("fs"));
const config_1 = require("../../config");
const path_1 = __importDefault(require("path"));
const socket_struct_autoload_1 = require("./socket_struct.autoload");
const express_1 = __importDefault(require("express"));
const User_1 = __importDefault(require("../database/models/User"));
const Channel_1 = __importDefault(require("../database/models/Channel"));
const peer_1 = require("peer");
const utils_1 = __importDefault(require("../utils"));
dotenv_1.default.config();
class Autoload {
    constructor() {
        Autoload.port = Number(process.env.API_PORT) || 3000;
        //Autoload.app.use(Autoload.rateLimiter)
        Autoload.start();
        logger_1.default.success("Server started on port " + Autoload.port);
    }
    // Rate limiter methods
    static isRateLimited(socketId) {
        const record = Autoload.clients.get(socketId);
        if (!record)
            return false;
        return record.requests > Autoload.rateLimitThreshold;
    }
    static rateLimiterMiddleware(socket, handler) {
        const socketId = socket.id;
        if (!Autoload.clients.has(socketId)) {
            Autoload.clients.set(socketId, { requests: 0, timer: null });
        }
        const record = Autoload.clients.get(socketId);
        record.requests += 1;
        if (record.requests > Autoload.rateLimitThreshold && !record.timer) {
            // Set the timer only once when the threshold is exceeded
            record.timer = setTimeout(() => {
                record.requests = 0; // reset the request count
                clearTimeout(record.timer); // clear the timer
                record.timer = null; // reset the timer
            }, Autoload.rateLimitDuration);
        }
        if (record.requests > Autoload.rateLimitThreshold) {
            logger_1.default.warn(`Requests from socket ${socketId} are currently blocked due to rate limit.`);
            return; // Just return without processing the request
        }
        handler();
    }
    static autoloadRoutesFromDirectory(directory) {
        const httpMethods = ["get", "post", "put", "delete", "patch", "head", "options"];
        const files = fs_1.default.readdirSync(directory);
        for (const file of files) {
            const fullPath = path_1.default.join(directory, file);
            if (fs_1.default.statSync(fullPath).isDirectory()) {
                Autoload.autoloadRoutesFromDirectory(fullPath);
            }
            else if (file.endsWith('.ts') || file.endsWith('.js')) {
                const route = require(fullPath).default;
                if (route && typeof route.run === 'function' && route.method && route.name) {
                    const httpMethod = route.method.toLowerCase();
                    if (httpMethods.includes(httpMethod)) {
                        Autoload.app[httpMethod](`/api${route.name}`, route.run);
                        logger_1.default.info(`Loaded route ${route.method} /api${route.name}`);
                    }
                    else {
                        logger_1.default.warn(`Unknown HTTP method: ${route.method}`);
                    }
                }
            }
        }
    }
    static autoloadFilesFromDirectory(directory) {
        const handlers = [];
        const files = fs_1.default.readdirSync(directory);
        for (const file of files) {
            const fullPath = path_1.default.join(directory, file);
            if (fs_1.default.statSync(fullPath).isDirectory()) {
                handlers.push(...Autoload.autoloadFilesFromDirectory(fullPath));
            }
            else if (file.endsWith('.ts') || file.endsWith('.js')) {
                const handler = require(fullPath).default;
                handlers.push(handler);
            }
        }
        return handlers;
    }
    static attachHandlersToSocket(socket, newSocket) {
        const handlers = Autoload.autoloadFilesFromDirectory(path_1.default.join(__dirname, '../socket'));
        logger_1.default.info(`Loading ${handlers.length} socket handlers...`);
        for (const handler of handlers) {
            logger_1.default.info(`Loading socket handler ${handler.name}...`);
            if (handler.name && typeof handler.run === 'function') {
                socket.on(handler.name, (message) => {
                    handler.run(newSocket, message);
                });
            }
        }
    }
    static rules() {
        Autoload.app.use((req, res, next) => {
            res.header("*");
            res.header('Content-Type', 'application/json');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Allow-Control-Allow-Headers');
            if (req.method === 'OPTIONS') {
                res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
                return res.status(200).json({});
            }
            next();
        });
    }
    static start() {
        logger_1.default.beautifulSpace();
        logger_1.default.info("Starting server...");
        (0, connect_database_1.default)().then(() => {
            Autoload.rules();
            Autoload.app.use(express_1.default.json()); // This is the middleware that parses the body of the request to JSON format
            Autoload.autoloadRoutesFromDirectory(path_1.default.join(__dirname, '../http'));
            Autoload.port = Number(process.env.API_PORT) || 3000;
            Autoload.app.listen(Autoload.port, () => {
                logger_1.default.success(`Server started on port ${Autoload.port}`);
            });
            (0, peer_1.PeerServer)({ port: Number(process.env.PEERJS_PORT) || 9005, path: "/myapp" });
            Autoload.socket.on("connection", function (socket) {
                try {
                    socket.on("user.connect", (data) => __awaiter(this, void 0, void 0, function* () {
                        logger_1.default.info(`Socket ${socket.id} trying to connect...`);
                        if (!data)
                            return socket.emit("user.connect", { error: "Please provide a token" });
                        const user = yield User_1.default.findOne({ token: data });
                        if (!user)
                            return socket.emit("user.connect", { error: "Invalid token" });
                        user.channels.forEach(channel => socket.join(channel));
                        // set the user as connected
                        user.status = "online";
                        yield user.save();
                        // populate the user with the channels data
                        user.channels = yield Channel_1.default.find({ channel_id: { $in: user.channels } });
                        // populate members of the channels
                        for (let i = 0; i < user.channels.length; i++) {
                            const channel = user.channels[i];
                            channel.members = yield User_1.default.find({ user_id: { $in: channel.members } });
                            user.channels[i] = channel;
                        }
                        // populate the user with the friends data
                        user.friends = yield User_1.default.find({ user_id: { $in: user.friends } });
                        user.friends.map(friend => {
                            utils_1.default.removeSensitiveData(friend);
                        });
                        socket.join(user.user_id); // join the user socket room
                        socket.emit("user.connect", user);
                        const newSocket = (0, socket_struct_autoload_1.redefineSocket)(socket, user);
                        Autoload.attachHandlersToSocket(socket, newSocket);
                        logger_1.default.info(`Socket ${socket.id} connected.`);
                    }));
                    socket.on("disconnect", () => {
                        // set the user as disconnected
                        const newSocket = socket;
                        if (!newSocket.revo || !newSocket.revo.user) {
                            return socket.disconnect(true), socket.emit("user.connect", { error: "An error occured while disconnecting" }), logger_1.default.warn(`Socket ${socket.id} disconnected.`);
                        }
                        const user_id = newSocket.revo.user.user_id;
                        User_1.default.findOne({ user_id }).then(user => {
                            if (!user)
                                return;
                            user.status = "offline";
                            user.save();
                        });
                        logger_1.default.warn(`Socket ${socket.id} disconnected.`);
                        socket.disconnect(true);
                    });
                }
                catch (error) {
                    logger_1.default.error(error);
                    socket.emit("user.connect", { error: "An error occured" });
                }
            });
            logger_1.default.beautifulSpace();
            Autoload.logInfo();
            logger_1.default.beautifulSpace();
        });
    }
    static stop() {
        Autoload.socket.close();
    }
}
exports.Autoload = Autoload;
Autoload.app = (0, express_1.default)();
Autoload.socket = new socket_io_1.default.Server(process.env.SOCKET_PORT ? Number(process.env.SOCKET_PORT) : 3001);
Autoload.port = process.env.API_PORT ? Number(process.env.API_PORT) : 3000;
Autoload.baseDir = path_1.default.resolve(__dirname, "../socket");
Autoload.rateLimitThreshold = 10000; // 10 000 Events par seconde
Autoload.rateLimitDuration = 10000; // 1 seconde
Autoload.clients = new Map();
Autoload.logInfo = () => {
    // ${config.application.description}
    logger_1.default.normal(`
        ${config_1.config.ascii.art}

        Version: ${config_1.config.api.version}
        Port: ${Number(process.env.API_PORT) || 3000}
        Socket Port: ${Number(process.env.SOCKET_PORT) || 3001}
        `);
    // Owners: ${config.application.owners.join(", ")}
};
