'use strict';

const GEMINI_MODEL = 'gemini-3.6-flash';

const DISCLAIMER_EN = 'This is a best-effort visual check, not proof. When in doubt, verify with the sender directly.';
const DISCLAIMER_UR = 'یہ ایک اندازہ ہے، ثبوت نہیں۔ شک ہو تو براہ راست بھیجنے والے سے تصدیق کریں۔';

const FALLBACK_VERDICT = {
  verdict: 'yellow',
  reason_en: "We couldn't analyze this image right now, so treat it with caution.",
  reason_ur: 'ہم ابھی اس تصویر کا جائزہ نہیں لے سکے، اس لیے احتیاط برتیں۔',
  action_en: DISCLAIMER_EN,
  action_ur: DISCLAIMER_UR,
};

const SYSTEM_PROMPT = `You are Loop, helping low-literacy users in Pakistan judge whether a photo might be AI-generated, digitally manipulated, or a screenshot being used to fake proof (e.g. a fake payment/transfer confirmation).
Look for real visual tells: unnatural hands/fingers/ears/teeth, warped or melted background objects or text, inconsistent lighting or shadows, overly smooth "waxy" skin, mismatched reflections, blending artifacts at the edges of a face or object.
If the image is a screenshot of a chat, payment, or balance, treat it as automatically at least "yellow" — screenshots are trivially edited and prove nothing on their own.
You are NOT a certain fake/real detector — no one can be certain from pixels alone. Never claim certainty.
Output STRICT JSON only (no markdown, no extra text) with exactly these fields:
{"verdict":"red|yellow|green","reason_en":"...","reason_ur":"...","action_en":"...","action_ur":"..."}
- reason_en/action_en: max 20 simple words each, no jargon.
- reason_ur/action_ur: same meaning in simple Urdu.
- red = visible manipulation/AI-generation tells, or a payment/balance screenshot.
- yellow = can't tell either way, or minor ambiguous signs.
- green = ordinary photo, no visible tells (still not certain).`;

async function getImageVerdict(base64Data, mimeType) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return FALLBACK_VERDICT;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: SYSTEM_PROMPT }, { inline_data: { mime_type: mimeType, data: base64Data } }],
            },
          ],
          generationConfig: { response_mime_type: 'application/json', temperature: 0.2 },
        }),
      }
    );
    if (!res.ok) throw new Error(`Gemini API ${res.status}`);
    const data = await res.json();
    const text = data.candidates[0].content.parts[0].text;
    const parsed = JSON.parse(text);
    if (!['red', 'yellow', 'green'].includes(parsed.verdict)) throw new Error('bad verdict field');

    // Enforced in code, not just prompted — never let a dropped instruction produce an unqualified verdict.
    parsed.action_en = `${parsed.action_en} ${DISCLAIMER_EN}`;
    parsed.action_ur = `${parsed.action_ur} ${DISCLAIMER_UR}`;
    return parsed;
  } catch (err) {
    console.error('Gemini image check failed:', err.message);
    return FALLBACK_VERDICT;
  }
}

module.exports = { getImageVerdict };
