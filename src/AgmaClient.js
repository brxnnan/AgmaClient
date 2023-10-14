"use strict"

const WebSocket = require("ws")
const EventEmitter = require("events")

const BinaryBuffer = require("./BinaryBuffer")
const Security = require("./Security")

// Various node types for different objects in the game
const NT_PLAYER_CELL_T0             = 0
const NT_FOOD_T1                = 1
const NT_P_SIZE_T2              = 2
const NT_RESPAWNED_CELL_T3      = 3
const NT_BARRIER_T4                 = 4

class AgmaClient extends EventEmitter {
    constructor() {
        super()
        
        // Set by a different method
        this.socketAddress = undefined
        
        this.security = new Security(this)
        
        // If the client is connected to the server
        this.connected = false
        // If the client is connected and actively playing (not spectating)
        this.playing = false
        
        this.intervals = { serverPlayerCount: null }
        
        this.mousePosition = [0, 0]
        
        this.proxy = { agent: null }
        
        /**
         * This represents to what extent informational messages are printed to the console
         * Its main use is to update the code after an update has been released
         * 0 - nothing
         * 1 - important changes (banned/failed to connect/etc)
         * 2 - most state changes (authentication/died/spawned/etc) + all of 1
         * 3 - every step of connection + all of 2
         * 4 - every opcode received from the server + all of 3
         */
        this.debugLevel = 0
        
        // Array of node objects for my cells
        this.myCellNodes = []
        // Array of node ids for my cells
        this.myCellIds = []
        // Dictionary of [node id] = node object
        this.nodeLookup = {}
        
        this.serverInfo = {
            dimensions: {
                left: 0,
                top: 0,
                right: 0,
                bottom: 0
            },
            settings: {
                resolution: [1920, 1080],
                instantCellMerge: false
            }
        }
    }
    
    /* public methods */
    /* setProxy must be called before connect() */
    setProxy(agent) {
        this.proxy.agent = agent
    }
    async connect(socketAddress) {
        if (this.connected) this.disconnect()
        
        this.socketAddress = socketAddress
        
        try {
            const socket = this.socket = await this.security.getSocket()
            
            socket.binaryType = "arraybuffer"
            socket.onopen = this.onopen.bind(this)
            socket.onclose = this.onclose.bind(this)
            socket.onmessage = this.onmessage.bind(this)
        } catch (error) {
            if (this.debugLevel >= 1) console.error(`Error connecting:\n${error.stack}`)
        }
    }
    disconnect() {
        this.connected = false
        
        for (const [name, id] of Object.entries(this.intervals)) {
            if (!id) continue
            clearInterval(id)
            this.intervals[name] = null
        }
        
        try {
            this.socket.close()
        } catch (error) {
            if (this.debugLevel >= 1) console.error(`Failed to close socket: ${error}`)
        }
        
        this.security.reset()
        
        this.emit("disconnect")
    }
    
    send(buffer, force) {
        if (typeof buffer !== "object" || buffer.constructor.name !== "BinaryBuffer")
            return console.error("Attempted to transmit invalid data!")
        if (!this.socket)
            return console.error("Socket not created")
        if (!force && !(this.socket.readyState === WebSocket.OPEN && this.connected)) {
            if (this.debugLevel >= 1) {
                console.log("------------------")
                console.trace()
                console.error("Attempted to send data when not ready!")
                console.log("------------------")
            }
            return
        }
        
        this.socket.send(buffer.view.buffer)
    }
    sendByte(byte, force) {
        if (typeof byte !== "number")
            return console.error("Attempted to transmit invalid data!")
        
        const buffer = new BinaryBuffer(1)
        buffer.setUint8(0, byte)
        this.send(buffer, force)
    }
    sendSetting(id, data, force) {
        if (!this.connected) return
        
        const buffer = new BinaryBuffer(3)
        buffer.setUint8(0, 4)
        buffer.setUint8(1, Number(id))
        buffer.setUint8(2, Number(data))
        
        this.send(buffer, force)
    }
    
    updateMousePosition() {
        const buffer = new BinaryBuffer(9)
        buffer.setUint8(0, 70)
        buffer.setInt32(1, this.mousePosition[0], true)
        buffer.setInt32(5, this.mousePosition[1], true)
        
        this.send(buffer)
    }
    setMousePosition(x, y) {
        this.mousePosition[0] = x
        this.mousePosition[1] = y
        
        this.updateMousePosition()
    }
    spawn(nickname) {
        if (!nickname) nickname = Math.random().toString(36).slice(2) + "ca-"
        
        // Placeholder value
        const skinId = 0
        
        const buffer = new BinaryBuffer(4 + 2 * nickname.length)
        buffer.setUint8(0, 1)
        buffer.setUint16(1, skinId, true)
        
        for (let i = 0; i < nickname.length; i++) {
            buffer.setUint16(3 + 2 * i, nickname.charCodeAt(i), true)
        }
        this.sendByte(17)
        this.send(buffer)
    }
    respawn(nickname) {
        this.sendByte(59)
        this.spawn(nickname)
    }
    split() {
        if (!this.playing) return
        this.sendByte(25)
    }
    feed() {
        if (!this.playing) return
        this.sendByte(26)
    }
    
