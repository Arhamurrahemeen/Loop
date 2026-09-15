'use strict';

const GEMINI_MODEL = 'gemini-3.6-flash';

const DISCLAIMER_EN = 'This is a best-effort visual check, not proof. When in doubt, verify another way (call them back, ask them to turn their head or say a random word).';
const DISCLAIMER_UR = 'یہ ایک اندازہ ہے، ثبوت نہیں۔ شک ہو تو دوسرے طریقے سے تصدیق کریں (واپس کال کریں، سر گھمانے یا کوئی بے ترتیب لفظ کہنے کو کہیں)۔';

const FALLBACK_VERDICT = {
  verdict: 'yellow',
  reason_en: "We couldn't analyze this video right now, so treat it with caution.",
  reason_ur: 'ہم ابھی اس ویڈیو کا جائزہ نہیں لے سکے، اس لیے احتیاط برتیں۔',
  action_en: DISCLAIMER_EN,
  action_ur: DISCLAIMER_UR,
};

const SYSTEM_PROMPT = `You are Loop, helping low-literacy users in Pakistan judge whether a video might be a deepfake or otherwise manipulated.
Look for real tells across the frames: unnatural blinking or no blinking, lip movements not matching speech, flickering or warping at the edges of the face, inconsistent lighting or shadows between frames, unnatural head/neck movement, temporal glitches where the face seems to "swim" or blur.
No one — not this model, not any published detector — can reliably catch a good deepfake video from visual analysis alone. Never claim certainty in either direction.
Treat this as inherently harder to judge than a still image: if you are not clearly confident it looks unremarkable, prefer "yellow" over "green".
Output STRICT JSON only (no markdown, no extra text) with exactly these fields:
{"verdict":"red|yellow|green","reason_en":"...","reason_ur":"...","action_en":"...","action_ur":"..."}
- reason_en/action_en: max 20 simple words each, no jargon.
- reason_ur/action_ur: same meaning in simple Urdu.
- red = visible manipulation tells across frames.
- yellow = can't tell either way, or only a still/short clip with little to judge from.
- green = ordinary video, no visible tells (still not certain).`;

async function getVideoVerdict(base64Data, mimeType) {
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
    console.error('Gemini video check failed:', err.message);
    return FALLBACK_VERDICT;
  }
}

module.exports = { getVideoVerdict };
