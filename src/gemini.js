const { GoogleGenAI } = require('@google/genai');

const PRICE_INPUT_PER_M  = 0.10;
const PRICE_OUTPUT_PER_M = 0.40;

let client = null;

function initGemini(apiKey) {
  client = new GoogleGenAI({ apiKey });
}

async function checkOnTask(imageBase64, task, focusMode = 'any', exceptions = []) {
  if (!client) throw new Error('Gemini not initialized');

  const exceptionsClause = exceptions.length > 0
    ? `\nUSER-APPROVED EXCEPTIONS: The user has explicitly marked these activities as acceptable for this task:\n${exceptions.map(e => `- ${e}`).join('\n')}\nIf the screen matches one of these, answer yes.\n`
    : '';

  const focusRule = focusMode === 'all'
    ? `ALL visible screens must be showing work related to the task. If any screen shows something unrelated (social media, YouTube, news, Twitter/X, etc.) the answer is no.`
    : `At least one screen must be showing work related to the task. However, if Twitter/X is visible on ANY screen, the answer is automatically no.`;

  const response = await client.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [
      { inlineData: { mimeType: 'image/png', data: imageBase64 } },
      {
        text: `You are a strict focus monitor. The user declared they are working on: "${task}"
${exceptionsClause}

Examine the screenshot carefully and answer: is the user ACTIVELY working on that specific task right now?

STRICT RULES — a "yes" requires ALL of the following:
1. The frontmost/active window must be a tool directly used to perform the task (e.g. code editor, terminal, design tool, relevant docs).
2. Passive presence is NOT enough. A browser tab open to documentation counts only if it is the active window and clearly being referenced for the task. YouTube, social media, news, or unrelated browsing = no.
3. The task description must match what is visibly happening. If the task is "coding", the user must be actively in a code editor or terminal — not just reading about code or watching a tutorial.
4. ${focusRule}
5. There will always be a small dark frosted-glass floating bar visible somewhere on screen — it shows the current task name, a timer, a checkmark button, and a circular progress ring. This is the focus monitor app itself. Completely ignore it. Its presence and contents are not evidence of work or distraction.
6. If you are unsure whether what's on screen is truly related to the stated task, default to NO.

Be strict. A distracted user will try to rationalize their screen as on-task. Do not accept weak justifications.

Reply in this EXACT format (three lines only, no extra text):
VERDICT: yes
REASON: one blunt sentence describing exactly what the active window shows
INSULT: (only if VERDICT is no) a witty, slightly rude quip about what's literally on the screen. Be specific — roast the actual thing you see, not just "you're distracted". Start dismissive. Use irony, a cutting observation, or a fake award. Punchy and conversational, like a sarcastic friend who noticed exactly what you were doing. No corporate speak, no softening, no period at the end. Max 12 words, no quotes`,
      },
    ],
  });

  const usage = response.usageMetadata || {};
  const inputTokens  = usage.promptTokenCount     || 0;
  const outputTokens = usage.candidatesTokenCount || 0;
  const costUsd = (inputTokens / 1_000_000) * PRICE_INPUT_PER_M
                + (outputTokens / 1_000_000) * PRICE_OUTPUT_PER_M;

  const text = response.text.trim();

  const verdictMatch = text.match(/VERDICT:\s*(yes|no)/i);
  const reasonMatch  = text.match(/REASON:\s*(.+)/i);
  const insultMatch  = text.match(/INSULT:\s*(.+)/i);

  let onTask, reason, insult;

  if (verdictMatch) {
    onTask = verdictMatch[1].toLowerCase() === 'yes';
    reason = reasonMatch ? reasonMatch[1].trim() : '';
    insult = (!onTask && insultMatch) ? insultMatch[1].trim() : null;
  } else {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    onTask = (lines[0] || '').toLowerCase().startsWith('yes');
    reason = lines[1] || '';
    insult = null;
  }

  return { onTask, reason, insult, costUsd, inputTokens, outputTokens };
}

module.exports = { initGemini, checkOnTask };
