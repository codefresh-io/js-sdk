const _ = require('lodash');
const request = require('requestretry');
const defaults = require('../lib/defaults');
const { postProcessApi, _resolveArgs, _wrapHandler } = require('../helpers/api');
const { handleErrors } = require('../helpers/error');
const { Http } = require('../helpers/http');
const { version } = require('../package.json');

jest.mock('../helpers/error', () => ({ handleErrors: jest.fn() }));

jest.mock('requestretry', () => {
    let response = { body: { test: 'test' } };
    const Request = jest.fn(() => response);
    Request.defaults = jest.fn(() => Request);
    Request.__setResponse = (res) => {
        response = res;
    };
    Request.__getResponse = () => response;
    return Request;
});

const spec = {
    paths: {
        '/workflows': {
            get: {
                operationId: 'workflows_list',
                'x-sdk-interface': 'workflows.list',
            },
            post: { operationId: 'workfows_no_interface' },
            delete: {
                operationId: 'workfows_same_interface',
                'x-sdk-interface': 'workflows.list',
            },
        },
        '/clusters': {
            get: {
                operationId: 'clusters_list',
                'x-sdk-interface': 'clusters.list',
            },
        },
    },
};

const swaggerApis = {
    clusters: { clusters_list: () => 'clusters_list' },
    workflows: {
        workflows_list: () => 'workflows_list',
        workfows_no_interface: () => 'workfows_no_interface',
        workfows_same_interface: () => 'workfows_same_interface',
    },
};

