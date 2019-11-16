const frontweb = require('./frontweb')
const logger = require('./logger')

frontweb.createServer(port => {
    logger.info(`listening on :${port}`)
})
