/* eslint-disable global-require */
const fs = require('fs');
const fse = require('fs-extra');
const yaml = require('js-yaml');
const CFError = require('cf-errors');
const path = require('path');
const _ = require('lodash');
const jwt = require('jsonwebtoken');

const { ConfigManager } = require('../lib/auth');
const defaults = require('../lib/defaults');
// eslint-disable-next-line prefer-const
let { JWTContext, APIKeyContext } = require('../lib/auth/contexts');

const manager = new ConfigManager();

jest.mock('../helpers/whoami', () => ({
    getUser: jest.fn(),
    getExecutionContext: jest.fn(),
}));

jest.mock('fs', () => {
    const mock = {};
    mock.readFile = function readFile() {
        return this._readFile(...arguments); // eslint-disable-line
    }.bind(mock);
    mock.writeFile = function readFile() {
        return this._writeFile(...arguments); // eslint-disable-line
    }.bind(mock);
    return mock;
});

jest.mock('fs-extra', () => ({ mkdirp: jest.fn() }));

jest.mock('bluebird', () => ({ promisify: (func) => func }));

jest.spyOn(manager, 'clearConfig');
jest.spyOn(manager, '_getConfigFilePath');
jest.spyOn(manager, '_setConfigFilePath');
jest.spyOn(manager, '_loadConfig');
jest.spyOn(manager, 'addContext');
jest.spyOn(manager, 'isConfigLoaded');

const CONTEXTS = {
    contexts: {
        jwt: { type: JWTContext.TYPE, name: 'jwt' },
        apiKey: { type: APIKeyContext.TYPE, name: 'apiKey' },
    },
    'current-context': 'jwt',
};

