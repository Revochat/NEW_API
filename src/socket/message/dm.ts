import User from "../../database/models/User"
import Message from "../../database/models/Message"
import Channel from "../../database/models/Channel"
import bcrypt from "bcrypt"
import UTILS from "../../utils"
import Logger from "../../logger"

export default {
    name: "dm",
    description: "DM a user!",
    run: async function (socket: any, data: any) {
        if(!data) return socket.emit("dm", "Please provide a message")
        if(!data.user_id) return socket.emit("dm", "Please provide a user id")
        if(!data.message) return socket.emit("dm", "Please provide a message")
        if(!data.channel_id) return socket.emit("dm", "Please provide a channel id")
        
        const user = await User.findOne({user_id: data.user_id}) // check if the user exists
        if(!user) return socket.emit("dm", "This user doesn't exist")

        // check if the user is a friend of the sender
        if(!socket.user.friends.includes(user.user_id)) return socket.emit("dm", "This user isn't your friend")

        const channel = await Channel.findOne({channel_id: data.channel_id}) // check if the channel exists
        if(!channel) return socket.emit("dm", "This channel doesn't exist")

        // check if the user is in the channel
        if(!channel.members.includes(user.user_id)) return socket.emit("dm", "This user isn't in this channel")

        const message = await Message.create({ // create the message
            message_id: UTILS.GENERATE.USER.default.ID, // generate a message id
            user_id: socket.user.user_id,
            channel_id: channel.channel_id,
            message: data.message,
            created_at: new Date().toLocaleString()
        })

        Logger.info(`User ${socket.user.username} sent a message to ${user.username} in channel ${channel.channel_id}`)

        socket.emit("dm", message) // send the message to the sender

        return socket
    }
}