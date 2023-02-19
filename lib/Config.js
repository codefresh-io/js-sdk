const debug = require('debug')('codefresh:sdk:config');
const _ = require('lodash');
const CFError = require('cf-errors');
const Swagger = require('swagger-client');

const defaults = require('./defaults');
const { ConfigManager } = require('./auth');
const { Http } = require('../helpers/http');
const { NoAuthContext } = require('./auth/contexts');

const staticManager = new ConfigManager();

class Config {
    constructor({ context, swagger, options = {}, http }) {
        this.context = context;
        this.swagger = swagger;
        this.options = options;
        this.http = http;
    }

    static manager() {
        return staticManager;
    }

    /**
     * @param {string} [options.context] - context to load (by default loads current)
     * @param {string} [options.configPath] - path to .cfconfig file (default: $CFCONFIG or '$HOME/.cfconfig')
     *
     * @param {string} [options.url] - codefresh api url
     * @param {string} [options.spec.url] - url for retrieving openapi.json spec
     * @param {string/Object} [options.spec.json] - raw openapi.json spec
     * @param {Number} [options.request.timeout] - request timeout
     * @param {Number} [options.request.maxAttempts] - max request retries
     * @param {Number} [options.request.retryDelay] - request retry delay
     * @param {Function} [options.request.retryStrategy] - (err, res) => true/false - whether to retry or not
     * @param {Object} [options.request.headers] - headers for client
     * */
    static async fromCodefreshConfig(options = {}) {
        const {
            url,
            context: contextName,
            configPath = process.env[defaults.CF_CONFIG_ENV] || defaults.CF_CONFIG_PATH,
            allowNoContext,
        } = options;

        debug('trying to load from file:', configPath);
        const manager = new ConfigManager();
        await manager.loadConfig({ configFilePath: configPath });

        let context;
        if (contextName) {
            debug(`trying to retrieve context: '${contextName}'`);
            context = manager.getContextByName(contextName);
            if (!context) {
                const message = `No such context '${context}' at file ${configPath}`;
                debug(message);
                throw new CFError(message);
            }
        }

        if (!manager.hasContexts()) {
            debug('config file has no contexts - using NoAuthContext');
            const noAuthContext = new NoAuthContext({ url: url || defaults.URL });
            return this._initializeConfig(noAuthContext, options);
        }

        if (!context) {
            debug(`using current context: '${manager.currentContextName}'`);
            context = manager.getCurrentContext();
            if (!context && !allowNoContext) {
                const message = 'Failed to create context from file - '
                    + `Current context "${manager.currentContextName}" does not exist.`
                    + ' You must select another context using \'auth use-context <context>\'';
                debug(message);
                throw new CFError(message);
            }
        }

        try {
            return await this._initializeConfig(context, options);
        } catch (e) {
            throw new CFError({
                message: 'Failed to create context from file',
                cause: e,
            });
        }
    }

    /**
     * @param {string} [options.url] - codefresh api url
     * @param {string} [options.apiKey] - codefresh api key
     *
     * @param {string} [options.apiKeyEnv] - name of the apiKey env var (default: 'CF_API_KEY')
     * @param {string} [options.urlEnv] - name of the url env var (default: 'CF_URL')
     *
     * @param {string} [options.context] - context to load (by default loads current)
     * @param {string} [options.configPath] - path to .cfconfig file (default: '$HOME/.cfconfig'
     *
     * @param {string} [options.spec.url] - url for retrieving openapi.json spec
     * @param {string/Object} [options.spec.json] - raw openapi.json spec
     * @param {Number} [options.request.timeout] - request timeout
     * @param {Number} [options.request.maxAttempts] - max request retries
     * @param {Number} [options.request.retryDelay] - request retry delay
     * @param {Function} [options.request.retryStrategy] - (err, res) => true/false - whether to retry or not
     * @param {Object} [options.request.headers] - headers for client
     * */
    static async load(options = {}) {
        debug('auto detect config');
        try {
            if (options.apiKey) {
                debug('trying to load using: _fromProvided');
                return await this._fromProvided(options);
            }

            if (options.context) {
                debug('trying to load using: fromCodefreshConfig');
                return await this.fromCodefreshConfig(options);
            }

            try {
                debug('trying to load using: _fromEnv');
                return await this._fromEnv(options);
            } catch (err) {
                if (err.toString().includes(`Config: process.env.${defaults.CF_TOKEN_ENV} is not provided`)) {
                    debug('trying to load using: fromCodefreshConfig');
                    return await this.fromCodefreshConfig(options);
                }

                throw err;
            }
        } catch (err) {
            throw new CFError({
                message: 'Could not load config',
                cause: err,
            });
        }
    }

