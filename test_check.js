'use strict';

require('./load-env.js');
const assert = require('assert');
const { getVerdict, findLinkNote } = require('./verdict.js');

const scenarios = [
  {
    name: 'OTP / fake helpline scam',
    input: 'Aapka OTP 483920 hai. Kisi ko na dein. Agar aapne register nahi kiya, is number par foran call karein: 0300-1234567',
    notGreen: true,
  },
  {
    name: 'Wrong transfer trick',
    input: 'Assalam o Alaikum, maine ghalti se aapke account mein 15000 transfer kar diye hain, please yeh number par wapas bhej dein: 0333-9876543',
    notGreen: true,
  },
  {
    name: 'Phishing link',
    input: 'Your account will be suspended! Verify now: http://hbl-secure-verify.com/login',
    notGreen: true,
  },
  {
    name: 'Normal safe message',
    input: 'Salam bhai, kal ka match dekha? Kya score tha?',
    expect: 'green',
  },
];

async function main() {
  assert.strictEqual(findLinkNote('no links here'), 'none');
  assert.ok(findLinkNote('go to http://1.2.3.4/login').includes('raw IP'));
  console.log('PASS: findLinkNote heuristics');

  if (!process.env.GROQ_API_KEY) {
    console.log('SKIP: GROQ_API_KEY not set, skipping live LLM verdict checks.');
    return;
  }

  for (const s of scenarios) {
    const result = await getVerdict(s.input, 'message');
    assert.ok(['red', 'yellow', 'green'].includes(result.verdict), `${s.name}: invalid verdict "${result.verdict}"`);
    if (s.expect) {
      assert.strictEqual(result.verdict, s.expect, `${s.name}: expected ${s.expect}, got ${result.verdict}`);
    }
    if (s.notGreen) {
      assert.notStrictEqual(result.verdict, 'green', `${s.name}: should not be green, got green — reason: ${result.reason_en}`);
    }
    console.log(`PASS: ${s.name} -> ${result.verdict} (${result.reason_en})`);
  }

  const screenshot = await getVerdict('anything', 'screenshot');
  assert.strictEqual(screenshot.verdict, 'yellow');
  console.log('PASS: screenshot rule');
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
