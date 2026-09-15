'use strict';

const GROQ_MODEL = 'openai/gpt-oss-20b';

const SCREENSHOT_VERDICT = {
  verdict: 'yellow',
  reason_en: 'Screenshots can be faked in seconds. They prove nothing.',
  reason_ur: 'اسکرین شاٹ سیکنڈوں میں جعلی بنایا جا سکتا ہے۔ یہ کچھ ثابت نہیں کرتا۔',
  action_en: 'Open your own banking app and check your real balance.',
  action_ur: 'اپنی بینکنگ ایپ خود کھولیں اور اصل بیلنس چیک کریں۔',
};

const FALLBACK_VERDICT = {
  verdict: 'yellow',
  reason_en: "We couldn't check this right now, so treat it with caution.",
  reason_ur: 'ہم ابھی اسے چیک نہیں کر سکے، اس لیے احتیاط برتیں۔',
  action_en: 'Do not click links or share codes until you verify another way.',
  action_ur: 'دوسرے ذریعے سے تصدیق کیے بغیر لنکس پر کلک نہ کریں یا کوڈ شیئر نہ کریں۔',
};

function findLinkNote(text) {
  const urlMatch = text.match(/https?:\/\/[^\s]+|www\.[^\s]+/i);
  if (!urlMatch) return 'none';
  const url = urlMatch[0];
  const notes = [];
  if (!/^https:\/\//i.test(url)) notes.push('not using https');
  if (/^https?:\/\/\d{1,3}(\.\d{1,3}){3}/i.test(url)) notes.push('raw IP address instead of a domain name');
  if (/(secure|verify|update|login|account)[.-]/i.test(url) || /-(secure|verify|update|login)/i.test(url)) {
    notes.push('domain uses trust words like "secure/verify/login" which scammers add to look official');
  }
  if (/bit\.ly|tinyurl|t\.co|goo\.gl/i.test(url)) notes.push('shortened link hides the real destination');
  return notes.length ? `Link "${url}" is suspicious: ${notes.join('; ')}.` : `Link "${url}" found, no obvious red flags in the URL itself.`;
}

const SYSTEM_PROMPT = `You are Loop, a scam-detection assistant protecting low-literacy users in Pakistan from digital fraud (fake OTP messages, phishing links, fake helpline calls, "wrong transfer" tricks, prize/BISP lures, cloned-voice emergencies).
Given a message and a note about any link in it, output STRICT JSON only (no markdown, no extra text) with exactly these fields:
{"verdict":"red|yellow|green","reason_en":"...","reason_ur":"...","action_en":"...","action_ur":"..."}
Rules:
- reason_en and action_en: max 15 simple words each, no jargon.
- reason_ur and action_ur: same meaning in simple Urdu.
- red = clear fraud indicators (urgency combined with a request for money, OTP, or personal info; fake helpline; threats).
- yellow = suspicious but not certain (unfamiliar sender, unusual request, suspicious link pattern).
- green = ordinary message, no fraud indicators.
- Never output green if urgency and a money/OTP/personal-info request appear together.
- IMPORTANT fake-helpline pattern: a message that states an OTP/code and then asks the recipient to call a phone number "to verify" is ALWAYS red, even if it also says "don't share this code with anyone." Real banks never send an OTP and then ask you to call a number about it — that callback request is itself the scam, regardless of how trustworthy the wording sounds.

Example:
Message: "Aapka OTP 991122 hai. Kisi ko na dein. Bank se hain, tasdeeq ke liye call karein: 0300-1234567"
Link note: none
Output: {"verdict":"red","reason_en":"Real banks never ask you to call about an OTP they sent.","reason_ur":"اصلی بینک کبھی OTP کے بارے میں کال کرنے کو نہیں کہتا۔","action_en":"Do not call that number. Contact your bank using the number on your card.","action_ur":"اس نمبر پر کال نہ کریں۔ اپنے کارڈ پر موجود نمبر سے بینک سے رابطہ کریں۔"}`;

async function getVerdict(input, kind) {
  if (kind === 'screenshot') return SCREENSHOT_VERDICT;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return FALLBACK_VERDICT;

  const linkNote = findLinkNote(input);
  const userMsg = `Message: ${input}\n\nLink note: ${linkNote}`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMsg },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    });
    if (!res.ok) throw new Error(`Groq API ${res.status}`);
    const data = await res.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    if (!['red', 'yellow', 'green'].includes(parsed.verdict)) throw new Error('bad verdict field');
    return parsed;
  } catch (err) {
    console.error('Groq check failed:', err.message);
    return FALLBACK_VERDICT;
  }
}

module.exports = { getVerdict, findLinkNote, SCREENSHOT_VERDICT, FALLBACK_VERDICT };
