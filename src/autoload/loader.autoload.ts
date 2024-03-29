import dotenv from "dotenv"
import Logger from "../logger"
import http from "http"
import DB_Connect from "../database/connect.database";
import Socket from "socket.io"
import fs from "fs"
import { config } from "../../config";
import path from 'path';
import { IUserSocket, redefineSocket } from "./socket_struct.autoload";
import express from "express";
import User from "../database/models/User";
import Channel from "../database/models/Channel";
import { PeerServer } from "peer";
import UTILS from "../utils";

dotenv.config()

export class Autoload { // This is the class that starts the server
    static app: express.Express = express();
    static socket: Socket.Server = new Socket.Server(process.env.SOCKET_PORT ? Number(process.env.SOCKET_PORT) : 3001);
    static port: number = process.env.API_PORT ? Number(process.env.API_PORT) : 3000;
    static baseDir = path.resolve(__dirname, "../socket");
    
    static rateLimitThreshold = 10000; // 10 000 Events par seconde
    static rateLimitDuration = 10000; // 1 seconde
    static clients = new Map();

    constructor() {
        Autoload.port = Number(process.env.API_PORT) || 3000
        //Autoload.app.use(Autoload.rateLimiter)
        Autoload.start()
        Logger.success("Server started on port " + Autoload.port)
    }

    public static logInfo = () => {
        // ${config.application.description}
        Logger.normal(`
        ${config.ascii.art}

        Version: ${config.api.version}
        Port: ${Number(process.env.API_PORT) || 3000}
        Socket Port: ${Number(process.env.SOCKET_PORT) || 3001}
        `)
        // Owners: ${config.application.owners.join(", ")}
    }


    // Rate limiter methods
    static isRateLimited(socketId: string): boolean {
        const record = Autoload.clients.get(socketId);
        if (!record) return false;

        return record.requests > Autoload.rateLimitThreshold;
    }

    static rateLimiterMiddleware(socket: Socket.Socket, handler: any) {
        const socketId = socket.id;
    
        if (!Autoload.clients.has(socketId)) {
            Autoload.clients.set(socketId, { requests: 0, timer: null });
        }
    
        const record = Autoload.clients.get(socketId);
        record.requests += 1;
    
        if (record.requests > Autoload.rateLimitThreshold && !record.timer) {
            // Set the timer only once when the threshold is exceeded
            record.timer = setTimeout(() => {
                record.requests = 0;  // reset the request count
                clearTimeout(record.timer);  // clear the timer
                record.timer = null;  // reset the timer
            }, Autoload.rateLimitDuration);
        }
    
        if (record.requests > Autoload.rateLimitThreshold) {
            Logger.warn(`Requests from socket ${socketId} are currently blocked due to rate limit.`);
            return;  // Just return without processing the request
        }
    
        handler();
    }
    
    
    protected static autoloadRoutesFromDirectory(directory: string): void {
        const httpMethods: (keyof express.Application)[] = ["get", "post", "put", "delete", "patch", "head", "options"];
        const files = fs.readdirSync(directory);
    
        for (const file of files) {
            const fullPath = path.join(directory, file);
    
            if (fs.statSync(fullPath).isDirectory()) {
                Autoload.autoloadRoutesFromDirectory(fullPath);
            } else if (file.endsWith('.ts') || file.endsWith('.js')) {
                const route = require(fullPath).default;
                if (route && typeof route.run === 'function' && route.method && route.name) {
                    const httpMethod = route.method.toLowerCase() as keyof express.Application;
                    if (httpMethods.includes(httpMethod)) {
                        Autoload.app[httpMethod](`/api${route.name}`, route.run);
                        Logger.info(`Loaded route ${route.method} /api${route.name}`);
                    } else {
                        Logger.warn(`Unknown HTTP method: ${route.method}`);
                    }
                }
            }
        }
    }


    protected static autoloadFilesFromDirectory(directory: string): any[] { // This is the function that is recursively loading all sockets files from the directory socket
        const handlers: any[] = [];
        const files = fs.readdirSync(directory);
    
        for (const file of files) {
            const fullPath = path.join(directory, file);
    
            if (fs.statSync(fullPath).isDirectory()) {
                handlers.push(...Autoload.autoloadFilesFromDirectory(fullPath));
            } else if (file.endsWith('.ts') || file.endsWith('.js')) {
                const handler = require(fullPath).default;
                handlers.push(handler);
            }
        }
    
        return handlers;
    }
    
