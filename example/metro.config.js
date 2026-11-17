// Uses the package straight from ../src so changes show up without publishing.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const root = path.resolve(__dirname, '..');
config.watchFolders = [root];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];
config.resolver.extraNodeModules = { 'bopmigo-react-native': root };
config.resolver.blockList = [new RegExp(`${root.replace(/[/\\]/g, '[/\\\\]')}[/\\\\]node_modules[/\\\\].*`)];
module.exports = config;
