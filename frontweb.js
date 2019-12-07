const path = require('path')
const express = require('express')
const session = require('express-session')
const deviceSession = require('express-session')
const bodyParser = require('body-parser')

const SQLiteStore = require('connect-sqlite3')(session);
const devSQLiteStore = require('connect-sqlite3')(deviceSession);

const ejs = require('ejs')
const joi = require('@hapi/joi')

const crypto = require('crypto')
const fs = require('fs')
const fileLoc = path.join(__dirname, 'file/file.txt')

const db = require('./db')
const errors = require('./errors')
const logger = require('./logger')
const deviceEvent = require('./deviceEvent')
const util = require('./util')

const settings = require('./settings').get()

function createServer(callback) {
    const app = express()

    app.set('views', path.join(__dirname, '/views'))
    app.set('view engine', 'ejs')
    app.engine('html', ejs.renderFile)

    let isProxy = false
    if (settings.frontweb.proxy !== null) {
        isProxy = true
        app.set('trust proxy', settings.frontweb.proxy)
    }

    const sessionStore = new SQLiteStore({
        table: 'sessions',
        db: 'sessionsDB.db',
        dir: path.join(__dirname, 'etc')
    })

    app.use(session({
        name: settings.frontweb.session.name,
        secret: settings.frontweb.session.name,
        resave: false,
        saveUninitialized: true,
        cookie: { secure: isProxy, maxAge: 60 * 60 * 1000 },
        store: sessionStore
    }))

    app.use(bodyParser.urlencoded({ extended: true }))
    app.use(bodyParser.json())

    app.get('/', util.asyncHandler(async (req, res) => {
        if (typeof req.session.urid === 'undefined') {
            res.redirect('/signin')
        }
        else {
            const urinfo = await db.userGetInfo(req.session.urid)
            const dvlist = await db.userDeviceList(req.session.urid)

            res.render('index', {
                prefix: settings.frontweb.prefix,
                urname: urinfo.urname,
                devices: dvlist
            })
        }
    }))

    app.get('/logs', util.asyncHandler(async (req, res) => {
        util.validateSession(req.session.urid)
        util.validateSchema(req.query, joi.object({
            dvid: joi.number().required().integer().min(0),
            dvname: joi.string().required()
        }))

        const logs = await db.userDeviceLogList(req.session.urid, Number(req.query.dvid))

        res.render('logs', {
            prefix: settings.frontweb.prefix,
            dvname: req.query.dvname,
            logs: logs
        })
    }))

    app.get('/signin', (req, res) => {
        res.render('signin', {
            prefix: settings.frontweb.prefix
        })
    })

    app.post('/do_signin', util.asyncHandler(async (req, res) => {
        util.validateSchema(req.body, joi.object({
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
        res.render('signup', {
            prefix: settings.frontweb.prefix
        })
    })

    app.post('/do_signup', util.asyncHandler(async (req, res) => {
        util.validateSchema(req.body, joi.object({
            urname: joi.string().required(),
            pass: joi.string().required(),
            dvid: joi.number().required().integer().min(0),
            dvpw: joi.string().required()
        }))

        const urinfo = await db.userCreate(
            req.body.urname, req.body.pass, req.body.dvid, req.body.dvpw)
        req.session.urid = urinfo.urid

        let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress
        logger.info(`user creation from:${ip} urid:${urinfo.urid}`)

        res.send('<script>alert("Sign up"); location.href = "/";</script>')
    }))

    app.get('/register', (req, res) => {
        util.validateSession(req.session.urid)

        res.render('register', {
            prefix: settings.frontweb.prefix
        })
    })

    app.post('/do_register', util.asyncHandler(async (req, res) => {
        util.validateSession(req.session.urid)
        util.validateSchema(req.body, joi.object({
            dvid: joi.number().required().integer().min(0),
            dvname: joi.string().required(),
            pass: joi.string().required()
        }))

        await db.userDeviceRegister(req.session.urid, Number(req.body.dvid),
            req.body.dvname, req.body.pass)

        res.send('<script>alert("Registered"); location.href = "/";</script>')
    }))

    app.post('/do_action', util.asyncHandler(async (req, res) => {
        util.validateSession(req.session.urid)
        util.validateSchema(req.body, joi.object({
            dvid: joi.number().required().integer().min(0)
        }))

        const dvid = Number(req.body.dvid)

        // check ownership by deviceGetInfo()
        // if user does not own devices, HttpError throwed.
        await db.deviceGetInfo(dvid, req.session.urid)

        deviceEvent.fire(dvid, 'action')
        res.end()
    }))

    app.use((err, req, res, next) => {
        if (res.headersSent) {
            return next(err)
        }

        if (err instanceof errors.HttpError) {
            res.status(err.httpCode).json({ code: err.code })
            if (err.code >= 500) {
                logger.error(`frontweb: internal error: ${err.name} (code: ${err.code}): ${err.message}`)
            }
        }
        else {
            next(err)
        }
    })

    app.listen(settings.frontweb.port, () => {
        callback(settings.frontweb.port)
    })
}
module.exports.createServer = createServer

function createDeviceServer(callback) {
    const app = express()

    let isProxy = false
    if (settings.frontweb.proxy !== null) {
        isProxy = true
        app.set('trust proxy', settings.frontweb.proxy)
    }

    const sessionStore = new devSQLiteStore({
        table: 'sessions',
        db: 'deviceSessionsDB.db',
        dir: path.join(__dirname, 'etc')
    })

    app.use(session({
        name: settings.frontweb.session.name,
        secret: settings.frontweb.session.name,
        resave: false,
        saveUninitialized: true,
        cookie: { secure: isProxy, maxAge: 60 * 60 * 1000 },
        store: sessionStore
    }))

    app.use(bodyParser.urlencoded({ extended: true }))
    app.use(bodyParser.json())

    app.post('/device/login', util.asyncHandler(async (req, res) => {
        util.validateSchema(req.body, joi.object({
            dvid: joi.number().required().integer().min(0),
            pass: joi.string().required()
        }))

        const dvid = Number(req.body.dvid)

        const dvinfo = await db.deviceLogin(dvid, req.body.pass)

        req.session.dvid = dvid
        res.json(dvinfo)
    }))

    app.post('/device/sensor', util.asyncHandler(async (req, res) => {
        util.validateSession(req.session.dvid)
        util.validateSchema(req.body, joi.object({
            value: joi.number().required(),
            sensorStr: joi.string().required()
        }))

        const value = Number(req.body.value)

        await db.deviceUpdateSensor(req.session.dvid, value, req.body.sensorStr)
        res.json({ })
    }))

    app.post('/device/version', util.asyncHandler(async (req, res) => {
        util.validateSession(req.session.dvid)
        util.validateSchema(req.body, joi.object({
            fileHash: joi.string().required()
        }))
        
        const hash = crypto.createHash('md5')

        const fileHash = req.body.fileHash
        const input = fs.createReadStream(fileLoc)

        input.on('readable', function(){
            var data = input.read()
            if(data) {
                hash.update(data)
            }

            else {
                console.log(`${hash.digest('hex')} ${fileLoc}`)

                var needUpdate = false

                if (fileHash != hash) {
                    needUpdate = true
                }

                res.json(needUpdate)
            }
        })

    }))

    app.get('/device/event', util.asyncHandler(async (req, res) => {
        util.validateSession(req.session.dvid)

        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cahce',
            'Connection': 'keep-alive'
        })
        res.write('data: open\n\n')

        deviceEvent.addListener(req.session.dvid, req, res)
    }))

    app.get('/device/update', util.asyncHandler(async (req, res) => {
        util.validateSession(req.session.dvid)

        fs.readFile(fileLoc, "binary", function(error, file) {
            if(error) {
                res.writeHead(500, {"Content-Type": "text/plain"});
                res.write(error + "\n");
                res.end();
            } else {
                res.writeHead(200, {"Content-Type": "text/plain"});
                res.write(file, "binary");
                res.end();
            }
        });

    }))

    app.use((err, req, res, next) => {
        if (res.headersSent) {
            return next(err)
        }

        if (err instanceof errors.HttpError) {
            res.status(err.httpCode).json({ code: err.code })
            if (err.code >= 500) {
                logger.error(`frontweb: internal error: ${err.name} (code: ${err.code}): ${err.message}`)
            }
        }
        else {
            next(err)
        }
    })

    app.listen(settings.frontweb.devicePort, () => {
        callback(settings.frontweb.devicePort)
    })
}
module.exports.createDeviceServer = createDeviceServer
