const mysql = require('mysql2/promise')
const bcrypt = require('bcrypt')
const httpStatus = require('http-status-codes')

const errors = require('./errors')
const settings = require('./settings').get()

const saltRounds = 10

function checkNormalString(str) {
    return /^[a-zA-Z0-9]+$/.test(str)
}

const pool = mysql.createPool(settings.db)
async function connect() {
    const conn =  await pool.getConnection()
    conn.beginTransaction()
    return conn
}

async function initializeOnStart() {
    const conn = await connect()
    try {
        await conn.execute('update devices set isOnline = 0 where 1 = 1')
        await conn.commit()
    }
    finally {
        conn.release()
    }
}
module.exports.initializeOnStart = initializeOnStart

async function userCreate(urname, pass, dvid, dvpw) {
    if (!checkNormalString(urname)) {
        throw new errors.HttpError(httpStatus.BAD_REQUEST)
    }

    const passhash = await bcrypt.hash(pass, saltRounds)

    const conn = await connect()
    try {
        let [ results ] = await conn.execute(
            'select passhash from devices where dvid = ? and urid is null',
            [ dvid ])

        if (results.length === 0) {
            throw new errors.HttpError(httpStatus.NOT_FOUND)
        }

        if (!await bcrypt.compare(dvpw, results[0]['passhash'])) {
            throw new errors.HttpError(httpStatus.NOT_FOUND)
        }

        [ results ] = await conn.execute(
            'insert into users ( urname, passhash ) values ?',
            [ urname, passhash ])

        const urid = results.insertId

        await conn.execute(
            'update devices set urid = ? where dvid = ?',
            [ urid, dvid ])

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

async function deviceLogin(dvid, pass) {
    let dvinfo = null
    let passhash = null

    const conn = await connect()
    try {
        const [ results ] = await conn.execute(
            'select passhash, urid, dvname, isOnline, sensor, sensorUpdated from devices where dvid = ?',
            [ dvid ])

        if (results.length === 0) {
            throw new errors.HttpError(httpStatus.UNAUTHORIZED)
        }

        passhash = results[0]['passhash']
        dvinfo = {
            dvid: dvid,
            urid: results[0]['urid'],
            dvname: results[0]['dvname'],
            isOnline: results[0]['isOnline'] !== 0,
            sensor: results[0]['sensor'],
            sensorUpdated: results[0]['sensorUpdated']
        }
    }
    finally {
        conn.release()
    }

    if (await bcrypt.compare(pass, passhash)) {
        return dvinfo
    }
    else {
        throw new errors.HttpError(httpStatus.UNAUTHORIZED)
    }
}
module.exports.deviceLogin = deviceLogin

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
                'select urid, dvname, isOnline, sensor, sensorUpdated from devices where dvid = ?',
                [ dvid ])
        }
        else {
            [ results ] = await conn.execute(
                'select urid, dvname, isOnline, sensor, sensorUpdated from devices where dvid = ? and urid = ?',
                [ dvid, urid ])
        }

        if (results.length === 0) {
            throw new errors.HttpError(httpStatus.NOT_FOUND)
        }

        return {
            dvid: dvid,
            urid: results[0]['urid'],
            dvname: results[0]['dvname'],
            isOnline: results[0]['isOnline'] !== 0,
            sensor: results[0]['sensor'],
            sensorUpdated: results[0]['sensorUpdated']
        }
    }
    finally {
        conn.release()
    }
}
module.exports.deviceGetInfo = deviceGetInfo

async function deviceSetOnline(dvid, isOnline) {
    const conn = await connect()
    try {
        await conn.execute(
            'update devices set isOnline = ? where dvid = ?',
            [ (isOnline ? 1 : 0), dvid ])

        await conn.commit()
    }
    catch (err) {
        await conn.rollback()
        throw err
    }
    finally {
        conn.release()
    }
}
module.exports.deviceSetOnline = deviceSetOnline

async function deviceUpdateSensor(dvid, value) {
    const conn = await connect()
    try {
        const nowDate = new Date()

        let [ results ] = await conn.execute(
            'update devices set sensor = ?, sensorUpdated = ? where dvid = ?',
            [ value, nowDate, dvid ])

        if (results.affectedRows === 0) {
            throw new errors.HttpError(httpStatus.NOT_FOUND)
        }

        await conn.execute(
            'insert into logtable ( dvid, sensor, sensorUpdated ) values ( ?, ?, ? )',
            [ dvid, value, nowDate ])

        await conn.commit()
    }
    catch (err) {
        await conn.rollback()
        throw err
    }
    finally {
        conn.release()
    }
}
module.exports.deviceUpdateSensor = deviceUpdateSensor

async function userDeviceList(urid) {
    const conn = await connect()
    try {
        const [ results ] = await conn.execute(
            'select dvid, dvname, isOnline, sensor, sensorUpdated'
                + ' from devices join users on devices.urid = users.urid where devices.urid = ?',
            [ urid ])

        let dvlist = []
        for (let row of results) {
            dvlist.push({
                dvid: row['dvid'],
                urid: urid,
                dvname: row['dvname'],
                isOnline: row['isOnline'] !== 0,
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

async function userDeviceLogList(urid, dvid) {
    const conn = await connect()
    try {
        let [ results ] = await conn.execute(
            'select sensor, sensorUpdated from logtable where dvid = ?'
                + ' order by sensorUpdated desc limit 100',
            [ dvid ])

        let logs = []
        for (let row of results) {
            logs.push({
                sensor: Number(row['sensor']),
                sensorUpdated: new Date(row['sensorUpdated'])
            })
        }

        return logs
    }
    finally {
        conn.release()
    }
}
module.exports.userDeviceLogList = userDeviceLogList;

async function userDeviceRegister(urid, dvid, dvname, pass) {
    if (!checkNormalString(dvname)) {
        throw new errors.HttpError(httpStatus.BAD_REQUEST)
    }

    const conn = await connect()
    try {
        let [ results ] = await conn.execute(
            'select passhash from devices where urid is null and dvid = ?',
            [ dvid ])

        if (results.length === 0) {
            throw new errors.HttpError(httpStatus.NOT_FOUND)
        }

        if (!await bcrypt.compare(pass, results[0]['passhash'])) {
            throw new errors.HttpError(httpStatus.UNAUTHORIZED)
        }

        await conn.execute(
            'update devices set urid = ?, dvname = ? where dvid = ?',
            [ urid, dvname, dvid ])

        await conn.commit()
    }
    catch (err) {
        await conn.rollback()
        throw err
    }
    finally {
        conn.release()
    }
}
module.exports.userDeviceRegister = userDeviceRegister
