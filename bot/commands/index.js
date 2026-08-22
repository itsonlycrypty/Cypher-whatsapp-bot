const fs = require('fs')
const path = require('path')

const commands = {}

function loadCommands() {
    const categories = fs.readdirSync(__dirname).filter(f => f.endsWith('.js') && f !== 'index.js' && f !== 'ai.js')
    categories.forEach(file => {
        const cmds = require(path.join(__dirname, file))
        Object.assign(commands, cmds)
    })
    return commands
}

module.exports = { commands, loadCommands }
