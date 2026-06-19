const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add Reanimated plugin + CSS for web
config.transformer.minifierConfig = {
  compress: false,
};

module.exports = config;