const { spawn } = require('child_process');
const Resource = require('./Resource.base');
const prepareSpwan = require('./Spwan.helper');

const _installVenonaScript = async (info, filePath) => {
    const {
        apiHost, // --api-host
        agentId, // --agnetId
        kubeContextName, // kube-context-name
        kubeNamespace, // --kube-namespace
        token, // --agentToken
        kubeNodeSelector, // --kube-node-selector
        dryRun, // --dryRun
        inCluster, // -inCluster
        kubernetesRunnerType, // --kubernetes-runner-type
        tolerations, // --tolerations
        venonaVersion, // --venona-version
        kubeConfigPath, // --kube-config-path
        skipVersionCheck, // --skip-version-check
        verbose, // --verbose
        logFormatting, // --log-formtter
        envVars,
    } = info;
    const commands = [
        'install',
        'agent',
        '--agentId',
        agentId,
        '--api-host',
        apiHost,
        '--kube-context-name',
        kubeContextName,
        '--kube-namespace',
        kubeNamespace,
    ];
    if (kubeNodeSelector) {
        commands.push('--kube-node-selector');
        commands.push(kubeNodeSelector);
    }

    if (token) {
        commands.push(`--agentToken=${token}`);
    }
    if (dryRun) {
        commands.push('--dry-run');
    }
    if (inCluster) {
        commands.push('--in-cluster');
    }
    if (kubernetesRunnerType) {
        commands.push(`--kubernetes-runner-type=${kubernetesRunnerType}`);
    }
    if (tolerations) {
        commands.push(`--tolerations=${tolerations}`);
    }
    if (venonaVersion) {
        commands.push(`--venona-version=${venonaVersion}`);
    }
    if (kubeConfigPath) {
        commands.push(`--kube-config-path=${kubeConfigPath}`);
    }
    if (skipVersionCheck) {
        commands.push('--skip-version-check');
    }
    if (verbose) {
        commands.push('--verbose');
    }
    if (logFormatting) {
        commands.push(`--log-formtter=${logFormatting}`);
    }
    if (envVars) {
        commands.push(`--envVars=${envVars}`);
    }

    const installScript = spawn(filePath, commands);
    installScript.stdout.pipe(process.stdout);
    installScript.stderr.pipe(process.stderr);
    process.stdin.pipe(installScript.stdin);
    return new Promise((resolve) => {
        installScript.on('exit', (code) => {
            resolve(code);
        });
    });
};

const _unInstallVenonaScript = async (info, filePath) => {
    const {
        kubeContextName, // kube-context-name
        kubeNamespace, // --kube-namespace
        kubeConfigPath, // --kube-config-path
        verbose, // --verbose
        logFormatting, // --log-formtter
    } = info;
    const commands = [
        'uninstall',
        'agent',
        '--kube-context-name',
        kubeContextName,
        '--kube-namespace',
        kubeNamespace,
    ];

    if (kubeConfigPath) {
        commands.push(`--kube-config-path=${kubeConfigPath}`);
    }

    if (verbose) {
        commands.push('--verbose');
    }

    if (logFormatting) {
        commands.push(`--log-formtter=${logFormatting}`);
    }

    const unInstallScript = spawn(filePath, commands);
    unInstallScript.stdout.pipe(process.stdout);
    unInstallScript.stderr.pipe(process.stderr);
    process.stdin.pipe(unInstallScript.stdin);
    return new Promise((resolve) => {
        unInstallScript.on('exit', (code) => {
            resolve(code);
        });
    });
};

const _migrateVenonaScript = async (info, filePath) => {
    const {
        kubeContextName, // kube-context-name
        kubeNamespace, // --kube-namespace
        kubeConfigPath, // --kube-config-path
        verbose, // --verbose
    } = info;
    const commands = [
        'migrate',
        '--kube-context-name',
        kubeContextName,
        '--kube-namespace',
        kubeNamespace,
    ];

    if (kubeConfigPath) {
        commands.push(`--kube-config-path=${kubeConfigPath}`);
    }

    if (verbose) {
        commands.push('--verbose');
    }

    const migrateScript = spawn(filePath, commands);
    migrateScript.stdout.pipe(process.stdout);
    migrateScript.stderr.pipe(process.stderr);
    process.stdin.pipe(migrateScript.stdin);
    return new Promise((resolve) => {
        migrateScript.on('exit', (code) => {
            resolve(code);
        });
    });
};

class Agents extends Resource {
    async install(info) {
        // eslint-disable-next-line max-len
        const filePath = await prepareSpwan({ name: 'agent', repoName: 'venona', pathName: 'venonactl', branch: 'release-1.0', excludeVersionPrefix: true, events: info.events });
        const { terminateProcess } = info;
        const exitCode = await _installVenonaScript(info, filePath);
        if (terminateProcess) {
            process.exit(exitCode);
        }
        return exitCode;
    }

    async unInstall(info) {
        // eslint-disable-next-line max-len
        const filePath = await prepareSpwan({ name: 'agent', repoName: 'venona', pathName: 'venonactl', branch: 'release-1.0', excludeVersionPrefix: true, events: info.events });
        const { terminateProcess } = info;
        const exitCode = await _unInstallVenonaScript(info, filePath);
        if (terminateProcess) {
            process.exit(exitCode);
        }
        return exitCode;
    }

    async migrate(info) {
        // eslint-disable-next-line max-len
        const filePath = await prepareSpwan({ name: 'agent', repoName: 'venona', pathName: 'venonactl', branch: 'release-1.0', excludeVersionPrefix: true, events: info.events });
        const { terminateProcess } = info;
        const exitCode = await _migrateVenonaScript(info, filePath);
        if (terminateProcess) {
            process.exit(exitCode);
        }
        return exitCode;
    }
}

module.exports = Agents;
