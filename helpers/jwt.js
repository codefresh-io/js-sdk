const debug = require('debug')('codefresh:sdk:jwt');
const jwt = require('jsonwebtoken');

const testJwt = (token) => {
    let isJwt = false;
    try {
        isJwt = !!jwt.decode(token);
    } catch (e) {
        debug('could not decode jwt:', e.stack);
    }
    debug('token type:', isJwt ? "'jwt'" : "'apiKey'");
    return isJwt;
};

module.exports = { testJwt };
