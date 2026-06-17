import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:3000/chat', { waitUntil: 'networkidle' });
await page.waitForSelector('textarea', { timeout: 10000 });

const bounds = await page.evaluate(() => {
  const textarea = document.querySelector('textarea');
  // Find the send button — it has an SVG or title="Send"
  const buttons = document.querySelectorAll('button');
  let sendBtn = null;
  for (const btn of buttons) {
    if (btn.querySelector('svg')) { sendBtn = btn; break; }
  }
  if (!textarea || !sendBtn) return { error: 'Could not find textarea or send button' };

  const tr = textarea.getBoundingClientRect();
  const br = sendBtn.getBoundingClientRect();
  const taCenterY = tr.top + tr.height / 2;
  const btnCenterY = br.top + br.height / 2;

  // Also get container info
  const container = textarea.closest('.flex');
  const containerRect = container ? container.getBoundingClientRect() : null;

  return {
    textarea: { top: tr.top, bottom: tr.bottom, height: tr.height, centerY: taCenterY },
    button: { top: br.top, bottom: br.bottom, height: br.height, centerY: btnCenterY },
    containerCenterY: containerRect ? (containerRect.top + containerRect.height / 2) : null,
    diff: Math.abs(taCenterY - btnCenterY),
    containerClasses: container ? container.className : null,
    textareaLineHeight: getComputedStyle(textarea).lineHeight,
    buttonPaddingTop: getComputedStyle(sendBtn).paddingTop,
    buttonPaddingBottom: getComputedStyle(sendBtn).paddingBottom,
    textareaPaddingTop: getComputedStyle(textarea).paddingTop,
    textareaPaddingBottom: getComputedStyle(textarea).paddingBottom,
    textareaBorderTop: getComputedStyle(textarea).borderTopWidth,
    textareaBorderBottom: getComputedStyle(textarea).borderBottomWidth,
  };
});

console.log(JSON.stringify(bounds, null, 2));

if (bounds.error) {
  console.log('FAIL: ' + bounds.error);
  await browser.close();
  process.exit(1);
}

if (bounds.diff < 3) {
  console.log('PASS: Send button and textarea are vertically aligned (diff = ' + bounds.diff.toFixed(1) + 'px)');
} else {
  console.log('FAIL: Send button and textarea are NOT aligned (diff = ' + bounds.diff.toFixed(1) + 'px)');
  console.log('Button is ' + (bounds.button.centerY > bounds.textarea.centerY ? 'lower' : 'higher') + ' than textarea by ' + bounds.diff.toFixed(1) + 'px');
}

// Take screenshot for reference
await page.screenshot({ path: '/tmp/chat-alignment-check.png' });
console.log('Screenshot: /tmp/chat-alignment-check.png');

await browser.close();
