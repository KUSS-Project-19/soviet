const PORT = 8080

const path = require('path')
const express = require('express')
const session = require('express-session')
const bodyParser = require('body-parser')
const ejs = require('ejs')
const joi = require('@hapi/joi')
const httpStatus = require('http-status-codes')

const db = require('./db')
const errors = require('./errors')
const logger = require('./logger')

function validateSchema(obj, schema) {
    if (joi.validate(obj, schema).error !== null) {
        throw new errors.HttpError(httpStatus.BAD_REQUEST)
    }
}

function validateSession(x) {
    if (typeof x === undefined) {
        throw new errors.HttpError(httpStatus.UNAUTHORIZED)
    }
}

function asyncHandler(fn) {
    return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
}

const deviceListener = new Map()

function deviceEvent(dvid, data) {
    if (deviceListener.has(dvid)) {
        const { req, res } = deviceListener.get(dvid)
        if (req.session.dvid !== dvid || res.socket === null || res.socket.destroyed) {
            res.end()
            deviceListener.delete(dvid)
        }
        else {
            res.write('data: ' + data + '\n\n')
        }
    }
}

function deviceAddListener(dvid, req, res) {
    if (deviceListener.has(dvid)) {
        const { reqold, resold } = deviceListener.get(dvid)
        resold.end()
        deviceListener.delete(dvid)
    }

    deviceListener.set(dvid, { req: req, res: res})
    req.on('close', () => deviceListener.delete(dvid))

    const tid = setInterval(() => {
        if (res.socket === null || res.socket.destroyed) {
            clearInterval(tid)
        }
        else {
            res.write('data: open\n\n')
        }
    }, 80 * 1000)
}

const app = express()

app.set('views', path.join(__dirname, '/views'))
app.set('view engine', 'ejs')
app.engine('html', ejs.renderFile)

app.use(session({
    name: 'soviet.revolution.sid',
    secret: 'mArxLenIN',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 60 * 60 * 1000 }
}))

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

app.get('/', asyncHandler(async (req, res) => {
    if (typeof req.session.urid === undefined) {
        res.redirect('/signin')
    }
    else {
        const urinfo = await db.userGetInfo(req.session.urid)
        const dvlist = await db.userDeviceList(req.session.urid)

        res.render('index', {
            user: urinfo.urname,
            devices: dvlist
        })
    }
}))

app.get('/signin', (req, res) => {
    res.render('signin')
})

app.post('/do_signin', asyncHandler(async (req, res) => {
    validateSchema(req.body, {
        urname: joi.string().required(),
        pass: joi.string().required()
    })

    const urinfo = await db.userLogin(req.body.urname, req.body.pass)
    req.session.urid = urinfo.urid

    let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress
    logger.info(`user login from:${ip} urid:${urinfo.urid}`)

    res.send('<script>alert("Sign in"); history.go("/");</script>')
}))

app.post('/do_signout', (req, res) => {
    req.session.destroy()
    res.send('<script>alert("Sign out"); history.go(-1);</script>')
})

app.get('/signup', (req, res) => {
    res.render('signup')
})

app.post('/do_signup', asyncHandler(async (req, res) => {
    validateSchema(req.body, {
        urname: joi.string().required(),
        pass: joi.string().required()
    })

    const urinfo = await db.userCreate(req.body.urname, req.body.pass)
    req.session.urid = urinfo.urid

    let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress
    logger.info(`user creation from:${ip} urid:${urinfo.urid}`)

    res.send('<script>alert("Sign up"); history.go("/");</script>')
}))

app.get('/register', (req, res) => {
    validateSession(req.session.urid)

    res.render('register')
})

app.post('/do_register', asyncHandler(async (req, res) => {
    validateSession(req.session.urid)
    validateSchema(req.body, {
        dvid: joi.number().required().integer().min(0),
        dvname: joi.string().required()
    })

    await db.userDeviceRegister(req.session.urid, Number(req.body.dvid), req.body.dvname)

    res.send('<script>alert("Registered"); history.go("/");</script>')
}))

app.post('/do_action', asyncHandler(async (req, res) => {
    validateSession(req.session.urid)
    validateSchema(req.body, {
        dvid: joi.number().required().integer().min(0)
    })

    const dvid = Number(req.body.dvid)

    // check ownership by deviceGetInfo()
    await db.deviceGetInfo(dvid, req.session.urid)

    deviceEvent(dvid, 'action')
}))

app.use((err, req, res, next) => {
    if (res.headersSent) {
        return next(err)
    }

    if (err instanceof errors.HttpError) {
        res.status(err.httpCode).json({ code: err.code })
        if (err.code >= 500) {
            logger.error(`[Server Internal Error] ${err.name} (code: ${err.code}): ${err.message}`)
        }
    }
    else {
        next(err)
    }
})

app.listen(PORT, () => {
    logger.info(`server listening on :${PORT}`)
})