const moment = require('moment');
const Promise = require('bluebird');
const CFError = require('cf-errors');

const Resource = require('./Resource.base');

const END_STATUSES = ['error', 'success', 'terminated'];

class Workflows extends Resource {
    async waitForStatus(workflowId, desiredStatus, timeoutDate, descriptive) {
        const currentDate = moment();
        if (currentDate.isAfter(timeoutDate)) {
            // isTimeout lets callers tell the timeout apart from other errors (e.g. API errors)
            throw new CFError({ message: 'Operation has timed out', isTimeout: true });
        }

        const workflow = await this.sdk.workflows.getBuild({ buildId: workflowId, noAccount: false });
        const currentStatus = workflow.status;

        if (currentStatus !== desiredStatus) {
            if (END_STATUSES.indexOf(currentStatus) !== -1) {
                throw new CFError(`Build: ${workflowId} finished with status: ${currentStatus}`);
            }
            if (descriptive) {
                console.log(`Workflow: ${workflowId} current status: ${currentStatus}`);
            }
            await Promise.delay(5000);
            return this.waitForStatus(workflowId, desiredStatus, timeoutDate, descriptive);
        }

        return workflow;
    }
}

module.exports = Workflows;
