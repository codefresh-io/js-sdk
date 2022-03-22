const fs = require('fs');
const { resolve, join } = require('path');
const { homedir, arch } = require('os');

const _ = require('lodash');
const rp = require('request-promise');
const request = require('request');
const decompress = require('decompress');
const decompressTargz = require('decompress-targz');
const decompressUnzip = require('decompress-unzip');
const compareVersions = require('compare-versions');

const CODEFRESH_PATH = resolve(homedir(), '.Codefresh');

const prepareSpwan = async ({ name, repoName, pathName, branch = 'master', excludeVersionPrefix = false, events }) => {
    const dirPath = join(CODEFRESH_PATH, name);
    const versionPath = join(CODEFRESH_PATH, name, 'version.txt');
    const filePath = join(CODEFRESH_PATH, name, repoName);
    const fullPath = pathName ? join(repoName, branch, pathName) : join(repoName, branch);
    const versionUrl = `https://raw.githubusercontent.com/codefresh-io/${fullPath}/VERSION`;

    let zipPath = join(CODEFRESH_PATH, name, 'data');
    let shouldUpdate = true;
    const options = {
        url: versionUrl,
        method: 'GET',
        headers: { 'User-Agent': 'codefresh' },
    };
    let version = await rp(options);
    version = version.trim();
    if (!fs.existsSync(CODEFRESH_PATH)) {
        fs.mkdirSync(CODEFRESH_PATH);
        fs.mkdirSync(dirPath);
    } else if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath);
    } else if (fs.existsSync(versionPath)) {
        let currVersion = fs.readFileSync(versionPath, { encoding: 'UTF8' }).trim();
        if (currVersion === '') {
            currVersion = '0';
        }
        if (compareVersions(currVersion.trim(), version.trim()) >= 0) {
            shouldUpdate = false;
        }
    }
    if (shouldUpdate) {
        let osType;
        const { platform } = process;
        if (_.isEqual(platform, 'darwin')) {
            osType = _.isEqual(arch(), 'x32') ? 'Darwin_i386.tar.gz' : 'Darwin_x86_64.tar.gz';
            zipPath = `${zipPath}.tar.gz`;
        } else if (_.isEqual(platform, 'linux')) {
            osType = _.isEqual(arch(), 'x32') ? 'Linux_i386.tar.gz' : 'Linux_x86_64.tar.gz';
            zipPath = `${zipPath}.tar.gz`;
        } else if (_.isEqual(platform, 'win32')) {
            osType = _.isEqual(arch(), 'x32') ? 'Windows_i386.zip' : 'Windows_x86_64.zip';
            zipPath = `${zipPath}.zip`;
        }
        const versionPerfix = excludeVersionPrefix ? '' : 'v';
        // eslint-disable-next-line max-len
        const assetUrl = `https://github.com/codefresh-io/${repoName}/releases/download/${versionPerfix}${version}/${repoName}_${version}_${osType}`;
        const req = request(assetUrl);
        let progressCounter = 0;
        if (events) {
            req.on('response', (res) => {
                events.reportStart(parseInt(res.headers['content-length'], 10));
            });
            req.on('data', (chunk) => {
                progressCounter += chunk.length;
                events.reportProgress(progressCounter);
            });
        }

        req.pipe(fs.createWriteStream(zipPath));
        const p = new Promise((resolveFn, rejectFn) => {
            req.on('end', () => {
                decompress(zipPath, join(homedir(), '.Codefresh', name), {
                    plugins: [
                        decompressTargz(),
                        decompressUnzip(),
                    ],
                }).then(() => {
                    fs.writeFile(versionPath, version, (err) => {
                        if (err) {
                            rejectFn(err);
                        }
                    });
                    resolveFn(filePath);
                });
            });
        });
        return p;
    }
    return filePath;
};

module.exports = prepareSpwan;
