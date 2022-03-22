const _ = require('lodash');
const logsHelper = require('../lib/logic/logs.helper');

const mockedClose = jest.fn();
const mockedSubscribe = jest.fn();
jest.mock('@codefresh-io/cf-receiver', () => ({
    CfReceiverService: class CfReceiverService {
        watch() {
            return this;
        }

        subscribe(callback) {
            callback(mockedSubscribe());
        }

        close() {
            return mockedClose();
        }
    },
}));

describe('logs helpers', () => {
    beforeEach(() => {
        mockedClose.mockClear();
        mockedSubscribe.mockClear();
    });

    it('should close ws connection with flag -f and with failure result', async () => {
        const sdk = _.set({}, 'config.context', { url: String(), token: String() });
        mockedSubscribe.mockReturnValue(null);
        const result = await logsHelper.showWorkflowLogsByWebsocket(null, null, true, sdk).catch((err) => err);
        expect(mockedClose.mock.calls.length).toEqual(1);
        expect(_.isError(result)).toEqual(true);
    });

    it('should close ws connection with flag -f and with successful result', async () => {
        const validMsg = { type: 'message', event: { data: JSON.stringify({ msgID: 'getStatus', payload: null }) } };
        const sdk = _.set({}, 'config.context', { url: String(), token: String() });
        mockedSubscribe.mockReturnValue(validMsg);
        const result = await logsHelper.showWorkflowLogsByWebsocket(null, null, true, sdk).catch((err) => err);
        expect(mockedClose.mock.calls.length).toEqual(1);
        expect(_.isError(result)).toEqual(false);
    });

    it('should close ws connection with flag -f and with successful result', async () => {
        const validMsg = { type: 'message', event: { data: JSON.stringify({ slot: 'status', payload: 'success' }) } };
        const sdk = _.set({}, 'config.context', { url: String(), token: String() });
        mockedSubscribe.mockReturnValue(validMsg);
        const result = await logsHelper.showWorkflowLogsByWebsocket(null, null, true, sdk).catch((err) => err);
        expect(mockedClose.mock.calls.length).toEqual(1);
        expect(_.isError(result)).toEqual(false);
    });

    it('should close ws connection without flag -f and with failure result', async () => {
        const sdk = _.set({}, 'config.context', { url: String(), token: String() });
        mockedSubscribe.mockReturnValue(null);
        const result = await logsHelper.showWorkflowLogsByWebsocket(null, null, false, sdk).catch((err) => err);
        expect(mockedClose.mock.calls.length).toEqual(1);
        expect(_.isError(result)).toEqual(true);
    });

    it('should close ws connection without flag -f and with successful result', async () => {
        const validMsg = { type: 'message', event: { data: JSON.stringify({ slot: 'keepAlive' }) } };
        const sdk = _.set({}, 'config.context', { url: String(), token: String() });
        mockedSubscribe.mockReturnValue(validMsg);
        const result = await logsHelper.showWorkflowLogsByWebsocket(null, null, false, sdk).catch((err) => err);
        expect(mockedClose.mock.calls.length).toEqual(1);
        expect(_.isError(result)).toEqual(false);
    });
});
