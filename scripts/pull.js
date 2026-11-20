import { fileURLToPath } from 'node:url';
import pathUtil from 'node:path';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = pathUtil.dirname(__filename);

const DEFAULT_TAGS = new Set(['dash']);
const LIBRARY = 'dash';

const METADATA_PROPS_ORDER = [
    'name',
    'tags',
    'license',
    'bitmapResolution',
    'dataFormat',
    'rotationCenterX',
    'rotationCenterY',
    'sampleCount',
    'rate',
    'isStage',
    'variables',
    'costumes',
    'sounds',
    'blocks',
    'src'
];

const POP_SOUND_METADATA = {
    assetId: '83a9787d4cb6f3b7632b4ddfebf74367',
    name: 'pop',
    dataFormat: 'wav',
    format: '',
    rate: 44100,
    sampleCount: 1032,
    md5ext: '83a9787d4cb6f3b7632b4ddfebf74367.wav'
};

/**
 * @param {string} targetPath
 * @returns {boolean}
 */
const isDirectorySync = targetPath => {
    try {
        return fs.statSync(targetPath).isDirectory();
    } catch (e) {
        if (e.code === 'ENOENT') return false;
        throw e;
    }
};

/**
 * @param {object} obj
 * @returns {object}
 */
const sortMetadataProps = obj => Object.fromEntries(
    Object.entries(obj).sort(([prop1], [prop2]) => {
        const idx1 = METADATA_PROPS_ORDER.indexOf(prop1);
        const idx2 = METADATA_PROPS_ORDER.indexOf(prop2);
        return (idx1 === -1 ? Infinity : idx1) - (idx2 === -1 ? Infinity : idx2);
    })
);

/**
 * @param {string} type
 * @param {string} fullAssetPath
 * @param {Function} getLogName
 * @returns {object}
 */
const getMetadataOfAsset = (type, fullAssetPath, getLogName) => {
    const parsedPath = pathUtil.parse(fullAssetPath);
    const metadataFile = pathUtil.join(parsedPath.dir, `${parsedPath.name}.json`);

    let rawMetadata;
    try {
        rawMetadata = fs.readFileSync(metadataFile, 'utf8');
    } catch (_) {
        throw new Error(`Failed to read metadata of ${getLogName(type, parsedPath.name)}.`);
    }

    let jsonMetadata;
    try {
        jsonMetadata = JSON.parse(rawMetadata);
    } catch (_) {
        throw new Error(`Invalid metadata of ${getLogName(type, parsedPath.name)}.`);
    }

    const assetTags = Array.isArray(jsonMetadata.tags) ? jsonMetadata.tags : [];
    jsonMetadata.tags = [...new Set([...DEFAULT_TAGS, ...assetTags])];
    jsonMetadata.src = {
        library: LIBRARY,
        path: `/${type}/${encodeURIComponent(parsedPath.base)}`
    };

    return sortMetadataProps(jsonMetadata);
};

/**
 * @param {string} type
 * @param {string} scratchGui
 */
const pullAssetsOfType = (type, scratchGui) => {
    console.log(`Generating Dash ${type} library for scratch-gui...`);
    const assetsDirectory = pathUtil.join(__dirname, `../${type}`);
    if (!isDirectorySync(assetsDirectory)) {
        console.log(`Skipping ${type}; could not find ${type}.`);
        return;
    }

    const guiDashAssets = [];
    const assetsFiles = fs.readdirSync(assetsDirectory)
        .filter(name => !name.startsWith('.') && pathUtil.extname(name) !== '.json');

    for (const assetFile of assetsFiles) {
        const fullAssetPath = pathUtil.join(assetsDirectory, assetFile);
        guiDashAssets.push(
            getMetadataOfAsset(type, fullAssetPath, (t, filename) => `${filename} (${t})`)
        );
    }

    const guiDashAssetsFile = pathUtil.join(scratchGui, `src/lib/libraries/dash-assets/generated-${type}.json`);
    fs.mkdirSync(pathUtil.dirname(guiDashAssetsFile), { recursive: true });
    fs.writeFileSync(guiDashAssetsFile, JSON.stringify(guiDashAssets, null, 4));
};

