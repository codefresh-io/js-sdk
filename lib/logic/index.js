const fs = require('fs');

const LOGIC = fs.readdirSync(__dirname)
    .filter((file) => file.endsWith('.logic.js'))
    .reduce((acc, file) => {
        const name = file.replace('.logic.js', '');
        acc[name] = require(`./${file}`); // eslint-disable-line
        return acc;
    }, {});

module.exports = LOGIC;
