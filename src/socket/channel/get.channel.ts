import User from "../../database/models/User";
import Logger from "../../logger";
import Channel from "../../database/models/Channel";

export default {
    name: "channel.get",
    description: "get a channel",
    run: async function (socket: any, data: any) {
        if(!socket.revo.logged) return socket.emit("channel.get", { error: "You are not logged in" });

    }
}