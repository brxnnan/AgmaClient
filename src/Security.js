"use strict"

/**
 * This class has been mostly stripped to ensure it can't be used maliciously
 */

class Security {
    constructor(client) {
        this.client = client
        
        this.reset()
    }
    
    reset() {
        /* snipped */
    }
    
    async getSocket() {
        /* snipped */
        
        return new WebSocket(this.client.socketAddress, {
            headers: {
                "accept-language": "en-US,en;q=0.5",
                "accept-encoding": "gzip, deflate, br",
                "cache-control": "no-cache",
                "pragma": "no-cache",
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Gecko/20100101 Firefox/94.1"
            },
            agent: this.client.proxy.agent,
            rejectUnauthorized: false
        })
    }
    
    onopen() {
        /* snipped */
    }
    onmessage(message) {
        const view = new DataView(message.data)
    
        /* snipped */
    }
}

module.exports = Security
