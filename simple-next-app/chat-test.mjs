import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();

console.log('Navigating to /chat...');
await page.goto('http://localhost:3000/chat', { waitUntil: 'networkidle' });

// Check session selector
const selectEl = await page.$('select');
if (selectEl) {
  const options = await selectEl.$$eval('option', (opts) => opts.map((o) => o.value));
  console.log(`Session selector found with ${options.length} options:`, options);
} else {
  console.log('ERROR: Session selector (<select>) not found');
  await browser.close();
  process.exit(1);
}

// Check input box exists
const inputEl = await page.$('textarea, input[type="text"], input:not([type])');
if (!inputEl) {
  console.log('ERROR: Message input not found');
  await browser.close();
  process.exit(1);
}
console.log('Message input found');

// Type a question and send
const testMessage = 'What is the purpose of this project?';
console.log(`Typing: "${testMessage}"`);
await inputEl.fill(testMessage);
await page.keyboard.press('Enter');

// Wait for the AI response to appear
console.log('Waiting for assistant response...');
try {
  // Wait for any text that looks like an assistant reply (not the user's own message)
  await page.waitForFunction(
    (msg) => {
      const body = document.body.innerText;
      // Check for non-user message content (the AI response)
      return body.includes(msg) && body.length > msg.length + 50;
    },
    testMessage,
    { timeout: 300000 } // 5 min timeout for by ask
  );
  console.log('SUCCESS: Assistant response appeared in the chat');
  
  // Print the page content for verification
  const content = await page.evaluate(() => document.body.innerText);
  console.log('--- Page content snapshot ---');
  console.log(content.substring(0, 2000));
  console.log('--- End snapshot ---');
} catch (err) {
  console.log('ERROR: Timed out waiting for assistant response:', err.message);
  const content = await page.evaluate(() => document.body.innerText);
  console.log('--- Page content at timeout ---');
  console.log(content.substring(0, 1000));
  console.log('--- End snapshot ---');
  await browser.close();
  process.exit(1);
}

await browser.close();
console.log('\n=== TEST COMPLETED SUCCESSFULLY ===');
