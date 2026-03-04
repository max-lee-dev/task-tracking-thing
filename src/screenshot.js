const { execSync } = require('child_process');
const { existsSync, mkdirSync, renameSync, readFileSync, unlinkSync } = require('fs');
const { platform } = require('os');
const path = require('path');

const TEMP_PATH = '/tmp/task-electron-latest.png';
const KEEP_DIR  = '/tmp/task-electron-screenshots';

function takeScreenshot(autoDelete) {
  const os = platform();

  if (os === 'darwin') {
    execSync(`screencapture -x ${TEMP_PATH}`);
  } else {
    throw new Error('Non-Mac not yet supported.');
  }

  const imageData = readFileSync(TEMP_PATH, { encoding: 'base64' });

  if (!autoDelete) {
    if (!existsSync(KEEP_DIR)) mkdirSync(KEEP_DIR, { recursive: true });
    const dest = path.join(KEEP_DIR, `${Date.now()}.png`);
    renameSync(TEMP_PATH, dest);
  } else {
    try { unlinkSync(TEMP_PATH); } catch {}
  }

  return imageData;
}

module.exports = { takeScreenshot };
