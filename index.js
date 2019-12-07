// read settings file at first
require('./settings').get()

const frontweb = require('./frontweb')
const db = require('./db')

const logger = require('./logger')

db.initializeOnStart().then(() => {
    frontweb.createFrontServer(port => {
        logger.info(`listening on :${port}`)
    })
    frontweb.createDeviceServer(port_d=> {
        logger.info(`listening on :${port_d}`)
    })
})

