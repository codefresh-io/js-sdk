const Resource = require('./Resource.base');
const { showWorkflowLogsFromFirebase, showWorkflowLogsFromGCS, showWorkflowLogsByWebsocket } = require('./logs.helper');

class Logs extends Resource {
    // TODO : REFACTOR FIREBASE
    // TODO : https://github.com/codefresh-io/sdk/issues/1
    async showWorkflowLogs(workflowId, follow, removeTimetamps) {
        const workflow = await this.sdk.workflows.getBuild({ buildId: workflowId, noAccount: false });
        const progressJob = await this.sdk.progress.get({ id: workflow.progress });
        if (progressJob.location.type === 'firebase') {
            await showWorkflowLogsFromFirebase(progressJob._id, follow, workflowId, removeTimetamps, this.sdk);
        } else if (progressJob.location.type === 'composition') {
            await showWorkflowLogsByWebsocket(progressJob._id, progressJob.account, follow, this.sdk);
        } else {
            await showWorkflowLogsFromGCS(progressJob, removeTimetamps);
        }
    }
}

module.exports = Logs;
