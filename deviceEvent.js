const db = require('./db')

const deviceListener = new Map()

function removeListener(dvid) {
    if (deviceListener.has(dvid)) {
        const item = deviceListener.get(dvid)
        if (item.req !== null) {
            const offpromise = db.deviceSetOnline(dvid, false).then(() => {
                deviceListener.delete(dvid)
            })
            deviceListener.set(dvid, { req: null, res: null, promise: offpromise })
        }
    }
}

function fire(dvid, data) {
    if (deviceListener.has(dvid)) {
        const { req, res, promise } = deviceListener.get(dvid)
        if (req.session.dvid !== dvid || res.socket === null || res.socket.destroyed) {
            res.end()
            removeListener(dvid)
        }
        else {
            res.write('data: ' + data + '\n\n')
        }
    }
}
module.exports.fire = fire

async function addListener(dvid, req, res) {
    let replacing = false
    while (deviceListener.has(dvid)) {
        const { reqold, resold, promise } = deviceListener.get(dvid)
        if (promise === null) {
            resold.end()
            deviceListener.delete(dvid)
            replacing = true
            break
        }
        else {
            await promise
        }
    }

    let onpromise = null
    if (!replacing) {
        onpromise = db.deviceSetOnline(dvid, true).then(() => {
            deviceListener.get(dvid).promise = null
        })
    }
    deviceListener.set(dvid, { req: req, res: res, promise: onpromise })

    req.on('close', () => removeListener(dvid))

    const tid = setInterval(() => {
        if (res.socket === null || res.socket.destroyed) {
            clearInterval(tid)
        }
        else {
            res.write('data: open\n\n')
        }
    }, 80 * 1000)
}
module.exports.addListener = addListener
