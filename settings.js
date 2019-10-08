const fs = require('fs')
const path = require('path')

const confFilePath = path.join(__dirname, 'etc/settings.json')

let settings = null

module.exports.get = function() {
    if (settings !== null) {
        return settings
    }

    settings = JSON.parse(fs.readFileSync(confFilePath))
    return settings
}
