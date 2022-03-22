const _ = require('lodash');
const request = require('requestretry');
const debug = require('debug')('codefresh:sdk:http');
const defaults = require('../lib/defaults');
const { version } = require('../package.json');

const { handleErrors } = require('./error');

const RETRY_STATUS_CODES = [502, 503, 504];
const RETRY_STRATEGY = (err, response) => {
    if ((process.env.DEBUG || '').startsWith(defaults.DEBUG_PATTERN)) {
        debug('retry disabled: given DEBUG option');
        return false;
    }
    if (err) {
        debug('error: %o', err);
        return request.RetryStrategies.NetworkError(err);
    }
    return RETRY_STATUS_CODES.includes(response.statusCode);
};

function _hideHeaders(config) {
    const _config = _.cloneDeep(config);
    const authHeader = _.get(config, 'headers.Authorization');
    if (authHeader) {
        _config.headers.Authorization = `${authHeader.substring(0, 10)}...`;
    }
    const accessTokenHeader = _.get(config, 'headers.x-access-token');
    if (accessTokenHeader) {
        _config.headers['x-access-token'] = `${accessTokenHeader.substring(0, 10)}...`;
    }
    return _config;
}

const Http = (options) => {
    const {
        baseUrl,
        timeout,
        maxAttempts,
        retryDelay,
        retryStrategy,
        headers = {},
    } = options || {};

    if (!_.get(headers, 'Codefresh-User-Agent-Type') || !_.get(headers, 'Codefresh-User-Agent-Version')) {
        _.set(headers, 'User-Agent', `codefresh-js-sdk-v${version}`);
        _.set(headers, 'Codefresh-User-Agent-Type', 'js-sdk');
        _.set(headers, 'Codefresh-User-Agent-Version', version);
    }

    const config = {
        timeout: _.isInteger(timeout) ? timeout : defaults.TIMEOUT,
        maxAttempts: _.isInteger(maxAttempts) ? maxAttempts : defaults.MAX_RETRIES,
        retryDelay: _.isInteger(retryDelay) ? retryDelay : defaults.RETRY_DELAY,
        retryStrategy: _.isFunction(retryStrategy) ? retryStrategy : RETRY_STRATEGY,
        headers: headers || {},
    };

    request.config = config;
    debug('http created: %o', _hideHeaders(config));

    return new Proxy(request, {
        async apply(handler, that, args) {
            const req = _.first(args) || {};
            _.assign(req, _.defaultsDeep(req, config));
            debug(`${req.method || 'GET'} ${req.url}`);

            if (_.startsWith(req.url, '/') && baseUrl) {
                req.url = `${baseUrl}${req.url}`;
            }
            const response = await handler(...args);
            debug(`status: ${response.statusCode}`);

            handleErrors(response);
            try {
                response.body = JSON.parse(response.body); // json option at request config does not work properly
            } catch (e) {
                debug(`Could not parse response body: ${response.body}`);
            }
            return response.body;
        },
    });
};

Http.RETRY_STRATEGY = RETRY_STRATEGY;

module.exports = { Http };
