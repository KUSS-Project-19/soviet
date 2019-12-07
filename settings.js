const fs = require('fs')
const path = require('path')
const joi = require('@hapi/joi')

const confFilePath = path.join(__dirname, 'etc/settings.json')

let settings = null

module.exports.get = function() {
    if (settings !== null) {
        return settings
    }

    try {
        settings = JSON.parse(fs.readFileSync(confFilePath))

        const schema = joi.object({
            frontweb: joi.object({
                port: joi.number().required().strict().integer().min(1),
                port_d: joi.number().required().strict().integer().min(1),
                proxy: joi.alternatives(
                    joi.number().strict().integer().min(0),
                    joi.string()).required().allow(null),
                prefix: joi.string().required().allow(''),
                session: joi.object({
                    name: joi.string().required(),
                    secret: joi.string().required()
                }).required()
            }).required(),
            db: joi.object({
                host: joi.string().required(),
                user: joi.string().required(),
                password: joi.string().required(),
                database: joi.string().required()
            }).required()
        })
        const result = schema.validate(settings)
        if (result.error !== undefined) {
            throw result.error
        }

        return settings
    }
    catch (e) {
        console.log(`etc/settings.json is invalid: ${e.message}`)
        process.exit(1)
    }
}
