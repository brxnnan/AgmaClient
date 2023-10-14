"use strict"

/**
 * An extension of a DataView object which has extended methods used solely in Security.js
 */

class BinaryBuffer extends DataView {
    constructor(size) {
        const view = super(new ArrayBuffer(size))
        this.view = view
    }
    
    hashContent(start, length, hashConstant, transform) {
        if (start + length > this.byteLength) length = 1
        
        let hashValue = hashConstant
        for (let i = 0; i < length; i++) {
            hashValue += this.getUint8(start + i)
        }
        
        this.setUint32(start + length, transform ? transform(hashValue) : hashValue, true)
    }
}

module.exports = BinaryBuffer
