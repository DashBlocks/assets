import pathUtil from 'node:path';
import fs from 'node:fs';

/**
 * @param {string} path
 * @returns {boolean}
 */
const isDirectorySync = path => {
    try {
        const stat = fs.statSync(path);
        return stat.isDirectory();
    } catch (e) {
        if (e.code === 'ENOENT') {
            return false;
        }
        throw e;
    }
};

/**
 * @param {string} type
 */
const pullAssetsOfType = type => {
    console.log(`Generating Dash ${type} library for scratch-gui...`);
    const scratchGui = pathUtil.join(__dirname, '../../scratch-gui');
    if (!isDirectorySync(scratchGui)) {
        throw new Error('Could not find scratch-gui.');
    }

    const assetsDirectory = pathUtil.join(__dirname, `../${type}`);
    if (!isDirectorySync(assetsDirectory)) {
        console.log(`Skipping ${type}; could not find ${type}.`);
        return;
    }

    const guiDashAssets = [];
    const assetsFiles = fs.readdirSync(assetsDirectory)
        .filter(name => pathUtil.extname(name) !== '.json');
    for (const assetFile of assetsFiles) {
        const assetFilename = pathUtil.parse(assetFile).name;
        const metadataFile = pathUtil.join(assetsDirectory, `${assetFilename}.json`);
        let rawMetadata;
        try {
            rawMetadata = fs.readFileSync(metadataFile);
        } catch (_) {
            throw new Error(`Failed to read metadata of ${assetFilename} (${type}).`);
        }
        let jsonMetadata;
        try {
            jsonMetadata = JSON.parse(rawMetadata);
        } catch (_) {
            throw new Error(`Invaild metadata of ${assetFilename} (${type}).`);
        }
        jsonMetadata.src = {
            library: 'dash',
            path: `/${type}/${encodeURIComponent(assetFile)}`
        };
        guiDashAssets.push(jsonMetadata);
    }
        
    const guiDashAssetsFile = pathUtil.join(scratchGui, `src/lib/libraries/dash-assets/generated-${type}.json`);
    fs.writeFileSync(guiDashAssetsFile, JSON.stringify(guiDashAssets, null, 4));
};

const pullEverything = () => {
    try {
        pullAssetsOfType('backdrops');
        pullAssetsOfType('costumes');
        pullAssetsOfType('sounds');
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

pullEverything();
