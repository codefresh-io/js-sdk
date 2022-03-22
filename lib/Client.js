const _ = require('lodash');
const CFError = require('cf-errors');
const debug = require('debug')('codefresh:sdk:client');

const { postProcessApi } = require('../helpers/api');

class Client {
    constructor(sdk) {
        this.sdk = sdk;
        this.config = sdk.config;
        this.api = null;
        this._loadClient();
    }

    _loadClient() {
        const { swagger } = this.config;

        const specJson = _.get(this.config, 'options.spec.json');

        if (!swagger) {
            const message = 'Client not loaded: swagger is not initialized';
            debug(message);
            throw new CFError(message);
        }
        if (!specJson) {
            const message = 'Client not loaded: no spec';
            debug(message);
            throw new CFError(message);
        }

        this.api = postProcessApi(swagger, specJson);
        _.merge(this.sdk, this.api);
    }
}

module.exports = Client;
