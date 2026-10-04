const { execSync } = require('child_process');
const { existsSync, mkdirSync, renameSync, readFileSync, unlinkSync } = require('fs');
const { platform, tmpdir } = require('os');
const path = require('path');
const { desktopCapturer } = require('electron');

const TEMP_PATH = path.join(tmpdir(), 'task-electron-latest.png');
const KEEP_DIR  = path.join(tmpdir(), 'task-electron-screenshots');

async function takeScreenshot(autoDelete) {
  const os = platform();

  if (os === 'darwin') {
    execSync(`screencapture -x "${TEMP_PATH}"`);
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

  if (os === 'win32' || os === 'linux') {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 },
    });

    const primary = sources.find(source => source && source.thumbnail) || sources[0];
    if (!primary || !primary.thumbnail) {
      throw new Error('No screen capture source available.');
    }

    const pngBuffer = primary.thumbnail.toPNG();
    return pngBuffer.toString('base64');
  }

  throw new Error(`${os} not supported for screen capture.`);
}

module.exports = { takeScreenshot };
