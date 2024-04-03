import User from "../../../database/models/User"
import bcrypt from "bcrypt"
import Channel from "../../../database/models/Channel";
import UTILS from "../../../utils";

export default {
    name: UTILS.EVENTS.User.AddFriend,
    description: "Add a friend to your friend list",
    run: async function (socket: any, data: any) {
        try {
            if(!socket.revo.logged) return socket.emit(UTILS.EVENTS.User.AddFriend, { error: "You are not logged in" });

            if(!data.username) return socket.emit(UTILS.EVENTS.User.AddFriend, { error: "Missing username" });

            const user = socket.revo.user; // get the user from the socket

            const userDocument = await User.findOne({ user_id: user.user_id }); // find the user document
            if (!userDocument) return socket.emit(UTILS.EVENTS.User.AddFriend, { error: "User not found" });

            const friend = await User.findOne({ username: data.username }); // find the friend
            if(!friend) return socket.emit(UTILS.EVENTS.User.AddFriend, { error: "User not found" });

            if(userDocument.user_id === friend.user_id) return socket.emit(UTILS.EVENTS.User.AddFriend, { error: "You can't add yourself as a friend" });
    
            if(userDocument.friends.includes(friend.user_id)) return socket.emit(UTILS.EVENTS.User.AddFriend, { error: "You are already friends with " + friend.username });

            if(userDocument.friends_requests_sent.includes(friend.user_id)) return socket.emit(UTILS.EVENTS.User.AddFriend, { error: "You already sent a friend request to " + friend.username });

            if(userDocument.friends_requests_received.includes(friend.user_id)) { // if the user has a friend request from the friend
                userDocument.friends_requests_received.splice(userDocument.friends_requests_received.indexOf(friend.user_id), 1); // remove the friend request from the user
                friend.friends_requests_sent.splice(friend.friends_requests_sent.indexOf(user.user_id), 1); // remove the friend request from the friend
                
                userDocument.friends.push(friend.user_id); // add the friend to the user
                friend.friends.push(user.user_id); // add the user to the friend

                // create a channel for the user and the friend
                const channel = await Channel.create({
                    channel_name: "HYBRID_" + user.user_id + "_" + friend.user_id,
                    channel_category: "HYBRID",
                    members: [user.user_id, friend.user_id],
                });

                await channel.save(); // save the channel document

                userDocument.channels.push(channel.channel_id); // add the channel to the user
                friend.channels.push(channel.channel_id); // add the channel to the friend
                socket.to(friend.user_id).emit("channel.join", { channel: channel }); // send the channel to the friend

                await userDocument.save(); // save the user document
                await friend.save(); // save the friend document

                socket.emit(UTILS.EVENTS.User.GetFriends, { user: UTILS.removeSensitiveData(friend) }); // send the updated user to the user
                socket.to(friend.user_id).emit(UTILS.EVENTS.User.GetFriends, { user: UTILS.removeSensitiveData(userDocument) }); // send the updated user to the friend

            } else { // if the user doesn't have a friend request from the friend
                userDocument.friends_requests_sent.push(friend.user_id); // add the friend to the user's friend requests sent
                friend.friends_requests_received.push(user.user_id); // add the user to the friend's friend requests received
                await userDocument.save(); // save the user document
                await friend.save(); // save the friend document
                socket.to(friend.user_id).emit(UTILS.EVENTS.User.GetFriendRequestsReceived, { user: UTILS.removeSensitiveData(userDocument) }); // send the updated user to the friend
                socket.emit(UTILS.EVENTS.User.GetFriendRequestsSent, { user: UTILS.removeSensitiveData(friend) }); // send the updated user to the user
            }
        }
        catch (error) {
            console.log(error)
            socket.emit(UTILS.EVENTS.User.AddFriend, { error: "Internal server error" });
        }
    }
}