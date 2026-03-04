const options = {
  apiKey: process.env.GEMINI_API_KEY || '',
  elevenlabsApiKey: '',
  task: '',
  exceptions: [],
  intervalSeconds: 30,
  autoDelete: true,
  focusMode: 'any',
  offTaskThreshold: 2,
  offTaskCount: 0,
  paused: false,
  totalChecks: 0,
  onTaskStreak: 0,
  totalCostUsd: 0,
  lastCallCostUsd: 0,
};

module.exports = { options };
