const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('fs');
const path = require('path');

let configDir = null;
let configFile = null;

function initConfig(userDataPath) {
  configDir  = userDataPath;
  configFile = path.join(configDir, 'config.json');
}

function loadConfig() {
  if (!configFile) return {};
  if (!existsSync(configFile)) return {};
  try {
    return JSON.parse(readFileSync(configFile, 'utf8'));
  } catch {
    return {};
  }
}

function saveConfig(data) {
  if (!configDir) return;
  if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true });
  writeFileSync(configFile, JSON.stringify(data, null, 2), 'utf8');
}

function saveApiKey(apiKey) {
  const existing = loadConfig();
  saveConfig({ ...existing, apiKey });
}

module.exports = { initConfig, loadConfig, saveConfig, saveApiKey };