    /* "private" methods */
    onNodeDeath(nodeId) {
        let lostCells = false
        
        const node = this.nodeLookup[nodeId]
        
        let foundIndex
        if (node && node.isMine && (foundIndex = this.myCellNodes.indexOf(node)) !== -1) {
            this.myCellNodes.splice(foundIndex, 1)
            lostCells = true
        }
        
        if ((foundIndex = this.myCellIds.indexOf(nodeId)) !== -1)
            this.myCellIds.splice(foundIndex, 1)
        
        // Delete it last
        if (node) delete this.nodeLookup[nodeId]
        
        return lostCells
    }
    onopen() {
        if (this.debugLevel >= 1) console.log("Connected to server! Sending acknowledgement packet...")
        
        this.security.onopen()
        
        this.intervals.serverPlayerCount = setInterval(() => {
            if (this.connected) this.sendByte(94)
        }, 18e3)
        
        this.emit("open")
    }
    onclose(code, reason) {
        this.disconnect()
        
        if (this.debugLevel >= 1) console.log(`Closed with ${code} and ${reason}`)
    }
    onmessage(message) {
        this.security.onmessage(message)
        
        const view = new DataView(message.data)
        
        let offset = view.getUint8(0) === 10 ? 2 : 0
        
        const readString = () => {
            let data = ""
            do {
                const char = view.getUint16(offset, true)
                offset += 2
                if (!char) return data
                data += String.fromCharCode(char)
            } while (true)
        }
        
        const opcode = view.getUint8(offset++)
        if (this.debugLevel >= 4) console.log(`Received network opcode ${opcode}`)
        switch (opcode) {
        case 18: {
            let queueSize = view.getUint16(offset, true)
            offset += 2
            
            for (let i = 0; i < queueSize; i++) {
                // A new player cell is visible to us
                const flags = view.getUint8(offset++)
                if (flags & 2) offset++
                if (flags & 32) offset++
                
                offset += 4
                
                if (flags & 1) offset += 4
                
                readString()
                
                offset += 3
                
                const count = view.getUint8(offset++)
                offset += 3 * count
            }
            
            while (true) {
                const nodeId = view.getUint32(offset, true)
                
                offset += 4
                
                if (nodeId === 0) break
                
                offset += 10
                
                const flags = view.getUint8(offset++)
                const isNewNode = !!(flags & 1)
                
                let nodeType
                if (isNewNode) {
                    nodeType = view.getUint8(offset++)
                    
                    if (flags & 8) offset++
                    
                    offset += 2
                    
                    if (nodeType === NT_PLAYER_CELL_T0) offset += 2
                }
                
                let node = !isNewNode || Object.prototype.hasOwnProperty.call(this.nodeLookup, nodeId) ? this.nodeLookup[nodeId] : null
                if (!node)
                    node = this.nodeLookup[nodeId] = {
                        id: nodeId,
                        isMine: false
                    }
                
                if (isNewNode
                        && nodeType === NT_PLAYER_CELL_T0
                        && !node.isMine
                        && this.myCellIds.indexOf(nodeId) !== -1
                        && this.myCellNodes.indexOf(node) === -1) {
                    this.myCellNodes.push(node)
                    node.isMine = true
                    if (this.myCellNodes.length === 1) {
                        // Server has created the cell, so we've spawned in
                        if (this.debugLevel >= 2) console.log("Spawned in")
                        this.sendByte(13)
                        this.playing = true
                        this.emit("spawn")
                    }
                }
            }
            
            queueSize = view.getUint16(offset, true)
            offset += 2
            
            // Keep track of whether we lost any of our cells so we can detect their death
            let lostCells = false
            
            for (let i = 0; i < queueSize; i++) {
                // const killerId = view.getUint32(offset, true)
                offset += 4
                
                const killedId = view.getUint16(offset, true)
                offset += 2
                
                lostCells = this.onNodeDeath(killedId) || lostCells
            }
            
            queueSize = view.getUint32(offset, true)
            offset += 4
            
            for (let i = 0; i < queueSize; i++) {
                lostCells = this.onNodeDeath(view.getUint16(offset, true)) || lostCells
                offset += 2
            }
            
            if (lostCells && this.myCellNodes.length === 0) {
                if (this.debugLevel >= 2) console.log("Died")
                this.playing = false
                this.emit("death")
            }
            
            break
        }
        case 21: {
            this.myCellNodes = []
            this.myCellIds = []
            this.nodeLookup = {}
            
            break
        }
        case 42: {
            this.myCellIds.push(view.getUint32(offset, true))
            offset += 4
            
            break
        }
        case 55: {
            const server = this.serverInfo
            
            server.dimensions.left = view.getFloat64(offset, true)
            offset += 8
            
            server.dimensions.top = view.getFloat64(offset, true)
            offset += 8
            
            server.dimensions.right = view.getFloat64(offset, true)
            offset += 8
            
            server.dimensions.bottom = view.getFloat64(offset, true)
            offset += 8
            
            if (this.debugLevel >= 2)
                console.log(`Received dimensions: ${server.dimensions.left} / ${server.dimensions.top} / ${server.dimensions.right} / ${server.dimensions.bottom}`)
            
            // Server settings
            const settingsFlags = view.getUint8(offset++)
            server.settings.instantCellMerge = !!(settingsFlags & 1)
            
            server.settings.resolution[0] = view.getUint32(offset, true)
            offset += 4
            server.settings.resolution[1] = view.getUint32(offset, true)
            offset += 4
            
            break
        }
        case 94: {
            const message = readString()
            const colorId = view.getUint8(offset++)
            const lifetime = view.getUint8(offset++)
            if (message === "") {
                if (this.debugLevel >= 3) console.log("Removed announcement")
                // Remove announcement
            } else {
                this.emit("announcement", {
                    message: message,
                    lifetime: lifetime,
                    colorId: colorId
                })
                if (this.debugLevel >= 2)
                    console.log(`Announcement received: ${message}
                    with lifetime: ${lifetime}s
                    with color id: ${colorId}`)
            }
            
            break
        }
        case 110:
        case 249: {
            if (this.debugLevel >= 1) console.log("Connected to server")
            this.connected = true
            this.emit("connect")
            
            break
        }
        }
    }
}

module.exports = AgmaClient
