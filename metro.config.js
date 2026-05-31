const {
    getDefaultConfig
} = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

config.resolver.alias = {
    '@': path.resolve(projectRoot),
    '@features': path.resolve(projectRoot, 'src/features'),
    '@shared': path.resolve(projectRoot, 'src/shared'),
    '@chat': path.resolve(projectRoot, 'src/features/chat'),
    '@auth': path.resolve(projectRoot, 'src/features/auth'),
    '@social': path.resolve(projectRoot, 'src/features/social'),
    '@friends': path.resolve(projectRoot, 'src/features/friends'),
    '@user': path.resolve(projectRoot, 'src/features/user'),
    '@notification': path.resolve(projectRoot, 'src/features/notification'),
};

module.exports = config;