describe('helpers', () => {
    describe('api', () => {
        describe('postProcessApi', () => {
            it('should generate apis from swagger apis using x-sdk-interface and operationId at spec', () => {
                const apis = postProcessApi({ apis: swaggerApis, spec }, spec);

                // swagger apis are loaded
                expect(_.isFunction(_.get(apis, 'workflows.list'))).toBeTruthy();
                expect(_.isFunction(_.get(apis, 'clusters.list'))).toBeTruthy();

                // swagger apis are correctly loaded
                expect(apis.workflows.list()).toEqual(swaggerApis.workflows.workflows_list());
                expect(apis.clusters.list()).toEqual(swaggerApis.clusters.clusters_list());
            });

            it('should not include methods from swagger apis, that do not have x-sdk-interface', () => {
                const apis = postProcessApi({ apis: swaggerApis, spec }, spec);

                expect(_.keys(apis)).toEqual(['clusters', 'workflows']);
                expect(_.keys(apis.workflows)).toEqual(['list']);
                expect(_.keys(apis.clusters)).toEqual(['list']);
            });

            it('should not override methods that have the same x-sdk-interface', () => {
                const apis = postProcessApi({ apis: swaggerApis, spec }, spec);

                expect(_.isFunction(_.get(apis, 'workflows.list'))).toBeTruthy();
                expect(apis.workflows.list()).toEqual(swaggerApis.workflows.workflows_list());
                expect(apis.workflows.list()).not.toEqual(swaggerApis.workflows.workfows_same_interface());
            });
        });

        describe('_resolveArgs', () => {
            it('should return what it got when no params and no request body', () => {
                const params = undefined;
                const requestBody = undefined;
                const args = _resolveArgs([params, requestBody]);
                expect(args).toEqual([params, requestBody]);
            });

            it('should return only request body when first param is not provided, but second exists', () => {
                const params = undefined;
                const requestBody = { body: 'test' };
                const args = _resolveArgs([params, requestBody]);
                expect(args).toEqual([{}, { requestBody }]);
            });

            it('should return params and request body when they are present', () => {
                const params = { param: 'test' };
                const requestBody = { body: 'test' };
                const args = _resolveArgs([params, requestBody]);
                expect(args).toEqual([params, { requestBody }]);
            });

            it('should return params and request body when request body is inside params', () => {
                const requestBody = { body: 'test' };
                const params = { param: 'test', requestBody };
                const args = _resolveArgs([params]);
                expect(args).toEqual([params, { requestBody }]);
                expect(params.requestBody).toBeUndefined();
            });

            it('should return params as params and request body when request body is at spec but not passed', () => {
                const requestBody = { body: 'test' };
                const args = _resolveArgs([requestBody, requestBody], { requestBody: {} });
                expect(args).toEqual([requestBody, { requestBody }]);
            });

            it('should return only params when request body is not at spec and not passed', () => {
                const params = { param: 'test' };
                const args = _resolveArgs([params]);
                expect(args).toEqual([params]);
            });
        });

        describe('_wrapHandler', () => {
            it('should _resolveArgs before calling wrapped func', () => {
                const params = { test: 'test' };
                const wrappedFunc = jest.fn();
                const wrapper = _wrapHandler(wrappedFunc);
                wrapper(params);
                expect(wrappedFunc).toBeCalledWith(_.first(_resolveArgs([params])));
            });

            it('should _serializeObjectAsQueryParam if any param is object before calling wrapped func', () => {
                const params = { param: { test: 'test' } };
                const wrappedFunc = jest.fn();
                const wrapper = _wrapHandler(wrappedFunc);
                wrapper(params);
                expect(wrappedFunc).toBeCalledWith(_.first(_resolveArgs([{ param: { 'param[test]': 'test' } }])));
            });
        });
    });

    describe('http', () => {
        beforeEach(() => {
            JSON.parse = jest.fn((res) => res);
        });

        it('should use defaults when request options are not provided', () => {
            const defaultConfig = {
                timeout: defaults.TIMEOUT,
                maxAttempts: defaults.MAX_RETRIES,
                retryDelay: defaults.RETRY_DELAY,
                retryStrategy: Http.RETRY_STRATEGY,
                headers: {},
            };
            Http();
            expect(request.config).toEqual(_.merge(defaultConfig, {
                headers: {
                    'Codefresh-User-Agent-Type': 'js-sdk',
                    'Codefresh-User-Agent-Version': version,
                    'User-Agent': `codefresh-js-sdk-v${version}`,
                },
            }));
        });

        it('should add codefresh-user-agent-type header and codefresh-user-agent-version if they are missing', () => {
            const defaultConfig = {
                timeout: defaults.TIMEOUT,
                maxAttempts: defaults.MAX_RETRIES,
                retryDelay: defaults.RETRY_DELAY,
                retryStrategy: Http.RETRY_STRATEGY,
                headers: { 'my-header': 'key' },
            };
            Http(defaultConfig);
            expect(request.config).toEqual(_.merge(defaultConfig, {
                headers: {
                    'Codefresh-User-Agent-Type': 'js-sdk',
                    'Codefresh-User-Agent-Version': version,
                    'User-Agent': `codefresh-js-sdk-v${version}`,
                },
            }));
        });

        it('should add codefresh-user-agent-type header and codefresh-user-agent-version if they are missing', () => {
            const defaultConfig = {
                timeout: defaults.TIMEOUT,
                maxAttempts: defaults.MAX_RETRIES,
                retryDelay: defaults.RETRY_DELAY,
                retryStrategy: Http.RETRY_STRATEGY,
                headers: {
                    'Codefresh-User-Agent-Type': 'cli',
                    'Codefresh-User-Agent-Version': '1.0.0',
                },
            };
            Http(defaultConfig);
            expect(request.config).toEqual(_.merge(defaultConfig, {
                headers: {
                    'Codefresh-User-Agent-Type': 'cli',
                    'Codefresh-User-Agent-Version': '1.0.0',
                },
            }));
        });

        it('should use provided request options when specified', () => {
            const requestOptions = {
                timeout: 1,
                maxAttempts: 1,
                retryDelay: 1,
                retryStrategy: Http.RETRY_STRATEGY,
                headers: {
                    Authorization: 'auth',
                    'x-access-token': 'token',
                },
            };
            Http(requestOptions);
            expect(request.config).toEqual(requestOptions);
        });

        it('should not use baseUrl when provided url has host', async () => {
            const initialOptions = { baseUrl: 'https://host.com' };
            const options = { url: 'https://another.host.com/some/path' };
            const http = Http(initialOptions);

            await http(options);

            expect(request).toBeCalledWith(expect.objectContaining({ url: options.url }));
        });

        it('should use baseUrl when provided url has no host', async () => {
            const initialOptions = { baseUrl: 'https://host.com' };
            const url = '/some/path';
            const options = { url };
            const http = Http(initialOptions);

            await http(options);

            expect(request).toBeCalledWith(expect.objectContaining({ url: `${initialOptions.baseUrl}${url}` }));
        });

        it('should handle errors', async () => {
            const initialOptions = { baseUrl: 'https://host.com' };
            const options = { url: '/some/path' };
            const http = Http(initialOptions);

            await http(options);

            expect(handleErrors).toBeCalledWith(request.__getResponse());
        });

        it('should parse request body', async () => {
            const initialOptions = { baseUrl: 'https://host.com' };
            const options = { url: '/some/path' };
            const http = Http(initialOptions);

            await http(options);

            expect(JSON.parse).toBeCalledWith(request.__getResponse().body);
        });

        it('should pass request body as is when could not parse', async () => {
            const initialOptions = { baseUrl: 'https://host.com' };
            const options = { url: '/some/path' };
            const http = Http(initialOptions);

            JSON.parse = jest.fn(() => {
                throw new Error();
            });

            const res = await http(options);

            expect(JSON.parse).toBeCalledWith(request.__getResponse().body);
            expect(res).toEqual(request.__getResponse().body);
        });

        it('should retry on 502, 503, 504', async () => {
            _.set(request, 'RetryStrategies.NetworkError', () => false);
            expect(Http.RETRY_STRATEGY(null, { statusCode: 502 })).toBeTruthy();
            expect(Http.RETRY_STRATEGY(null, { statusCode: 503 })).toBeTruthy();
            expect(Http.RETRY_STRATEGY(null, { statusCode: 504 })).toBeTruthy();
        });

        it('should retry on network error', async () => {
            _.set(request, 'RetryStrategies.NetworkError', () => true);
            expect(Http.RETRY_STRATEGY({}, null)).toBeTruthy();
        });

        it('should not retry in debug mode', async () => {
            process.env.DEBUG = 'codefresh';
            _.set(request, 'RetryStrategies.NetworkError', () => true);
            expect(Http.RETRY_STRATEGY({}, {})).toBeFalsy();
        });

        describe('headers', () => {
            it('should use default headers in case non was passed', () => {

            });

            it('should use passed headers over default values in case was passed', () => {

            });
        });
    });
});
