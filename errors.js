class HttpError extends Error {
    constructor(code, msg) {
        msg = msg || httpStatus.getStatusText(code)

        super(msg)
        Error.captureStackTrace(this, this.constructor)
        this.name = this.constructor.name
        this.code = 'ERR_HISP_HTTP_CODE_' + code
        this.httpCode = code
    }
}
module.exports.HttpError = HttpError