    protected static attachHandlersToSocket(socket: Socket.Socket, newSocket: IUserSocket) { 
        const handlers = Autoload.autoloadFilesFromDirectory(path.join(__dirname, '../socket'));
        Logger.info(`Loading ${handlers.length} socket handlers...`);
        for (const handler of handlers) {
            Logger.info(`Loading socket handler ${handler.name}...`);
            if (handler.name && typeof handler.run === 'function') {
                socket.on(handler.name, (message: any) => {
                    handler.run(newSocket, message);
                });
            }
        }
    }

    protected static rules() { // This is the function that sets the API rules
        Autoload.app.use((req, res, next) => {
        res.header("Access-Control-Allow-Origin", "*");
        res.header('Content-Type', 'application/json')
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Allow-Control-Allow-Headers');
        if (req.method === 'OPTIONS') {
            res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
            return res.status(200).json({})
        }
        next()
        })
    }

    public static start() { // This is the function that starts the server
        Logger.beautifulSpace()
        Logger.info("Starting server...")
        DB_Connect().then(() => {
            Autoload.rules()
            Autoload.app.use(express.json()) // This is the middleware that parses the body of the request to JSON format
            Autoload.autoloadRoutesFromDirectory(path.join(__dirname, '../http'));
            Autoload.port = Number(process.env.API_PORT) || 3000
            Autoload.app.listen(Autoload.port, () => {
                Logger.success(`Server started on port ${Autoload.port}`)
            });

            PeerServer({ port: Number(process.env.PEERJS_PORT) || 9005, path: "/myapp" });

            Autoload.socket.on("connection", function (socket: Socket.Socket) {
                try {
                    socket.on("user.connect", async (data: string) => {
                        Logger.info(`Socket ${socket.id} trying to connect...`);
                        if(!data) return socket.emit("user.connect", {error:"Please provide a token"})
                        const user = await User.findOne({token: data})
                        if(!user) return socket.emit("user.connect", {error:"Invalid token"})
                        user.channels.forEach(channel => socket.join(channel))

                        // set the user as connected
                        user.status = "online"
                        await user.save()

                        // populate the user with the channels data
                        user.channels = await Channel.find({channel_id: {$in: user.channels}})

                        // populate members of the channels
                        for (let i = 0; i < user.channels.length; i++) {
                            const channel = user.channels[i];
                            channel.members = await User.find({user_id: {$in: channel.members}})
                            user.channels[i] = channel
                        }
                        
                        // populate the user with the friends data
                        user.friends = await User.find({user_id: {$in: user.friends}})
                        user.friends.map(friend => {
                            UTILS.removeSensitiveData(friend)
                        })

                        socket.join(user.user_id) // join the user socket room
                        socket.emit("user.connect", user)
                        const newSocket = redefineSocket(socket, user);
                        Autoload.attachHandlersToSocket(socket, newSocket);
                        Logger.info(`Socket ${socket.id} connected.`);
                    })

                                    
                    socket.on("disconnect", () => {
                        // set the user as disconnected
                        const newSocket = socket as IUserSocket
                        if (!newSocket.revo || !newSocket.revo.user) {
                            return socket.disconnect(true), socket.emit("user.connect", {error:"An error occured while disconnecting"}), Logger.warn(`Socket ${socket.id} disconnected.`);
                        }

                        const user_id = newSocket.revo.user.user_id
    
                        User.findOne({user_id}).then(user => {
                            if(!user) return
                            user.status = "offline"
                            user.save()
                        })
    
                        Logger.warn(`Socket ${socket.id} disconnected.`);
                        socket.disconnect(true)
                    });
                }
                catch (error) {
                    Logger.error(error)
                    socket.emit("user.connect", {error:"An error occured"})
                }

            });

            Logger.beautifulSpace()
            Autoload.logInfo()
            Logger.beautifulSpace()
        })
    }

    public static stop() { // This is the function that stops the server
        Autoload.socket.close()
    }
}
