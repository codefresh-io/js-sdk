const { spawn } = require('child_process');
const Resource = require('./Resource.base');
const prepareSpwan = require('./Spwan.helper');

const _installRuntimeScript = async (info, filePath) => {
    const {
        apiHost, // --api-host
        token, // --agent-token
        kubeContextName, // kube-context-name
        kubeNamespace, // --kube-namespace
        dryRun, // --dryRun
        inCluster, // -inCluster
        kubernetesRunnerType, // --kubernetes-runner-type
        kubeConfigPath, // --kube-config-path
        verbose, // --verbose
        name, // --runtimeEnvironmentName
        setValue, // --set-value
        setFile, // --set-file
        kubeNodeSelector, // --kube-node-selector
        storageClassName, // --storage-class
        logFormatting, // --log-formtter

    } = info;

    const commands = [
        'install',
        'runtime',
        '--codefreshToken',
        token,
        '--api-host',
        apiHost,
        '--kube-context-name',
        kubeContextName,
        '--kube-namespace',
        kubeNamespace,
    ];

    if (dryRun) {
        commands.push('--dry-run');
    }
    if (inCluster) {
        commands.push('--in-cluster');
    }
    if (kubernetesRunnerType) {
        commands.push(`--kubernetes-runner-type=${kubernetesRunnerType}`);
    }
    if (kubeConfigPath) {
        commands.push(`--kube-config-path=${kubeConfigPath}`);
    }
    if (verbose) {
        commands.push('--verbose');
    }
    if (setValue) {
        commands.push(`--set-value=${setValue}`);
    }
    if (setFile) {
        commands.push(`--set-file=${setFile}`);
    }
    if (kubeNodeSelector) {
        commands.push(`--kube-node-selector=${kubeNodeSelector}`);
    }

    if (name) {
        commands.push('--runtimeName');
        commands.push(name);
    }

    if (storageClassName) {
        commands.push(`--storage-class=${storageClassName}`);
    }
    if (storageClassName) {
        commands.push(`--storage-class=${storageClassName}`);
    }
    if (logFormatting) {
        commands.push(`--log-formtter=${logFormatting}`);
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

const _attachRuntimeScript = (info, filePath) => {
    const {
        kubeServiceAccount, // kube-service-account
        kubeContextName, // kube-context-name
        kubeNamespace, // --kube-namespace
        kubeConfigPath, // --kube-config-path
        agentKubeContextName, // --kube-context-name-agent
        agentKubeNamespace, // --kube-namespace-agent
        agentKubeConfigPath, // --kube-config-path-agent
        restartAgent, // --restart-agent
        verbose, // --verbose
        runtimeName, // --runtimeName
        logFormatting, // --log-formtter
    } = info;

    const commands = [
        'attach',
        '--kube-context-name',
        kubeContextName,
        '--kube-namespace',
        kubeNamespace,
        '--runtime-name',
        runtimeName,

    ];

    if (kubeServiceAccount) {
        commands.push(`--kube-service-account=${kubeServiceAccount}`);
    }

    if (kubeConfigPath) {
        commands.push(`--kube-config-path=${kubeConfigPath}`);
    }
    if (agentKubeContextName) {
        commands.push(`--kube-context-name-agent=${agentKubeContextName}`);
    }
    if (agentKubeNamespace) {
        commands.push(`--kube-namespace-agent=${agentKubeNamespace}`);
    }
    if (agentKubeConfigPath) {
        commands.push(`--kube-config-path-agent=${agentKubeConfigPath}`);
    }
    if (verbose) {
        commands.push('--verbose');
    }
    if (restartAgent) {
        commands.push('--restart-agent');
    }
    if (logFormatting) {
        commands.push(`--log-formtter=${logFormatting}`);
    }

    const attachScript = spawn(filePath, commands);
    attachScript.stdout.pipe(process.stdout);
    attachScript.stderr.pipe(process.stderr);
    process.stdin.pipe(attachScript.stdin);
    return new Promise((resolve) => {
        attachScript.on('exit', (code) => {
            resolve(code);
        });
    });
};

const _unInstallRuntimeScript = (info, filePath) => {
    const {
        kubeContextName, // kube-context-name
        kubeNamespace, // --kube-namespace
        kubeConfigPath, // --kube-config-path
        agentKubeContextName, // --kube-context-name-agent
        agentKubeNamespace, // --kube-namespace-agent
        agentKubeConfigPath, // --kube-config-path-agent
        restartAgent, // --restart-agent
        verbose, // --verbose
        runtimeName, // --runtimeName
        storageClassName, // --storage-class-name
        logFormatting, // --log-formtter
    } = info;

    const commands = [
        'uninstall',
        'runtime',
        '--kube-context-name',
        kubeContextName,
        '--kube-namespace',
        kubeNamespace,
        '--runtime-name',
        runtimeName,

    ];

    if (kubeConfigPath) {
        commands.push(`--kube-config-path=${kubeConfigPath}`);
    }
    if (agentKubeContextName) {
        commands.push(`--kube-context-name-agent=${agentKubeContextName}`);
    }
    if (agentKubeNamespace) {
        commands.push(`--kube-namespace-agent=${agentKubeNamespace}`);
    }
    if (agentKubeConfigPath) {
        commands.push(`--kube-config-path-agent=${agentKubeConfigPath}`);
    }
    if (verbose) {
        commands.push('--verbose');
    }
    if (restartAgent) {
        commands.push('--restart-agent');
    }
    if (storageClassName) {
        commands.push(`--storage-class-name=${storageClassName}`);
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

class Runtimes extends Resource {
    async install(info) {
        const filePath = await this.getFilePath();
        const { terminateProcess } = info;
        const exitCode = await _installRuntimeScript(info, filePath, terminateProcess);
        if (terminateProcess) {
            process.exit(exitCode);
        }
        return exitCode;
    }

    async attach(info) {
        const { terminateProcess, events } = info;
        const filePath = await this.getFilePath(events);
        const exitCode = await _attachRuntimeScript(info, filePath, terminateProcess);
        if (terminateProcess) {
            process.exit(exitCode);
        }
        return exitCode;
    }

    async unInstall(info) {
        const { terminateProcess, events } = info;
        const filePath = await this.getFilePath(events);
        const exitCode = await _unInstallRuntimeScript(info, filePath);
        if (terminateProcess) {
            process.exit(exitCode);
        }
        return exitCode;
    }

    async getFilePath(events) {
        // eslint-disable-next-line max-len
        const filePath = await prepareSpwan({ name: 'agent', repoName: 'venona', pathName: 'venonactl', branch: 'release-1.0', excludeVersionPrefix: true, events });
        return filePath;
    }
}

module.exports = Runtimes;
