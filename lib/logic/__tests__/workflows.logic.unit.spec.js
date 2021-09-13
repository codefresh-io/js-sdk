const _ = require('lodash');
const moment = require('moment');
const Workflows = require('../workflows.logic');

jest.setTimeout(2000);
let sdk;
let wf;
describe('workflows logic', () => {
    beforeEach(() => {
        sdk = jest.mock();
        wf = new Workflows(sdk);
        wf.delay = 500;
    });
    it('success', async () => {
        _.set(sdk, 'workflows.getBuild', async () => ({ status: 'success' }));
        const result = await wf.waitForStatus('id', 'success', moment().add(200, 'ms'));
        expect(result.status).toBe('success');
    });

    it('success after retries', async () => {
        let i = 0;
        _.set(sdk, 'workflows.getBuild',
            async () => {
                if (i < 2) { i += 1; throw new Error('simulate error'); }
                return { status: 'success' };
            });
        const result = await wf.waitForStatus('id', 'success', moment().add(200, 'ms'));
        expect(result.status).toBe('success');
    });

    it('timeout', async () => {
        const status = 'running';
        _.set(sdk, 'workflows.getBuild',
            async () => ({ status }));
        try {
            await wf.waitForStatus('id', 'success', moment().add(700, 'ms'));
        } catch (err) {
            expect(err.message).toBe('Operation has timed out');
            return; // good.
        }
        throw new Error('Failed, should have time out');
    });

    it('running then success', async () => {
        let status = 'running';
        _.set(sdk, 'workflows.getBuild',
            async () => {
                const current = status;
                status = 'success';
                return { status: current };
            });
        const result = await wf.waitForStatus('id', 'success', moment().add(700, 'ms'));
        expect(result.status).toBe('success');
    });
});
