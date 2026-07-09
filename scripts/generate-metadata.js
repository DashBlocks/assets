import pathUtil from 'node:path';
import fs from 'node:fs';
import readline from 'node:readline';
import {imageSizeFromFile} from 'image-size/fromFile';
import {parseFile as getSoundMetadata} from 'music-metadata';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

/**
 * @param {string} title
 * @returns {string}
 */
const prompt = title => new Promise((resolve) => rl.question(`${title} `, (answer) => resolve(answer)));

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
const genMetadata4AssetsOfType = async type => {
    console.log(`Generating metadata for assets in Dash ${type} library...`);

    const assetsDirectory = pathUtil.join(__dirname, `../${type}`);
    if (!isDirectorySync(assetsDirectory)) {
        console.log(`Skipping ${type}; could not find ${type}.`);
        return;
    }

    const assetsFiles = fs.readdirSync(assetsDirectory)
        .filter(name => pathUtil.extname(name) !== '.json');
    for (const assetFile of assetsFiles) {
        const assetFilename = pathUtil.parse(assetFile).name;
        const metadataFile = pathUtil.join(assetsDirectory, `${assetFilename}.json`);
        let rawMetadata;
        try {
            rawMetadata = fs.readFileSync(metadataFile);
        } catch (_) {
            rawMetadata = '{}';
        }
        let jsonMetadata;
        try {
            jsonMetadata = JSON.parse(rawMetadata);
        } catch (_) {
            throw new Error(`Invaild metadata of ${assetFilename} (${type}).`);
        }

        if (!('name' in jsonMetadata)) {
            jsonMetadata.name = await prompt(`${assetFilename} (${type}): Enter the asset name... (empty for filename)`) || assetFilename;
        }
        if (!('tags' in jsonMetadata)) {
            const tagsString = await prompt(`${assetFilename} (${type}): Enter the tags separated by commas...`);
            jsonMetadata.tags = new Set(tagsString.split(',')).values().toArray();
        }
        switch (type) {
            case 'backdrops':
            case 'costumes': {
                const dimensions = await imageSizeFromFile(assetFile);

                if (!('bitmapResolution' in jsonMetadata)) {
                    if (pathUtil.extname(assetFile) === '.svg') {
                        jsonMetadata.bitmapResolution = 1;
                    } else {
                        const answer = await prompt(`${assetFilename} (${type}): Enter the bitmap resolution... (empty for auto-calculated)`);
                        jsonMetadata.bitmapResolution = answer
                            ? parseFloat(answer)
                            : Math.max(1, Math.min(
                                dimensions.width / 480,
                                dimensions.height / 360
                            ));
                    }
                }
                if (!('dataFormat' in jsonMetadata)) {
                    jsonMetadata.dataFormat = pathUtil.extname(assetFile).slice(1).toLowerCase();
                }
                if (!('rotationCenterX' in jsonMetadata)) {
                    const answer = await prompt(`${assetFilename} (${type}): Enter X of the rotation center... (empty for centered)`);
                    jsonMetadata.rotationCenterX = answer
                        ? parseFloat(answer)
                        : dimensions.width / 2;
                }
                if (!('rotationCenterY' in jsonMetadata)) {
                    const answer = await prompt(`${assetFilename} (${type}): Enter Y of the rotation center... (empty for centered)`);
                    jsonMetadata.rotationCenterY = answer
                        ? parseFloat(answer)
                        : dimensions.height / 2;
                }
            }
            case 'sounds': {
                const soundMetadata = await getSoundMetadata(assetFile);

                if (!('dataFormat' in jsonMetadata)) {
                    jsonMetadata.dataFormat = '';
                }
                if (!('sampleCount' in jsonMetadata)) {
                    jsonMetadata.sampleCount = Math.round(soundMetadata.format.sampleRate * soundMetadata.format.duration);
                }
                if (!('rate' in jsonMetadata)) {
                    jsonMetadata.rate = soundMetadata.format.sampleRate;
                }
            }
        }

        fs.writeFileSync(metadataFile, JSON.stringify(jsonMetadata, null, 4));
    }
};

const genMetadata4Everything = async () => {
    try {
        await genMetadata4AssetsOfType('backdrops');
        await genMetadata4AssetsOfType('costumes');
        await genMetadata4AssetsOfType('sounds');
        rl.close();
    } catch (e) {
        console.error(e);
        rl.close();
        process.exit(1);
    }
};

genMetadata4Everything();
