import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
console.log('Navigating to http://localhost:3000/chat...');
await page.goto('http://localhost:3000/chat', { waitUntil: 'networkidle', timeout: 30000 });
console.log('Page loaded; waiting for textarea...');
await page.waitForSelector('textarea', { timeout: 30000 });

const bounds = await page.evaluate(() => {
  const textarea = document.querySelector('textarea');
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

  const container = textarea.closest('.flex');
  const containerRect = container ? container.getBoundingClientRect() : null;

  return {
    textarea: { top: tr.top, bottom: tr.bottom, height: tr.height, centerY: taCenterY },
    button: { top: br.top, bottom: br.bottom, height: br.height, centerY: btnCenterY },
    containerCenterY: containerRect ? (containerRect.top + containerRect.height / 2) : null,
    diff: Math.abs(taCenterY - btnCenterY),
    containerClasses: container ? container.className : null,
    textareaVerticalAlign: getComputedStyle(textarea).verticalAlign,
  };
});

console.log(JSON.stringify(bounds, null, 2));

if (bounds.error) {
  console.log('FAIL: ' + bounds.error);
  await browser.close();
  process.exit(1);
}

if (bounds.diff < 3) {
  console.log('PASS: Send button and textarea are aligned (diff = ' + bounds.diff.toFixed(1) + 'px)');
} else {
  console.log('FAIL: Send button and textarea are NOT aligned (diff = ' + bounds.diff.toFixed(1) + 'px)');
  console.log('Button is ' + (bounds.button.centerY > bounds.textarea.centerY ? 'lower' : 'higher') + ' than textarea by ' + bounds.diff.toFixed(1) + 'px');
}

await page.screenshot({ path: '/tmp/chat-alignment-fixed.png' });
console.log('Screenshot: /tmp/chat-alignment-fixed.png');
await browser.close();