describe('ConfigManager', () => {
    beforeEach(() => {
        const testData = { test: 'test' };
        fs._readFile = jest.fn(() => testData);
        fs._writeFile = jest.fn();
        fse.mkdirp.mockClear();
        yaml.safeDump = jest.fn((data) => data);
        yaml.safeLoad = jest.fn((data) => data);
    });

    describe('#_loadConfig', () => {
        it('should use default path when not specified', async () => {
            await manager._loadConfig();

            expect(fs._readFile).toBeCalledWith(defaults.CF_CONFIG_PATH, 'utf8');
        });

        it('should read from specific path when provided', async () => {
            const configFilePath = 'some/path';
            await manager._loadConfig(configFilePath);

            expect(fs._readFile).toBeCalledWith(path.resolve(configFilePath), 'utf8');
        });

        it('should create file when it does not exist and write empty config to it', async () => {
            fs._readFile = jest.fn(() => {
                throw new CFError({ code: 'ENOENT' });
            });
            const emptyConfig = {
                contexts: {},
                'current-context': '',
            };

            await manager._loadConfig();

            expect(fs._readFile).toBeCalled();
            expect(fse.mkdirp).toBeCalledWith(path.dirname(defaults.CF_CONFIG_PATH));
            expect(fs._writeFile).toBeCalledWith(defaults.CF_CONFIG_PATH, emptyConfig, 'utf8');
        });

        it('should return empty config when file does not exist', async () => {
            fs._readFile = jest.fn(() => {
                throw new CFError({ code: 'ENOENT' });
            });
            const defaultConfig = {
                contexts: {},
                'current-context': '',
            };

            const config = await manager._loadConfig();

            expect(fs._readFile).toBeCalled();
            expect(config).toEqual(defaultConfig);
        });

        it('should throw error when it`s code is not ENOENT', async () => {
            fs._readFile = jest.fn(() => {
                throw new Error();
            });
            await expect(manager._loadConfig()).rejects.toThrow(CFError);
        });

        it('should read file when it exists and dump data from yaml', async () => {
            const config = await manager._loadConfig();

            expect(fs._readFile).toBeCalled();
            expect(config).toEqual(fs._readFile()); // equals mock data
            expect(fse.mkdirp).not.toBeCalled();
            expect(fs._writeFile).not.toBeCalled();
        });
    });

    describe('#loadConfig', () => {
        beforeEach(() => {
            manager.clearConfig();
            manager._setConfigFilePath(null); // make config not loaded

            manager.clearConfig.mockClear();
            manager.addContext.mockClear();
            manager._getConfigFilePath.mockClear();
            manager._setConfigFilePath.mockClear();
            manager._loadConfig.mockClear().mockImplementation(() => CONTEXTS);

            JWTContext.createFromSerialized = jest.fn(_.identity);
            APIKeyContext.createFromSerialized = jest.fn(_.identity);
        });

        it('should load config file from default config file path when not provided', async () => {
            await manager.loadConfig();

            expect(manager._loadConfig).toBeCalledWith(defaults.CF_CONFIG_PATH);
        });

        it('should load config file from provided file path when specified', async () => {
            const configFilePath = 'some/path';
            await manager.loadConfig({ configFilePath });

            expect(manager._loadConfig).toBeCalledWith(configFilePath);
        });

        it('should not load config file when config is already loaded and configFilePath is same', async () => {
            await manager.loadConfig();
            await manager.loadConfig();

            expect(manager._getConfigFilePath).toBeCalledTimes(1);
            expect(manager._setConfigFilePath).toBeCalledTimes(1);
            expect(manager._loadConfig).toBeCalledTimes(1);
        });

        it('should reload config file when config is loaded and configFilePath is not the same', async () => {
            await manager.loadConfig();
            await manager.loadConfig({ configFilePath: 'some/path' });

            expect(manager._getConfigFilePath).toBeCalledTimes(1);
            expect(manager._setConfigFilePath).toBeCalledTimes(2);
            expect(manager._loadConfig).toBeCalledTimes(2);
        });

        it('should force load config file when forceLoad option is provided', async () => {
            await manager.loadConfig();
            await manager.loadConfig({ forceLoad: true });

            expect(manager._getConfigFilePath).not.toBeCalled(); // forceLoad check precedes calling this method
            expect(manager._setConfigFilePath).toBeCalledTimes(2);
            expect(manager._loadConfig).toBeCalledTimes(2);
        });

        it('should clear config manager before loading config', async () => {
            await manager.loadConfig();

            expect(manager.clearConfig).toBeCalled();
        });

        it('should cache the config file path', async () => {
            const configFilePath = 'some/path';
            await manager.loadConfig({ configFilePath });

            expect(manager._setConfigFilePath).toBeCalledWith(configFilePath);
            expect(manager.configFilePath).toBe(configFilePath);
        });

        it('should load config and parse contexts', async () => {
            const configFilePath = 'some/path';
            await manager.loadConfig({ configFilePath });

            expect(manager._loadConfig).toBeCalledWith(configFilePath);
            expect(manager.addContext).toBeCalledTimes(_.keys(CONTEXTS.contexts).length);
            expect(manager.getAllContexts()).toEqual(CONTEXTS.contexts);
            expect(JWTContext.createFromSerialized).toBeCalledWith(CONTEXTS.contexts.jwt);
            expect(APIKeyContext.createFromSerialized).toBeCalledWith(CONTEXTS.contexts.apiKey);
        });

        it('should throw on parsing context when context type is not valid', async () => {
            manager._loadConfig.mockImplementation(() => ({ contexts: { unknown: { type: 'not-valid' } } }));

            await expect(manager.loadConfig()).rejects.toThrow(CFError);

            expect(manager._loadConfig).toBeCalled();
        });

        it('should set the current context if it exists after loading', async () => {
            await manager.loadConfig();

            expect(manager._loadConfig).toBeCalled();
            expect(manager.getCurrentContext()).toEqual(CONTEXTS.contexts[CONTEXTS['current-context']]);
        });
    });

    describe('#createContext', () => {
        beforeEach(() => {
            const createFromToken = (token, url) => ({ token, url, validate: jest.fn() });
            JWTContext.createFromToken = jest.fn(createFromToken);
            APIKeyContext.createFromToken = jest.fn(createFromToken);
        });

        it('should create JWTContext when jwt token is provided', async () => {
            const token = jwt.sign('token', 'secret');
            const url = 'url';
            await manager.createContext({ apiKey: token, url });

            expect(JWTContext.createFromToken).toBeCalledWith(token, url);
            expect(APIKeyContext.createFromToken).not.toBeCalled();
        });

        it('should create APIKeyContext when apiKey is provided', async () => {
            const token = 'token';
            const url = 'url';
            await manager.createContext({ apiKey: token, url });

            expect(APIKeyContext.createFromToken).toBeCalledWith(token, url);
            expect(JWTContext.createFromToken).not.toBeCalled();
        });

        it('should not set context name when not provided', async () => {
            const token = 'token';
            const url = 'url';
            const context = await manager.createContext({ apiKey: token, url });

            expect(APIKeyContext.createFromToken).toBeCalledWith(token, url);
            expect(context.name).toBeUndefined();
        });

        it('should set context name when provided', async () => {
            const token = 'token';
            const url = 'url';
            const name = 'name';
            const context = await manager.createContext({ apiKey: token, url, name });

            expect(APIKeyContext.createFromToken).toBeCalledWith(token, url);
            expect(context.name).toBe(name);
        });

        it('should validate context after creation', async () => {
            const validateContext = jest.fn();
            APIKeyContext.createFromToken = jest.fn(() => ({ validate: validateContext }));
            const token = 'token';
            const url = 'url';
            await manager.createContext({ apiKey: token, url });

            expect(APIKeyContext.createFromToken).toBeCalledWith(token, url);
            expect(validateContext).toBeCalled();
        });

        it('should do a fallback in case there was a failure during user validation', async () => {
            jest.resetModules();
            const token = 'token';
            const url = 'url';

            const _whoami = require('../helpers/whoami');

            _whoami.getUser.mockRejectedValueOnce(new Error());
            _whoami.getExecutionContext.mockResolvedValueOnce({});

            // eslint-disable-next-line prefer-destructuring
            APIKeyContext.createFromToken = require('../lib/auth/contexts').APIKeyContext.createFromToken;

            await manager.createContext({ apiKey: token, url });

            expect(_whoami.getUser).toBeCalledTimes(1);
            expect(_whoami.getExecutionContext).toBeCalledTimes(1);
        });

        it('should set context onPrem when account has role "Admin"', async () => {
            const validateContext = jest.fn(() => ({ roles: ['Admin'] }));
            APIKeyContext.createFromToken = jest.fn(() => ({ validate: validateContext }));
            const token = 'token';
            const url = 'url';
            const context = await manager.createContext({ apiKey: token, url });

            expect(APIKeyContext.createFromToken).toBeCalledWith(token, url);
            expect(validateContext).toBeCalled();
            expect(context.onPrem).toBeTruthy();
        });
    });

    describe('#persistConfig', () => {
        beforeEach(async () => {
            const createFromSerialized = (data) => {
                data.serialize = function serialize() { // eslint-disable-line
                    return this;
                };
                return data;
            };
            JWTContext.createFromSerialized = jest.fn(createFromSerialized);
            APIKeyContext.createFromSerialized = jest.fn(createFromSerialized);

            manager._loadConfig.mockImplementation(() => CONTEXTS);

            await manager.loadConfig({ forceLoad: true });

            manager._getConfigFilePath.mockClear();
            manager._setConfigFilePath.mockClear();
        });

        it('should save config to file', async () => {
            const configFilePath = 'some/path';
            manager._setConfigFilePath(configFilePath);
            await manager.persistConfig();

            expect(manager._getConfigFilePath).toReturnWith(configFilePath);
            expect(yaml.safeDump).toBeCalledWith(CONTEXTS);
            expect(fs._writeFile).toBeCalledWith(configFilePath, CONTEXTS, 'utf8');
        });

        it('should throw when config is not loaded', async () => {
            manager._setConfigFilePath(null);
            await expect(manager.persistConfig()).rejects.toThrow(CFError);
        });

        it('should use cached config file path to save file', async () => {
            await manager.persistConfig();

            expect(manager._getConfigFilePath).toBeCalled();
        });
    });

    describe('#useContext', () => {
        it('should throw when no such context', async () => {
            manager.clearConfig();
            expect(() => manager.useContext('test')).toThrow(CFError);
        });
    });

    describe('#removeContext', () => {
        it('should throw when no such context', async () => {
            manager.clearConfig();
            expect(() => manager.removeContext('test')).toThrow(CFError);
        });
    });
});