    /**
     * @param {string} [options.url] - codefresh api url
     * @param {string} [options.spec.url] - url for retrieving openapi.json spec
     * @param {string/Object} [options.spec.json] - raw openapi.json spec
     * @param {Number} [options.request.timeout] - request timeout
     * @param {Number} [options.request.maxAttempts] - max request retries
     * @param {Number} [options.request.retryDelay] - request retry delay
     * @param {Function} [options.request.retryStrategy] - (err, res) => true/false - whether to retry or not
     * @param {Object} [options.request.headers] - headers for client
     * */
    static async _fromEnv(options = {}) {
        debug('trying to load from env');

        const apiKey = process.env[defaults.CF_TOKEN_ENV];
        const url = process.env[defaults.CF_URL_ENV];

        if (!apiKey) {
            const message = `Config: process.env.${defaults.CF_TOKEN_ENV} is not provided`;
            debug(message);
            throw new CFError(message);
        }

        debug('%o', { apiKey: `${apiKey && apiKey.substring(0, 10)}...`, url });
        try {
            return await this._fromProvided(_.defaultsDeep({ apiKey, url }, options));
        } catch (e) {
            throw new CFError({
                message: 'Failed to create context from env',
                cause: e,
            });
        }
    }

    /**
     * @param {string} [options.url] - codefresh api url
     * @param {string} options.apiKey - codefresh api key
     *
     * @param {string} [options.spec.url] - url for retrieving openapi.json spec
     * @param {string/Object} [options.spec.json] - raw openapi.json spec
     * @param {Number} [options.request.timeout] - request timeout
     * @param {Number} [options.request.maxAttempts] - max request retries
     * @param {Number} [options.request.retryDelay] - request retry delay
     * @param {Function} [options.request.retryStrategy] - (err, res) => true/false - whether to retry or not
     * @param {Object} [options.request.headers] - headers for client
     * */
    static async _fromProvided(options = {}) {
        debug('trying to load from provided');
        const {
            apiKey,
            url = defaults.URL,
        } = options;
        if (!apiKey) {
            const message = 'Config: apiKey is not provided';
            debug(message);
            throw new CFError(message);
        }
        if (!url) { // if null
            const message = 'Config: url is not provided';
            debug(message);
            throw new CFError(message);
        }

        try {
            const context = await staticManager.createContext({ apiKey, url });
            return await this._initializeConfig(context, options);
        } catch (e) {
            throw new CFError({
                message: 'Failed to create context from provided apiKey and url',
                cause: e,
            });
        }
    }

    static nonAuthenticated(options = {}) {
        const { url } = options;
        const noAuthContext = new NoAuthContext({ url: url || defaults.URL });
        return this._initializeConfig(noAuthContext, options);
    }

    static async _initializeConfig(context, options = {}) {
        debug('_initializeConfig');
        if (!context) {
            if (options.allowNoContext) {
                return new Config({ context, options });
            }
            const message = 'Context is not provided';
            debug(message);
            throw new CFError(message);
        }
        const {
            request = {},
            spec: {
                url: _specUrl,
                json,
                // todo: support versions and cache
                version, // eslint-disable-line
            } = {},
        } = options;

        request.baseUrl = context.url; // for non-swagger api calls [ usage: await sdk.http(options) ]
        const requestOptions = _.defaultsDeep(request, context.prepareHttpOptions());
        const http = Http(requestOptions);

        // todo: support versions and cache
        const specUrl = _specUrl || `${context.url}${defaults.SPEC_URL_SUFFIX}`;
        let spec = json;
        if (!spec) {
            debug('loading spec:', specUrl);
            spec = await http({ url: specUrl, qs: { disableFilter: true } });
        }
        if (_.isString(spec)) {
            spec = JSON.parse(spec);
        }
        _.set(options, 'spec.json', spec);

        const url = `${context.url}${defaults.API_SUFFIX}`;
        debug('base url:', url);
        spec.servers = [{ url }];

        debug('creating swagger client...');
        const swaggerConfig = { http, spec: _.cloneDeep(spec) };
        const swagger = await Swagger(swaggerConfig);

        return new Config({ context, swagger, options, http });
    }
}

module.exports = Config;
