const debug = require('debug')('codefresh:sdk:config:manager');
const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const CFError = require('cf-errors');
const yaml = require('js-yaml');
const Promise = require('bluebird');

const fse = require('fs-extra');

const defaults = require('../defaults');
const { testJwt } = require('../../helpers/jwt');

const readFile = Promise.promisify(fs.readFile);
const writeFile = Promise.promisify(fs.writeFile);

// context classes
const { JWTContext, APIKeyContext } = require('./contexts');

/**
 * A singleton that is in charge of providing an easy interface to the authentication configuration file on the file system
 */
class ConfigManager {
    constructor() {
        this.contexts = {};
        this.currentContextName = null;
    }

    /**
     * retrieves a context by name otherwise returns undefined
     * @param name - the identifier of the context
     * @returns {*}
     */
    getContextByName(name) {
        return _.get(this.contexts, name, undefined);
    }

    /**
     * sets the current active context
     * @param context
     */
    setCurrentContext(context) {
        if (this.getContextByName(context.name)) {
            this.currentContextName = context.name;
        } else {
            this.addContext(context);
            this.currentContextName = context.name;
        }
        debug('current context has been set:', context.name);
        context.current = 'true'; // eslint-disable-line
    }

    useContext(name) {
        const context = this.getContextByName(name);
        if (!context) {
            const message = `No such context: '${name}'`;
            debug(message);
            throw new CFError(message);
        }
        this.currentContextName = name;
        context.current = 'true'; // eslint-disable-line
        debug('using context:', name);
        return context;
    }

    /**
     * returns the current active context
     * @returns {*}
     */
    getCurrentContext() {
        return _.get(this.contexts, this.currentContextName, undefined);
    }

    addContext(context) {
        this.contexts[context.name] = context;
        debug('context added:', context.name);
    }

    removeContext(name) {
        const context = this.getContextByName(name);
        if (!context) {
            const message = `No such context: '${name}'`;
            debug(message);
            throw new CFError(message);
        }
        _.unset(this.contexts, name);
        debug('context removed:', context.name);
    }

    /**
     * retrieves all contexts
     * @returns {{}}
     */
    getAllContexts() {
        return this.contexts;
    }

    clearConfig() {
        this.contexts = {};
        this.currentContextName = '';
    }

    isConfigLoaded() {
        return !_.isEmpty(this.configFilePath);
    }

    hasContexts() {
        return !_.isEmpty(this.contexts);
    }

    /**
     * @return Object - created context
     * */
    async createContext({ apiKey, url, name }) {
        debug('creating context: %o', { name, apiKey: apiKey && `${apiKey.substring(0, 10)}...`, url });
        const Context = testJwt(apiKey) ? JWTContext : APIKeyContext;

        const context = Context.createFromToken(apiKey, url);

        if (name) {
            context.name = name;
        }

        debug('validating context');
        const userData = await context.validate();

        const roles = _.get(userData, 'roles', []);
        context.onPrem = roles.includes('Admin');
        debug('context is onPrem:', context.onPrem);
        return context;
    }

    /**
     * stores all current contexts back to config file
     */
    async persistConfig() {
        if (!this.isConfigLoaded()) {
            const message = 'Could not persist config: .cfconfig is not loaded';
            debug(message);
            throw new CFError(message);
        }
        debug('persisting config:', this._getConfigFilePath());
        const newContextFile = {
            contexts: {},
            'current-context': this.currentContextName,
        };

        _.forEach(this.contexts, (context) => {
            newContextFile.contexts[context.name] = context.serialize();
        });

        await writeFile(this._getConfigFilePath(), yaml.dump(newContextFile), 'utf8');
    }

    async loadConfig({ configFilePath = defaults.CF_CONFIG_PATH, forceLoad = false } = {}) {
        if (!forceLoad && this.isConfigLoaded() && configFilePath === this._getConfigFilePath()) {
            debug('config already loaded - using cache');
            return;
        }
        this.clearConfig();
        this._setConfigFilePath(configFilePath);

        const config = await this._loadConfig(configFilePath);
        _.forEach(config.contexts, (rawContext) => {
            switch (rawContext.type) {
                case JWTContext.TYPE: {
                    const context = JWTContext.createFromSerialized(rawContext);
                    this.addContext(context);
                    break;
                }
                case APIKeyContext.TYPE: {
                    const context = APIKeyContext.createFromSerialized(rawContext);
                    this.addContext(context);
                    break;
                }
                default: {
                    throw new CFError(`Failed to parse context of type: ${rawContext.type}`);
                }
            }
        });

        const currentContext = this.getContextByName(config['current-context']);
        debug(`current context: '${config['current-context']}'`);
        if (currentContext) {
            this.setCurrentContext(currentContext);
        }
    }

    async _loadConfig(configFilePath = defaults.CF_CONFIG_PATH) {
        configFilePath = path.resolve(configFilePath); // eslint-disable-line
        debug('loading config:', configFilePath);
        let config = {
            contexts: {},
            'current-context': '',
        };

        try {
            const data = await readFile(configFilePath, 'utf8');
            config = yaml.load(data);
        } catch (err) {
            if (err.code === 'ENOENT') {
                debug('config file does not exist - creating');
                await fse.mkdirp(path.dirname(configFilePath));
                await writeFile(configFilePath, yaml.dump(config), 'utf8');
            } else {
                throw new CFError({
                    cause: err,
                    message: `Failed to load configuration file from path: ${configFilePath}`,
                });
            }
        }
        return config;
    }

    _setConfigFilePath(configFilePath) {
        this.configFilePath = configFilePath;
    }

    _getConfigFilePath() {
        return this.configFilePath;
    }
}

module.exports = ConfigManager;
