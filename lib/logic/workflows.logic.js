const moment = require('moment');
const Promise = require('bluebird');
const CFError = require('cf-errors');

const Resource = require('./Resource.base');

const END_STATUSES = ['error', 'success', 'terminated'];

class Workflows extends Resource {
    constructor(sdk) {
        super(sdk);
        this.delay = 5000;
    }

    async waitForStatus(workflowId, desiredStatus, timeoutDate, descriptive) {
        const currentDate = moment();
        if (currentDate.isAfter(timeoutDate)) {
            throw new CFError('Operation has timed out');
        }

        const workflow = await this.getWorkflow(workflowId);
        const currentStatus = workflow.status;

        if (currentStatus !== desiredStatus) {
            if (END_STATUSES.indexOf(currentStatus) !== -1) {
                throw new CFError(`Build: ${workflowId} finished with status: ${currentStatus}`);
            }
            if (descriptive) {
                console.log(`Workflow: ${workflowId} current status: ${currentStatus}`);
            }
            await Promise.delay(this.delay);
            return this.waitForStatus(workflowId, desiredStatus, timeoutDate, descriptive);
        }

        return workflow;
    }

    /**
     *  return workflow
     *  retry 3 times, if failed throw
     */
    async getWorkflow(workflowId) {
        let err;
        for (let i = 0; i < 3; i += 1) {
            try {
                // eslint-disable-next-line no-await-in-loop
                return await this.sdk.workflows.getBuild({ buildId: workflowId, noAccount: false });
            } catch (e) {
                console.warn(`retrying getBuild({buildId: ${workflowId}})`);
                err = e;
            }
        }
        throw err;
    }
}

module.exports = Workflows;
