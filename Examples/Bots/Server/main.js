"use strict"

const crypto = require("crypto")
const axios = require("axios")
const fs = require("fs")
const path = require("path")

const BotServer = require("./BotServer")
const BotUser = require("./BotUser")

// For debug runs
const AgmaClient = require("../../../src/AgmaClient")
const ProxyAgent = require("proxy-agent")

const SITE_BASE_URL = "https://agma.io/"
const CURRENT_CLIENT_STR = "js/ag181.js?v=181"
const CURRENT_CLIENT_HASH = "4b1410e2e1a7c3020f32eed529a10579f436d526beae39a3eadf9825010bdc8a"

/**
 * Used for testing when Agma updates; it only connects a single bot to a game server (set in ProxyConfig.json)
 * It doesn't do anything except connect to the server, and is set with the max debug level to display any issues
 */
const DEBUG_RUN = false

/**
 * SINGLE_USER_MODE is useful only when 1 user at any time will be connected to the bot server
 * In the event that the user gets banned from the game, and they reconnect under a different IP,
 * single user mode will give them back control of the bots when they reconnect
 */
const SINGLE_USER_MODE = false

axios.defaults.headers.common["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Gecko/20100101 Firefox/94.1"

const PROXY_CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, "./ProxyConfig.json"), "utf8"))
let PROXY_LIST
{
    const list = []
    for (const proxyString of
         DEBUG_RUN ? [ PROXY_CONFIG.testing.proxy ]
         : fs.readFileSync(path.join(__dirname, "./ProxyList.txt"), "utf8").split("\n")) {
        list.push(new ProxyAgent(`${PROXY_CONFIG.type}://${proxyString}`))
    }
    PROXY_LIST = list
}

function init(clientSource) {
    const hash = crypto.createHash("sha256").update(clientSource).digest("hex")
    if (hash !== CURRENT_CLIENT_HASH) {
        console.log("CLIENT HAS UPDATED! HASHES MISMATCH!")
        console.log(`New hash: ${hash}`)
        return
    } else {
        console.log("Hashes match, starting up...")
    }
    
    if (DEBUG_RUN) {
        const bot = new AgmaClient()
        bot.setProxy(PROXY_LIST[0])
        bot.debugLevel = 4
        
        bot.on("connect", () => {
            console.log(`Bot is connected: ${bot.connected}`)
        })
        
        bot.connect(PROXY_CONFIG.testing.server)
    } else {
        const server = new BotServer()
        
        server.on("listening", () => console.log("Server is listening..."))
        
        let previousUser
        server.on("connection", (socket) => {
            const user = new BotUser(socket, PROXY_LIST, PROXY_CONFIG)
            server.addUser(user)
            if (SINGLE_USER_MODE) {
                socket.on("close", () => console.log("! Single user mode is activated, rejoining the server will reinstate the bots"))
                if (previousUser) {
                    // Provide the new user the previous one's bots
                    user.bots = previousUser.bots
                    user.mousePosition = previousUser.mousePosition
                    user.currentServer = previousUser.currentServer
                    user.running = previousUser.running
                    
                    // Fix user reference for each bot instance
                    for (const bot of previousUser.bots) bot.user = user
                    
                    user.updateBotStats()
                    console.log("Bots have been reinstated")
                }
                previousUser = user
            }
        })
        server.on("error", (error) => {
            console.error(`Server experienced an error:\n${error.stack}`)
        })
    }
}

(async () => {
    try {
        const clientMatch = /js\/ag\d+\.js\?v=\d+/.exec((await axios.get(SITE_BASE_URL)).data)
        if (clientMatch === null) throw new Error("cannot locate client script version")
        if (clientMatch[0] !== CURRENT_CLIENT_STR) throw new Error("CLIENT HAS UPDATED!")
        return init((await axios.get(SITE_BASE_URL + clientMatch[0])).data)
    } catch (error) {
        console.log(`Error while loading and checking website: ${error.message}`)
    }
})()
