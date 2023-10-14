"use strict"

const WebSocket = require("ws")

class BotServer extends WebSocket.Server {
    constructor(port) {
        super({ port: port || 15000 })
        
        this.users = new Set()
    }
    addUser(user) {
        this.users.add(user)
        console.log(`A user has connected (total users: ${this.users.size})`)
        user.socket.on("close", () => this.removeUser(user))
    }
    removeUser(user) {
        this.users.delete(user)
        console.log(`A user has disconnected (total users: ${this.users.size})`)
    }
    sendAll() {
        for (const user of this.users) {
            user.socket.send(...arguments)
        }
    }
}

module.exports = BotServer
