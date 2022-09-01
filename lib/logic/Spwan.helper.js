const fs = require('fs');
const { resolve, join } = require('path');
const { homedir, arch } = require('os');
let { pipeline } = require('stream');
const { createGunzip } = require('zlib');
const { promisify } = require('util');

const _ = require('lodash');
const rp = require('request-promise');
const request = require('request');
const tarStream = require('tar-stream');
const zip = require('zip');
const compareVersions = require('compare-versions');

pipeline = promisify(pipeline);

const CODEFRESH_PATH = resolve(homedir(), '.Codefresh');

async function unzipFile(zipPath, outputPath) {
    const zipBuffer = await fs.promises.readFile(zipPath);
    const zr = zip.Reader(zipBuffer);

    const fileWrites = [];
    zr.forEach((entry) => {
        if (!entry.isFile()) {
            return;
        }

        const outputFilePath = join(outputPath, entry.getName());
        fileWrites.push(fs.promises.writeFile(outputFilePath, entry.getData(), { mode: entry.getMode() }));
    });

    return Promise.all(fileWrites);
}

async function untarFile(tarPath, outputPath) {
    const zipFile = fs.createReadStream(tarPath);
    const unzipStream = createGunzip();
    const extract = tarStream.extract();

    extract.on('entry', async (headers, stream, next) => {
        if (headers.type !== 'file') {
            return next();
        }

        try {
            const outputFilePath = join(outputPath, headers.name);
            const outputFile = fs.createWriteStream(outputFilePath, { mode: headers.mode });
            await pipeline(stream, outputFile);
            return next();
        } catch (error) {
            return next(error);
        }
    });

    await pipeline(
        zipFile,
        unzipStream,
        extract,
    );
}

const prepareSpwan = async ({ name, repoName, pathName, branch = 'master', excludeVersionPrefix = false, events }) => {
    const dirPath = join(CODEFRESH_PATH, name);
    const versionPath = join(CODEFRESH_PATH, name, 'version.txt');
    const outputPath = join(CODEFRESH_PATH, name);
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

        await pipeline(req, fs.createWriteStream(zipPath));

        if (zipPath.endsWith('.zip')) {
            await unzipFile(zipPath, outputPath);
        } else {
            await untarFile(zipPath, outputPath);
        }

        await fs.promises.writeFile(versionPath, version);
    }
    return filePath;
};

module.exports = prepareSpwan;
