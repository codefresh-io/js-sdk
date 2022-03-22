const _ = require('lodash');
const debug = require('debug')('codefresh:sdk:auth:whoami');

const { Http } = require('./http');

const http = Http();

const getUser = async (context, options = {}) => {
    debug(`loading context -- ${context}`);
    const userOptions = _.defaultsDeep({
        url: `${context.url}/api/user`,
        method: 'GET',
    }, options);
    const user = await http(_.merge(userOptions, context.prepareHttpOptions()));
    debug(`context "${context.name}" successfully loaded`);
    return user;
};

const getExecutionContext = async (context, options = {}) => {
    debug(`loading context -- ${context}`);
    const userOptions = _.defaultsDeep({
        url: `${context.url}/api/execution-contexts/current`,
        method: 'GET',
    }, options);
    const executionContext = await http(_.merge(userOptions, context.prepareHttpOptions()));
    debug(`context "${context.name}" successfully loaded`);
    return executionContext;
};

/**
 * This method is used only inside cli for command `codefresh auth get-contexts`
 * */
const getCurrentAccount = async (context) => {
    const user = await getUser(context, {
        timeout: 5000,
        retryStrategy: () => false,
    });

    const accounts = _.get(user, 'account', {});
    const accountInfo = _.chain(accounts)
        .filter((account) => account.name === user.activeAccountName)
        .get('[0]', {})
        .pick('name', 'runtimeEnvironment')
        .value();

    debug(`account info ${JSON.stringify(accountInfo)}`);
    debug(`current account name is : ${JSON.stringify(_.get(user, 'activeAccountName'))}`);

    return accountInfo;
};

module.exports = { getUser, getExecutionContext, getCurrentAccount };
