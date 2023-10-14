// ==UserScript==
// @name     Agma Bot Client
// @version  0.1
// @match    *agma.io/*
// @run-at   document-start
// ==/UserScript==

"use strict"

if (window.location.pathname.replaceAll("/", "").length !== 0) return

const status = {
    botsRunning: false,
    botsCount: 0,
    botsTotal: 0
}

let currentSocket, currentServer
function isSocketReady() {
    return currentSocket && currentSocket.readyState === WebSocket.OPEN
}

const displayElements = {
    status: null,
    botCount: null
}
function updateDisplay() {
    if (!(displayElements.status && displayElements.botCount)) return
    
    const ready = isSocketReady()
    displayElements.status.innerText = (status.botsRunning ? "CONNECTED" : ready ? "AVAILABLE" : "DISCONNECTED") + " - " + (currentServer || "?")
    displayElements.status.style.color = status.botsRunning ? "green" : ready ? "white" : "red"
    displayElements.botCount.innerText = `Bots: ${status.botsCount}/${status.botsTotal}`
}

function updateServer(address) {
    currentServer = address
    if (address) send("setServer", address)
    
    updateDisplay()
}

function createSocket() {
    try {
        currentSocket = new WebSocket("ws://localhost:15000")
        
        currentSocket.onopen = () => updateServer(currentServer)
        currentSocket.onclose = (code, reason) => {
            status.botsRunning = false
            status.botsCount = status.botsTotal = 0
            updateDisplay()
            
            setTimeout(createSocket, 2000)
        }
        currentSocket.onmessage = ({ data: message }) => {
            switch ((message = JSON.parse(message)).action) {
            case "updateBots": {
                status.botsCount = message.data.connected
                status.botsTotal = message.data.total
                status.botsRunning = message.data.running
                break
            }
            }
            updateDisplay()
        }
        currentSocket.onerror = (error) => {
            // This'll likely be invoked when an initial connection error occurs, so if the stack is empty, we just ignore it
            if (error.stack) console.log(`Socket errored:\n${error.stack}`)
        }
    } catch (error) {
        console.log(`Error occurred while connecting to the server:\n${error.stack}`)
        return
    }
}

function send(action, data) {
    if (!isSocketReady()) return
    return currentSocket.send(JSON.stringify({ action: action, data: data }))
}

// Hook the send method which'll catch all of the mouse position data which must be sent to the server
WebSocket.prototype.send = new Proxy(WebSocket.prototype.send, {
    apply: (target, thisValue, args) => {
        const result = target.apply(thisValue, args)
        
        if (!(thisValue instanceof WebSocket && args.length > 0)) return result
        
        // Check to see if the current server has changed
        if (thisValue.url && thisValue.url !== currentServer) updateServer(thisValue.url)
        
        let buffer = args[0]
        if (buffer instanceof ArrayBuffer) {
            buffer = new DataView(buffer)
            
            // Check to see if this is the mouse position packet being sent to the server
            if (buffer.byteLength === 9 && buffer.getUint8(0, true) === 70) {
                send(
                    "mousePosition",
                    [
                        buffer.getInt32(1, true),
                        buffer.getInt32(5, true)
                    ]
                )
            }
        }
        
        return result
    }
})

window.addEventListener("load", () => {
    createSocket()
    
    document.addEventListener("keydown", (event) => {
        const command = ({
            'e': "split",
            'r': "feed",
            't': "respawn",
            'g': "toggleRunning",
            'y': "noRespawn"
        })[event.key]
        if (command) send(command)
    })
    
    const statusDiv = document.createElement("div")
    statusDiv.style.background = "rgba(0,0,0,0.4)"
    statusDiv.style.height = "60px"
    statusDiv.style.width = "350px"
    statusDiv.style.position = "absolute"
    statusDiv.style.top = "100%"
    statusDiv.style.left = "50%"
    statusDiv.style.transform = "translate(-50%,-80px)"
    statusDiv.style.display = "block"
    statusDiv.style.textAlign = "center"
    statusDiv.style.fontSize = "16px"
    statusDiv.style.color = "#FFFFFF"
    statusDiv.style.padding = "6px"
    statusDiv.style.zIndex = "1000"
    
    const statusSpan = displayElements.status = document.createElement("span")
    statusSpan.innerText = "?"
    statusDiv.appendChild(statusSpan)
    
    const countSpan = displayElements.botCount = document.createElement("span")
    countSpan.style.position = "absolute"
    countSpan.style.transform = "translate(-50%,-50%)"
    countSpan.style.left = "50%"
    countSpan.style.top = "75%"
    countSpan.style.fontSize = "16px"
    countSpan.innerText = "?"
    statusDiv.appendChild(countSpan)
    
    updateDisplay()
    
    document.body.appendChild(statusDiv)
})
