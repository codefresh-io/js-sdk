const moment = require('moment');
const Workflows = require('../lib/logic/workflows.logic');

const WORKFLOW_ID = 'workflow-id';

describe('workflows logic', () => {
    describe('waitForStatus', () => {
        let getBuild;
        let workflows;

        beforeEach(() => {
            getBuild = jest.fn();
            workflows = new Workflows({ workflows: { getBuild } });
        });

        it('should return the workflow when the desired status is reached', async () => {
            const workflow = { status: 'success' };
            getBuild.mockResolvedValue(workflow);

            const result = await workflows.waitForStatus(WORKFLOW_ID, 'success', moment().add(1, 'minutes'));

            expect(result).toBe(workflow);
            expect(getBuild).toHaveBeenCalledWith({ buildId: WORKFLOW_ID, noAccount: false });
        });

        it('should throw a timeout error when the timeout date has passed', async () => {
            const promise = workflows.waitForStatus(WORKFLOW_ID, 'success', moment().subtract(1, 'minutes'));

            await expect(promise).rejects.toMatchObject({ message: 'Operation has timed out', isTimeout: true });
            expect(getBuild).not.toHaveBeenCalled();
        });

        it('should throw a non-timeout error when the build finished with another status', async () => {
            getBuild.mockResolvedValue({ status: 'error' });

            const error = await workflows.waitForStatus(WORKFLOW_ID, 'success', moment().add(1, 'minutes')).catch((e) => e);

            expect(error.message).toBe(`Build: ${WORKFLOW_ID} finished with status: error`);
            expect(error.isTimeout).toBeUndefined();
        });

        it('should not mark API errors as timeout', async () => {
            const apiError = new Error('error code: 520');
            getBuild.mockRejectedValue(apiError);

            const error = await workflows.waitForStatus(WORKFLOW_ID, 'success', moment().add(1, 'minutes')).catch((e) => e);

            expect(error).toBe(apiError);
            expect(error.isTimeout).toBeUndefined();
        });
    });
});
