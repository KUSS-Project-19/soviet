const winston = require('winston')
const { transports, format } = winston

const logger = winston.createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp(),
        format.colorize(),
        format.align(),
        format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)),
    transports: new transports.Console()
})

module.exports = logger
