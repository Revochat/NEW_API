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
const User_1 = __importDefault(require("../../../database/models/User"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const utils_1 = __importDefault(require("../../../utils"));
exports.default = {
    name: "/user/auth/register",
    description: "Register a user",
    method: "POST",
    run: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            var regExp = /^[A-Za-z0-9]+$/;
            const { username, password } = req.body;
            // if username or password badly formatted
            if (!username || !password)
                throw "Badly formatted";
            if (!username.match(regExp) || !password.match(regExp))
                throw "Badly formatted";
            var user = yield User_1.default.findOne({ user_id: username });
            if (user)
                throw "An error occured";
            // create a new user
            const newUser = yield User_1.default.create({
                username: username,
                password: yield bcrypt_1.default.hash(password, 10),
                token: utils_1.default.GENERATE.USER.default.TOKEN,
                wallet_token: null,
                premium_expiration: null,
                avatar: "http://cdn.revochat.org/uploads/avatar/65ba0fdb2fc8b6574169bbd2/120493874.png_1712161920094.png",
                message_privacy: "everyone",
                status: "offline",
                updated_at: new Date(),
                created_at: new Date(),
                last_connection: new Date(),
                servers: [],
                channels: [],
                friends: [],
                friends_requests_received: [],
                friends_requests_sent: [],
                blocked: []
            });
            res.status(200);
            // send the user
            res.send({ user: newUser });
        }
        catch (err) {
            res.status(400);
            res.send("An error occured");
        }
    })
};
