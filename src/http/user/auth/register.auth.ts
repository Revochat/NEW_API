import express from "express";
import User from "../../../database/models/User"
import bcrypt from "bcrypt"
import UTILS from "../../../utils"

export default {
    name: "/user/auth/register",
    description: "Register a user",
    method: "POST",
    run: async (req: express.Request, res: express.Response) => {
        try {
            var regExp = /^[A-Za-z0-9]+$/;
            const {username, password} = req.body
            
            // if username or password badly formatted
            if(!username || !password) throw "Badly formatted"

            if (!username.match(regExp) || !password.match(regExp)) throw "Badly formatted";

            var user = await User.findOne({user_id: username})
            if(user) throw "An error occured"

            // create a new user
            const newUser = await User.create({
                username: username,
                password: await bcrypt.hash(password, 10),
                token: UTILS.GENERATE.USER.default.TOKEN,
                
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
            })

            res.status(200)
            // send the user
            res.send({user: newUser})
        }

        catch(err) {
            res.status(400)
            res.send("An error occured");
        }
    }
}