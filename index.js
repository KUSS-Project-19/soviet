// read settings file at first
require('./settings').get()

const frontweb = require('./frontweb')
const db = require('./db')

const logger = require('./logger')

db.initializeOnStart().then(() => {
    frontweb.createServer(port => {
        logger.info(`listening on :${port}`)
    })

        frontweb.createDeviceServer(port => {
        logger.info(`listening on :${port}`)
    })
})

