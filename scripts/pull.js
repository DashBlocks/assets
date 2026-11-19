import { fileURLToPath } from "node:url";
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
 * @param {string} assetFile
 * @param {Function} getLogName
 * @returns {object}
 */
const getMetadataOfAsset = (type, assetFile, getLogName) => {
    const assetFilename = pathUtil.parse(assetFile).name;
    const metadataFile = pathUtil.join(pathUtil.dirname(assetFile), `${assetFilename}.json`);
    
    let rawMetadata;
    try {
        rawMetadata = fs.readFileSync(metadataFile);
    } catch (_) {
        throw new Error(`Failed to read metadata of ${getLogName(type, assetFilename)}.`);
    }

    let jsonMetadata;
    try {
        jsonMetadata = JSON.parse(rawMetadata);
    } catch (_) {
        throw new Error(`Invaild metadata of ${getLogName(type, assetFilename)}.`);
    }

    const assetTags = Array.isArray(jsonMetadata.tags)
        ? new Set(jsonMetadata.tags)
        : new Set();
    jsonMetadata.tags = DEFAULT_TAGS.union(assetTags).values().toArray();
    jsonMetadata.src = {
        library: LIBRARY,
        path: `/${type}/${encodeURIComponent(assetFile)}`
    };

    jsonMetadata = Object.fromEntries(Object.entries(jsonMetadata).sort(
        ([prop1], [prop2]) => METADATA_PROPS_ORDER.indexOf(prop1) - METADATA_PROPS_ORDER.indexOf(prop2)
    ));

    return jsonMetadata;
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
        .filter(name => pathUtil.extname(name) !== '.json');
    for (const assetFile of assetsFiles) {
        guiDashAssets.push(getMetadataOfAsset(type, assetFile, (type, filename) => `${filename} (${type})`));
    }
        
    const guiDashAssetsFile = pathUtil.join(scratchGui, `src/lib/libraries/dash-assets/generated-${type}.json`);
    const dir = pathUtil.dirname(guiDashAssetsFile);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(guiDashAssetsFile, JSON.stringify(guiDashAssets, null, 4));
};

/**
 * @param {string} scratchGui
 */
const pullSprites = (scratchGui) => {
    console.log('Generating Dash sprites library for scratch-gui...');

    const spritesDirectory = pathUtil.join(__dirname, '../sprites');
    if (!isDirectorySync(spritesDirectory)) {
        console.log(`Skipping sprites; could not find sprites.`);
        return;
    }

    const guiDashAssets = [];
    const spritesMetadata = fs.readdirSync(spritesDirectory)
        .filter(name => pathUtil.extname(name) === '.json');
    for (const metadataFile of spritesMetadata) {
        const filename = pathUtil.parse(metadataFile).name;
        let rawMetadata;
        try {
            rawMetadata = fs.readFileSync(metadataFile);
        } catch (_) {
            throw new Error(`Failed to read metadata of ${filename} (sprites).`);
        }
        let jsonMetadata;
        try {
            jsonMetadata = JSON.parse(rawMetadata);
        } catch (_) {
            throw new Error(`Invaild metadata of ${filename} (sprites).`);
        }
        const assetTags = Array.isArray(jsonMetadata.tags)
            ? new Set(jsonMetadata.tags)
            : new Set();
        jsonMetadata.tags = DEFAULT_TAGS.union(assetTags).values().toArray();
        jsonMetadata.isStage = false;
        jsonMetadata.variables = {};
        jsonMetadata.blocks = {};

        if (Array.isArray(jsonMetadata.costumes) && jsonMetadata.costumes.length > 0) {
            for (let i = 0; i < jsonMetadata.costumes.length; i++) {
                const costumeAssetFile = pathUtil.join(__dirname, '../costumes', jsonMetadata.costumes[i]);
                const costumeMetadata = getMetadataOfAsset(
                    'costumes',
                    costumeAssetFile,
                    (type, costumeFilename) => `${costumeFilename} (${type}) in ${filename} (sprites)`
                );
                delete costumeMetadata.tags;
                delete costumeMetadata.src;
                jsonMetadata.costumes[i] = costumeMetadata;
            }
        } else {
            throw new Error(`${filename} (sprites) must have minimum 1 costume.`);
        }

        if (Array.isArray(jsonMetadata.sounds) && jsonMetadata.sounds.length > 0) {
            for (let i = 0; i < jsonMetadata.sounds.length; i++) {
                const soundAssetFile = pathUtil.join(__dirname, '../sounds', jsonMetadata.sounds[i]);
                const soundMetadata = getMetadataOfAsset(
                    'sounds',
                    soundAssetFile,
                    (type, soundFilename) => `${soundFilename} (${type}) in ${filename} (sprites)`
                );
                delete soundMetadata.tags;
                delete soundMetadata.src;
                jsonMetadata.sounds[i] = soundMetadata;
            }
        } else {
            jsonMetadata.sounds = [POP_SOUND_METADATA];
        }

        jsonMetadata = Object.fromEntries(Object.entries(jsonMetadata).sort(
            ([prop1], [prop2]) => METADATA_PROPS_ORDER.indexOf(prop1) - METADATA_PROPS_ORDER.indexOf(prop2)
        ));

        guiDashAssets.push(jsonMetadata);
    }
        
    const guiDashAssetsFile = pathUtil.join(scratchGui, `src/lib/libraries/dash-assets/generated-sprites.json`);
    const dir = pathUtil.dirname(guiDashAssetsFile);
    fs.mkdirSync(dir, { recursive: true });
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
