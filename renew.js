// renew.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const axios = require('axios');

// === Telegram 通知函数 ===
async function sendTelegram(msg) {
  const token = process.env.TG_BOT_TOKEN;
  const chatId = process.env.TG_CHAT_ID;
  if (!token || !chatId) {
    console.log('未设置 TG_BOT_TOKEN 或 TG_CHAT_ID，跳过通知');
    return;
  }
  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: msg,
      parse_mode: 'HTML'
    });
    console.log('✅ Telegram 通知已发送');
  } catch (err) {
    console.error('❌ 发送 Telegram 通知失败:', err.message);
  }
}

(async () => {
  const LOGIN_URL = process.env.LOGIN_URL || 'https://greathost.es/login';
  const CONTRACT_URL = process.env.CONTRACT_URL; // 必填
  const EMAIL = process.env.EMAIL;
  const PASSWORD = process.env.PASSWORD;
  const HEADLESS = process.env.HEADLESS !== 'false'; // 默认 true

  if (!CONTRACT_URL || !EMAIL || !PASSWORD) {
    console.error('ERROR: 请设置环境变量 CONTRACT_URL, EMAIL, PASSWORD');
    process.exit(2);
  }

  const outDir = path.resolve(process.cwd(), 'out');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('🔑 打开登录页：', LOGIN_URL);
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle', timeout: 60000 });

    // 填写邮箱
    const emailSelectors = [
      'input[name="email"]',
      'input[type="email"]',
      'input[name="username"]',
      '#email',
      'input[id*=email]'
    ];
    for (const s of emailSelectors) {
      if (await page.$(s)) {
        await page.fill(s, EMAIL);
        console.log('填写邮箱成功:', s);
        break;
      }
    }

    // 填写密码
    const passSelectors = [
      'input[name="password"]',
      'input[type="password"]',
      '#password',
      'input[id*=password]'
    ];
    for (const s of passSelectors) {
      if (await page.$(s)) {
        await page.fill(s, PASSWORD);
        console.log('填写密码成功:', s);
        break;
      }
    }

    // 点击登录按钮
    const loginButtonTexts = [
      'text="Log in"',
      'text="Login"',
      'text="Sign in"',
      'text="登录"',
      'button:has-text("Login")'
    ];
    for (const sel of loginButtonTexts) {
      const btn = page.locator(sel);
      if (await btn.count() > 0) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }).catch(() => {}),
          btn.first().click().catch(() => {})
        ]);
        console.log('点击登录按钮:', sel);
        break;
      }
    }

    await page.waitForTimeout(3000);

    // 打开合约页
    console.log('📄 打开合约页：', CONTRACT_URL);
    await page.goto(CONTRACT_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);

    // 尝试点击续期按钮
    const renewSelectors = [
      'text=Renew',
      'text=renew',
      'text=续期',
      'text=延长',
      'text=Extend',
      'text=Wait',
      'button:has-text("Renew")',
      '.btn-renew',
      '[aria-label*="renew"]'
    ];

    let success = false;
    for (const sel of renewSelectors) {
      const loc = page.locator(sel);
      if (await loc.count() > 0) {
        console.log('找到续期按钮:', sel);
        await Promise.all([
          page.waitForResponse(r => r.status() >= 200 && r.status() < 500, { timeout: 15000 }).catch(() => {}),
          loc.first().click({ timeout: 10000 }).catch(() => {})
        ]);
        await page.waitForTimeout(3000);

        if ((await loc.count()) === 0) {
          success = true;
          break;
        }
        const body = await page.content();
        if (/success|已续|续费|续订/i.test(body)) {
          success = true;
          break;
        }
      }
    }

    if (success) {
      console.log('✅ 自动续期成功');
      await sendTelegram(`✅ GreatHost 自动续期成功\n合约: ${CONTRACT_URL}`);
    } else {
      console.warn('⚠️ 未检测到成功信号，可能续期失败');
      const shot = path.join(outDir, `fail-${Date.now()}.png`);
      await page.screenshot({ path: shot, fullPage: true });
      await sendTelegram(`❌ GreatHost 自动续期失败，请检查日志。\n合约: ${CONTRACT_URL}`);
      process.exit(3);
    }

    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ 运行出错：', err);
    const shot = path.join(outDir, `error-${Date.now()}.png`);
    try {
      await page.screenshot({ path: shot, fullPage: true });
    } catch (e) {}
    await sendTelegram(`❌ GreatHost 自动续期脚本运行错误: ${err.message}`);
    await browser.close();
    process.exit(4);
  }
})();
