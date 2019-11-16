const httpStatus = require('http-status-codes')

const errors = require('./errors')

function validateSchema(obj, schema) {
    const { error, value } = schema.validate(obj)
    if (typeof error !== 'undefined') {
        throw new errors.HttpError(httpStatus.BAD_REQUEST)
    }
}
module.exports.validateSchema = validateSchema

function validateSession(x) {
    if (typeof x === 'undefined') {
        throw new errors.HttpError(httpStatus.UNAUTHORIZED)
    }
}
module.exports.validateSession = validateSession

function asyncHandler(fn) {
    return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
}
module.exports.asyncHandler = asyncHandler
