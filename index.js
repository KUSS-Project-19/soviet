const PORT = 8080
const DevicePORT = 3000
const timeout = 6000

const path = require('path')
const express = require('express')
const session = require('express-session')
const bodyParser = require('body-parser')
const ejs = require('ejs')
const joi = require('@hapi/joi')
const httpStatus = require('http-status-codes')

//
const deviceapp = require('http').createServer(express)
const deviceio = require('socket.io')(deviceapp)
//

const db = require('./db')
const errors = require('./errors')
const logger = require('./logger')

//
var dvidDic = {}
//

function validateSchema(obj, schema) {
    const { error, value } = schema.validate(obj)
    if (typeof error !== 'undefined') {
        throw new errors.HttpError(httpStatus.BAD_REQUEST)
    }
}

function validateSession(x) {
    if (typeof x === 'undefined') {
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
    if (typeof req.session.urid === 'undefined') {
        res.redirect('/signin')
    }
    else {
        const urinfo = await db.userGetInfo(req.session.urid)
        const dvlist = await db.userDeviceList(req.session.urid)

        res.render('index', {
            urname: urinfo.urname,
            devices: dvlist
        })
    }
}))

app.get('/signin', (req, res) => {
    res.render('signin')
})

app.post('/do_signin', asyncHandler(async (req, res) => {
    validateSchema(req.body, joi.object({
        urname: joi.string().required(),
        pass: joi.string().required()
    }))

    const urinfo = await db.userLogin(req.body.urname, req.body.pass)
    req.session.urid = urinfo.urid

    let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress
    logger.info(`user login from:${ip} urid:${urinfo.urid}`)

    res.send('<script>alert("Sign in"); location.href = "/";</script>')
}))

app.get('/signout', (req, res) => {
    req.session.destroy()
    res.send('<script>alert("Sign out"); location.href = "/signin";</script>')
})

app.get('/signup', (req, res) => {
    res.render('signup')
})

app.post('/do_signup', asyncHandler(async (req, res) => {
    validateSchema(req.body, joi.object({
        urname: joi.string().required(),
        pass: joi.string().required()
    }))

    const urinfo = await db.userCreate(req.body.urname, req.body.pass)
    req.session.urid = urinfo.urid

    let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress
    logger.info(`user creation from:${ip} urid:${urinfo.urid}`)

    res.send('<script>alert("Sign up"); location.href = "/";</script>')
}))

app.get('/register', (req, res) => {
    validateSession(req.session.urid)

    res.render('register')
})

app.post('/do_register', asyncHandler(async (req, res) => {
    validateSession(req.session.urid)
    validateSchema(req.body, joi.object({
        dvid: joi.number().required().integer().min(0),
        pass: joi.string().required()
    }))

    await db.userDeviceRegister(req.session.urid, Number(req.body.dvid), req.body.pass)

    res.send('<script>alert("Registered"); location.href = "/";</script>')
}))

app.post('/do_action', asyncHandler(async (req, res) => {
    validateSession(req.session.urid)
    validateSchema(req.body, joi.object({
        dvid: joi.number().required().integer().min(0)
    }))

    const dvid = Number(req.body.dvid)

    // check ownership by deviceGetInfo()
    // if user does not own devices, HttpError throwed.
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

//
deviceio.on('connection', function(socket) {
    socket.dvid = null

    socket.on('deviceLog', async function(data) {
        if (socket.dvid != null) {
            try {
                 await db.deviceLog(socket.dvid, data.logData)
            }

            catch (e) {
                console.log('log error\n')
            }

            finally {

            }
        }
    })

    socket.on('login', async function(data){
        console.log('Device logged-in:\n deviceid: ' + data.dvid)

        socket.passwd = data.passwd
        socket.dvid = data.dvid
        var  isValid = true

        try {
            await db.deviceLogin(socket.passwd, socket.dvid)
            await db.deviceOnline(socket.dvid)

            socket.emit('valid', true)
        }

        catch(e) {
            console.log('error\n')
            //socket.dvid = null
            isValid = false
        }

        finally {
            socket.passwd = null
            socket.emit('valid', isValid)
        }
    })

    socket.on('disconnect', function(data) {
         console.log('Device logout:\n deviceid: ' + socket.dvid)
        // ~~~
    })

})
//

app.listen(PORT, () => {
    logger.info(`server listening on :${PORT}`)
})

//
deviceapp.listen(DevicePORT, () => {
    logger.info(`server listening on :${DevicePORT}`)
})
//