const PORT = 8080

const path = require('path')
const express = require('express')
const session = require('express-session')
const bodyParser = require('body-parser')
const ejs = require('ejs')

const logger = require('./logger')

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

app.get('/', (req, res) => {
    if (typeof req.session.urid === undefined) {
        res.redirect('/signin')
    }
    else {
        res.render('index', { user: '', devices: [] })
    }
})

app.get('/signin', (req, res) => {
    res.render('signin')
})

app.post('/do_signin', (req, res) => {
    res.send('<script>alert("Sign in"); history.go("/");</script>')
})

app.post('/do_signout', (req, res) => {
    req.session.destroy()
    res.send('<script>alert("Sign out"); history.go(-1);</script>')
})

app.get('/signup', (req, res) => {
    res.render('signup')
})

app.post('/do_signup', (req, res) => {
    res.send('<script>alert("Sign up"); history.go("/");</script>')
})

app.get('/register', (req, res) => {
    res.render('register')
})

app.post('/do_register', (req, res) => {
    res.send('<script>alert("Registered"); history.go("/");</script>')
})

app.listen(PORT, () => {
    logger.info(`server listening on :${PORT}`)
})
