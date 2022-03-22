const { spawn } = require('child_process');
const Resource = require('./Resource.base');
const prepareSpwan = require('./Spwan.helper');

const _createClusterScript = async (info, filePath) => {
    const {
        contextName,
        name,
        behindFirewall,
        context,
        namespace,
        serviceaccount,
    } = info;
    const commands = [
        'create',
        '--c',
        contextName,
        '--token',
        context.token,
        '--api-host',
        `${context.url}/`,
        '--namespace',
        namespace,
        '--serviceaccount',
        serviceaccount,
    ];
    if (name) {
        commands.push('--name-overwrite');
        commands.push(name);
    }

    if (behindFirewall) {
        commands.push('--behind-firewall');
    }
    const clusterScript = spawn(filePath, commands);
    clusterScript.stdout.pipe(process.stdout);
    clusterScript.stderr.pipe(process.stderr);
    process.stdin.pipe(clusterScript.stdin);
    return new Promise((resolve) => {
        clusterScript.on('exit', (code) => {
            resolve(code);
        });
    });
};

class Clusters extends Resource {
    async create(info) {
        const { terminateProcess, events } = info;
        const filePath = await prepareSpwan({ name: 'cluster', repoName: 'stevedore', events });
        const exitCode = await _createClusterScript(info, filePath);
        if (terminateProcess) {
            process.exit(exitCode);
        }
        return exitCode;
    }
}

module.exports = Clusters;
