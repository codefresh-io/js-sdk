const { getCurrentAccount, getUser, getExecutionContext } = require('../helpers/whoami');
const { APIKeyContext } = require('../lib/auth/contexts');
const { Http } = require('../helpers/http');

jest.mock('../helpers/http', () => {
    let response;
    let validateParams;

    const __setResponse = (x) => {
        response = x;
    };

    const __setValidateParams = (x) => {
        validateParams = x;
    };

    const __reset = () => {
        response = null;
        validateParams = null;
    };

    const http = (userOptions, context, flag) => {
        if (validateParams) {
            validateParams(userOptions, context, flag);
        }

        return response();
    };

    const HttpConstructor = () => http;

    HttpConstructor.__setResponse = __setResponse;
    HttpConstructor.__setValidateParams = __setValidateParams;
    HttpConstructor.__reset = __reset;

    return { Http: HttpConstructor };
});

describe('whoami', () => {
    beforeEach(() => {
        Http.__reset();
    });

    describe('getUser', () => {
        it('should return full account info ', async () => {
            const context = new APIKeyContext({
                name: 'test-context',
                url: 'http://test',
                token: 'test-token',
            });

            const response = { test: 'test' };
            Http.__setResponse(() => response);

            const accountInfo = await getUser(context);
            expect(accountInfo).toEqual(response);
        });

        it('should be able to be called with options', async () => {
            const testToken = 'test-token';
            const testUrl = 'http://test';
            const timeout = 1000;
            const context = new APIKeyContext({
                name: 'test-context',
                url: testUrl,
                token: testToken,
            });

            const response = { test: 'test' };
            Http.__setResponse(() => response);
            Http.__setValidateParams((userOptions) => {
                expect(userOptions)
                    .toEqual(expect.objectContaining({
                        timeout,
                        method: 'GET',
                        url: `${testUrl}/api/user`,
                        headers: { Authorization: testToken },
                    }));
            });

            await getUser(context, { timeout });
        });

        it('should merge context http options into request options', async () => {
            const testToken = 'test-token';
            const testUrl = 'http://test';
            const context = new APIKeyContext({
                name: 'test-context',
                url: testUrl,
                token: testToken,
            });
            jest.spyOn(context, 'prepareHttpOptions');

            Http.__setValidateParams((userOptions) => {
                expect(userOptions)
                    .toEqual(expect.objectContaining({
                        method: 'GET',
                        url: `${testUrl}/api/user`,
                        headers: { Authorization: testToken },
                    }));
            });

            const response = { test: 'test' };
            Http.__setResponse(() => response);

            const accountInfo = await getUser(context, true);

            expect(accountInfo).toEqual(response);
            expect(context.prepareHttpOptions).toBeCalled();
        });
    });

    describe('getExecutionContext', () => {
        it('should return full account info ', async () => {
            const context = new APIKeyContext({
                name: 'test-context',
                url: 'http://test',
                token: 'test-token',
            });

            const response = { test: 'test' };
            Http.__setResponse(() => response);

            const accountInfo = await getExecutionContext(context);
            expect(accountInfo).toEqual(response);
        });

        it('should be able to be called with options', async () => {
            const testToken = 'test-token';
            const testUrl = 'http://test';
            const timeout = 1000;
            const context = new APIKeyContext({
                name: 'test-context',
                url: testUrl,
                token: testToken,
            });

            const response = { test: 'test' };
            Http.__setResponse(() => response);
            Http.__setValidateParams((userOptions) => {
                expect(userOptions)
                    .toEqual(expect.objectContaining({
                        timeout,
                        method: 'GET',
                        url: `${testUrl}/api/execution-contexts/current`,
                        headers: { Authorization: testToken },
                    }));
            });

            await getExecutionContext(context, { timeout });
        });

        it('should merge context http options into request options', async () => {
            const testToken = 'test-token';
            const testUrl = 'http://test';
            const context = new APIKeyContext({
                name: 'test-context',
                url: testUrl,
                token: testToken,
            });
            jest.spyOn(context, 'prepareHttpOptions');

            Http.__setValidateParams((userOptions) => {
                expect(userOptions)
                    .toEqual(expect.objectContaining({
                        method: 'GET',
                        url: `${testUrl}/api/execution-contexts/current`,
                        headers: { Authorization: testToken },
                    }));
            });

            const response = { test: 'test' };
            Http.__setResponse(() => response);

            const accountInfo = await getExecutionContext(context, true);

            expect(accountInfo).toEqual(response);
            expect(context.prepareHttpOptions).toBeCalled();
        });
    });

    describe('getCurrentAccount', () => {
        it('should return active account information in case context is valid', async () => {
            const testToken = 'test-token';
            const testUrl = 'http://test';
            const context = new APIKeyContext({
                name: 'test-context',
                url: testUrl,
                token: testToken,
            });

            Http.__setValidateParams((userOptions) => {
                expect(userOptions)
                    .toEqual(expect.objectContaining({
                        method: 'GET',
                        url: `${testUrl}/api/user`,
                        headers: { Authorization: testToken },
                        timeout: 5000,
                    }));
                expect(userOptions.retryStrategy()).toBeFalsy();
            });

            const activeAccountName = 'account-name-1';
            const firstAccount = {
                name: activeAccountName,
                runtimeEnvironment: 'runtime-environment-1',
            };
            const secondAccount = {
                name: 'account-name-2',
                runtimeEnvironment: 'runtime-environment-2',
            };
            Http.__setResponse(() => ({
                activeAccountName,
                account: [
                    firstAccount,
                    secondAccount,
                ],
            }));

            const accountInfo = await getCurrentAccount(context);
            expect(accountInfo).toEqual(firstAccount);
        });

        it('should return empty info when no data returned', async () => {
            const context = new APIKeyContext({
                name: 'test-context',
                url: 'http://test',
                token: 'test-token',
            });

            const response = { test: 'test' };
            Http.__setResponse(() => response);

            const accountInfo = await getCurrentAccount(context);
            expect(accountInfo).toEqual({});
        });

        it('should fail in case context is not valid', async () => {
            const context = new APIKeyContext({
                name: 'test-context',
                url: 'http://test',
                token: 'test-token',
            });

            Http.__setResponse(() => {
                throw new Error('http request error');
            });

            await expect(getCurrentAccount(context)).rejects.toThrow('http request error');
        });
    });
});
