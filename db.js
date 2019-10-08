const mysql = require('mysql2/promise')
const bcrypt = require('bcrypt')
const httpStatus = require('http-status-codes')

const errors = require('./errors')
const settings = require('./settings').get()

const saltRounds = 10

const pool = mysql.createPool(settings.db)
async function connect() {
    const conn =  await pool.getConnection()
    conn.beginTransaction()
    return conn
}

async function userCreate(urname, pass) {
    const passhash = await bcrypt.hash(pass, saltRounds)

    const conn = await connect()
    try {
        const [ results ] = await conn.execute(
            'insert into users ( urname, passhash ) values ?',
            [ urname, passhash ])

        await conn.commit()

        return {
            urid: results.insertId,
            urname: urname
        }
    }
    catch (err) {
        await conn.rollback()
        if (err.code === 'ER_DUP_ENTRY') {
            throw new errors.HttpError(httpStatus.CONFLICT)
        }
        throw err
    }
    finally {
        conn.release()
    }
}
module.exports.userCreate = userCreate

async function userLogin(urname, pass) {
    let urid = null, passhash = null

    const conn = await connect()
    try {
        const [ results ] = await conn.execute(
            'select urid, passhash from users where urname = ?',
            [ urname ])

        if (results.length === 0) {
            throw new errors.HttpError(httpStatus.UNAUTHORIZED)
        }

        urid = results[0]['urid']
        passhash = results[0]['passhash']
    }
    finally {
        conn.release()
    }

    if (await bcrypt.compare(pass, passhash)) {
        return {
            urid: urid,
            urname: urname
        }
    }
    else {
        throw new errors.HttpError(httpStatus.UNAUTHORIZED)
    }
}
module.exports.userLogin = userLogin

async function userGetInfo(urid) {
    const conn = await connect()
    try {
        const [ results ] = await conn.execute(
            'select urname from users where urid = ?',
            [ urid ])

        if (results.length === 0) {
            throw new errors.HttpError(httpStatus.NOT_FOUND)
        }

        return {
            urid: urid,
            urname: results[0]['urname']
        }
    }
    finally {
        conn.release()
    }
}
module.exports.userGetInfo = userGetInfo

async function deviceGetInfo(dvid, urid) {
    const conn = await connect()
    try {
        let results = null

        if (typeof urid === 'undefined') {
            [ results ] = await conn.execute(
                'select urid, dvname, sensor, sensorUpdated from devices where dvid = ?',
                [ dvid ])
        }
        else {
            [ results ] = await conn.execute(
                'select urid, dvname, sensor, senseorUpdated from devices where dvid = ? and urid = ?',
                [ dvid, urid ])
        }

        if (results.length === 0) {
            throw new errors.HttpError(httpStatus.NOT_FOUND)
        }

        return {
            dvid: dvid,
            urid: results[0]['urid'],
            dvname: results[0]['dvname'],
            sensor: results[0]['sensor'],
            sensorUpdated: results[0]['sensorUpdated']
        }
    }
    finally {
        conn.release()
    }
}
module.exports.deviceGetInfo = deviceGetInfo

async function userDeviceList(urid) {
    const conn = await connect()
    try {
        const [ results ] = await conn.execute(
            'select dvid, dvname, sensor, sensorUpdated from devices join users on devices.urid = users.urid'
                + ' where devices.urid = ?',
            [ urid ])

        let dvlist = []
        for (let row of results) {
            dvlist.push({
                dvid: row['dvid'],
                urid: urid,
                dvname: row['dvname'],
                sensor: row['sensor'],
                sensorUpdated: row['sensorUpdated']
            })
        }

        return dvlist
    }
    finally {
        conn.release()
    }
}
module.exports.userDeviceList = userDeviceList

async function userDeviceRegister(urid, dvid, dvname) {
    const conn = await connect()
    try {
        // TODO
        conn.commit()
    }
    catch (err) {
        conn.rollback()
        throw err
    }
    finally {
        conn.release()
    }
}
module.exports.userDeviceRegister = userDeviceRegister
