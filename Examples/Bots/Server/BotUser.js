"use strict"

const Bot = require("./Bot")

const DEBUG_LEVEL = 3

class BotUser {
    constructor(socket, proxyList, config) {
        this.socket = socket
        
        // Bot adding and deletion is handled by the Bot class
        this.bots = new Set()
        this.mousePosition = [1, 1]
        this.currentServer = null
        this.running = false
        
        this.proxyList = proxyList
        this.proxyConfig = config
        
        socket.onclose = this.onclose.bind(this)
        socket.onerror = this.onerror.bind(this)
        socket.onmessage = this.onmessage.bind(this)
        
        this.onopen()
    }
    
    /* public methods */
    connectBot() {
        for (const bot of this.bots) bot.stop(true)
        this.bots.clear()
        
        const total = Math.min(this.proxyList.length, this.proxyConfig.max)
        for (let i = 0; i < total; i++) {
            setTimeout(() => {
                console.log(`Bot ${i + 1}/${total}`)
                ;(new Bot(this, this.proxyList[i], DEBUG_LEVEL)).init()
            }, this.proxyConfig.joinDelayMs * i)
        }
    }
    send(action, data) {
        this.socket.send(JSON.stringify({ action: action, data: data }))
    }
    updateBotStats() {
        let connected = 0
        for (const bot of this.bots)
            if (bot.playing) connected++
        this.send("updateBots", {
            connected: connected,
            total: this.bots.size,
            running: this.running
        })
    }
    
    /* "private" methods */
    onopen() {
        console.log("Bot user has connected")
        this.updateBotStats()
    }
    onclose() {}
    onerror(error) {
        console.error(`User socket experienced an error:\n${error.stack}`)
    }
    onmessage({ data: message }) {
        switch ((message = JSON.parse(message)).action) {
        case "mousePosition": {
            this.mousePosition = message.data
            break
        }
        case "split": {
            for (const bot of this.bots) bot.split()
            break
        }
        case "feed": {
            for (const bot of this.bots) bot.feed()
            break
        }
        case "setServer": {
            if (this.currentServer === message.data) break
            this.currentServer = message.data
            this.connectBot()
            break
        }
        case "respawn": {
            for (const bot of this.bots) bot.respawn()
            break
        }
        case "toggleRunning": {
            this.running = !this.running
            if (this.running)
                for (const bot of this.bots) bot.start()
            else
                for (const bot of this.bots) bot.stop()
            this.updateBotStats()
            break
        }
        case "noRespawn": {
            for (const bot of this.bots) bot.respawnOnDeath = false
            break
        }
        }
    }
}

module.exports = BotUser
