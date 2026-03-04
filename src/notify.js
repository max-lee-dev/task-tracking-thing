const { Notification } = require('electron');
const { exec } = require('child_process');
const { platform } = require('os');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

const VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel

function speakElevenLabs(text, apiKey) {
  const body = JSON.stringify({
    text,
    model_id: 'eleven_monolingual_v1',
    voice_settings: { stability: 0.5, similarity_boost: 0.75 },
  });

  const reqOptions = {
    hostname: 'api.elevenlabs.io',
    path: `/v1/text-to-speech/${VOICE_ID}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
      'Accept': 'audio/mpeg',
    },
  };

  const req = https.request(reqOptions, (res) => {
    if (res.statusCode !== 200) return;
    const chunks = [];
    res.on('data', chunk => chunks.push(chunk));
    res.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const tmpFile = path.join(os.tmpdir(), `focus-tts-${Date.now()}.mp3`);
      fs.writeFile(tmpFile, buffer, (err) => {
        if (err) return;
        exec(`afplay "${tmpFile}"`, () => fs.unlink(tmpFile, () => {}));
      });
    });
  });
  req.on('error', () => {});
  req.write(body);
  req.end();
}

function alertOffTask(insult, elevenlabsApiKey) {
  if (Notification.isSupported()) {
    new Notification({
      title: 'focus',
      body: insult || 'Get back to work!',
      silent: false,
    }).show();
  }

  if (elevenlabsApiKey) {
    speakElevenLabs(insult || 'get back to work', elevenlabsApiKey);
  } else if (platform() === 'darwin') {
    const text = insult || 'get back to work';
    const safe = text.replace(/"/g, '').replace(/'/g, '').slice(0, 100);
    exec(`say "${safe}"`);
  }
}

module.exports = { alertOffTask };
