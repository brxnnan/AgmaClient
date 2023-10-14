"use strict"

const AgmaClient = require("../../../src/AgmaClient")

class Bot extends AgmaClient {
    constructor(user, agent, debugLevel = 0) {
        super().setProxy(agent)
        
        this.user = user
        this.debugLevel = debugLevel
        this.intervals = []
        
        /**
         * This is used as a toggle to control whether the bots respawn after dying
         * In Agma, the only real way to have your cells removed from the map is to die, so this serves as a
         * simple way to clean up all of the bots instead of leaving them sit in place after disconnection
         */
        this.respawnOnDeath = true
        
        this.on("connect", () => {
            this.user.bots.add(this)
            
            this.intervals.push(
                setInterval(() => this.setMousePosition(...this.user.mousePosition), 50)
            )
        
            this.user.updateBotStats()
        })
        this.on("disconnect", () => {
            this.user.bots.delete(this)
            
            for (const interval of this.intervals) clearInterval(interval)
            
            this.intervals = []
        })
        this.on("spawn", () => this.user.updateBotStats())
        this.on("death", () => {
            if (this.respawnOnDeath)
                setTimeout(() => this.spawn(), 2000)
            else
                this.respawnOnDeath = true
            this.user.updateBotStats()
        })
    }
    
    /* public methods */
    init() {
        if (!this.user.currentServer) throw new Error("no server")
        
        this.connect(this.user.currentServer)
    }
    start() {
        if (!this.connected) throw new Error("not connected")
        this.spawn()
    }
    stop(ignoreInit) {
        this.disconnect()
        if (!ignoreInit) setTimeout(() => this.init(), 4000)
    }
}

module.exports = Bot
