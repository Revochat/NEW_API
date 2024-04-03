"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const RevoUserSchema = new mongoose_1.Schema({
    user_id: { type: String, required: false, unique: true },
    token: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    avatar: { type: String, required: false, default: "http://cdn.revochat.org/uploads/avatar/65ba0fdb2fc8b6574169bbd2/120493874.png_1712161920094.png" },
    status: { type: String, required: true, default: "offline" },
    servers: { type: Array, required: true, default: [] },
    channels: { type: Array, required: true, default: [] },
    friends: { type: Array, required: true, default: [] },
    friends_requests_received: { type: Array, required: true, default: [] },
    friends_requests_sent: { type: Array, required: true, default: [] },
}, { timestamps: true });
RevoUserSchema.pre('save', function (next) {
    if (!this.user_id) {
        this.user_id = this._id.toHexString().toString();
    }
    next();
});
exports.default = mongoose_1.default.model("User", RevoUserSchema);
