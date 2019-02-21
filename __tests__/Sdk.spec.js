const _ = require('lodash');
const { Codefresh, Config } = require('../index');
const Clusters = require('../lib/logic/clusters.logic.js');
const Workflows = require('../lib/logic/workflows.logic.js');

jest.mock('fs', () => ({
    readdirSync: () => [
        'clusters.logic.js',
        'workflows.logic.js',
    ],
    readFile: () => ({}),
    writeFile: () => ({}),
    mkdir: () => ({}),
}));

jest.mock('../lib/logic/clusters.logic.js');
jest.mock('../lib/logic/workflows.logic.js');


const swaggerApis = {
    clusters: { clusters_list: () => 'clusters_list' },
    workflows: { workflows_list: () => 'workflows_list' },
};

const spec = {
    paths: {
        '/workflows': {
            get: {
                operationId: 'workflows_list',
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


describe('Sdk', () => {
    describe('loading', () => {
        it('should load Sdk from logic and api spec', async () => {
            const mockClusters = new Clusters();
            const mockWorkflows = new Workflows();

            const sdk = new Codefresh(new Config({
                swagger: {
                    spec,
                    apis: swaggerApis,
                },
                options: { spec: { json: spec } },
            }));

            // logic is loaded
            expect(_.isFunction(_.get(sdk, 'workflows.get'))).toBeTruthy();
            expect(_.isFunction(_.get(sdk, 'clusters.get'))).toBeTruthy();

            // swagger apis are loaded
            expect(_.isFunction(_.get(sdk, 'workflows.list'))).toBeTruthy();
            expect(_.isFunction(_.get(sdk, 'clusters.list'))).toBeTruthy();

            // logic is correctly loaded
            expect(sdk.workflows.get()).toEqual(mockWorkflows.get());
            expect(sdk.clusters.get()).toEqual(mockClusters.get());

            // swagger apis are correctly loaded
            expect(sdk.workflows.list()).toEqual(swaggerApis.workflows.workflows_list());
            expect(sdk.clusters.list()).toEqual(swaggerApis.clusters.clusters_list());
        });
    });
});