/**
 * @param {string} scratchGui
 */
const pullSprites = scratchGui => {
    console.log('Generating Dash sprites library for scratch-gui...');
    const spritesDirectory = pathUtil.join(__dirname, '../sprites');
    if (!isDirectorySync(spritesDirectory)) {
        console.log('Skipping sprites; could not find sprites.');
        return;
    }

    const guiDashAssets = [];
    const spritesMetadata = fs.readdirSync(spritesDirectory)
        .filter(name => !name.startsWith('.') && pathUtil.extname(name) === '.json');

    for (const metadataFile of spritesMetadata) {
        const filename = pathUtil.parse(metadataFile).name;
        const fullMetadataPath = pathUtil.join(spritesDirectory, metadataFile);

        let rawMetadata;
        try {
            rawMetadata = fs.readFileSync(fullMetadataPath, 'utf8');
        } catch (_) {
            throw new Error(`Failed to read metadata of ${filename} (sprites).`);
        }

        let jsonMetadata;
        try {
            jsonMetadata = JSON.parse(rawMetadata);
        } catch (_) {
            throw new Error(`Invalid metadata of ${filename} (sprites).`);
        }

        const assetTags = Array.isArray(jsonMetadata.tags) ? jsonMetadata.tags : [];
        jsonMetadata.tags = [...new Set([...DEFAULT_TAGS, ...assetTags])];
        jsonMetadata.isStage = false;
        jsonMetadata.variables = {};
        jsonMetadata.blocks = {};

        if (Array.isArray(jsonMetadata.costumes) && jsonMetadata.costumes.length > 0) {
            jsonMetadata.costumes = jsonMetadata.costumes.map(costume => {
                const costumeAssetFile = pathUtil.join(__dirname, '../costumes', costume);
                const costumeMetadata = getMetadataOfAsset(
                    'costumes',
                    costumeAssetFile,
                    (t, costumeFilename) => `${costumeFilename} (${t}) in ${filename} (sprites)`
                );
                delete costumeMetadata.tags;
                delete costumeMetadata.src;
                return costumeMetadata;
            });
        } else {
            throw new Error(`${filename} (sprites) must have minimum 1 costume.`);
        }

        if (Array.isArray(jsonMetadata.sounds) && jsonMetadata.sounds.length > 0) {
            jsonMetadata.sounds = jsonMetadata.sounds.map(sound => {
                const soundAssetFile = pathUtil.join(__dirname, '../sounds', sound);
                const soundMetadata = getMetadataOfAsset(
                    'sounds',
                    soundAssetFile,
                    (t, soundFilename) => `${soundFilename} (${t}) in ${filename} (sprites)`
                );
                delete soundMetadata.tags;
                delete soundMetadata.src;
                return soundMetadata;
            });
        } else {
            jsonMetadata.sounds = [POP_SOUND_METADATA];
        }

        guiDashAssets.push(sortMetadataProps(jsonMetadata));
    }

    const guiDashAssetsFile = pathUtil.join(scratchGui, 'src/lib/libraries/dash-assets/generated-sprites.json');
    fs.mkdirSync(pathUtil.dirname(guiDashAssetsFile), { recursive: true });
    fs.writeFileSync(guiDashAssetsFile, JSON.stringify(guiDashAssets, null, 4));
};

const pullEverything = () => {
    try {
        let scratchGui = pathUtil.join(__dirname, '../../scratch-gui');
        if (!isDirectorySync(scratchGui)) {
            // scratch-gui/node_modules/dash-assets/scripts
            scratchGui = pathUtil.join(__dirname, '../../..');
            if (!isDirectorySync(scratchGui)) {
                throw new Error('Could not find scratch-gui.');
            }
        }

        pullAssetsOfType('backdrops', scratchGui);
        pullAssetsOfType('costumes', scratchGui);
        pullAssetsOfType('sounds', scratchGui);
        pullSprites(scratchGui);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

pullEverything();
