const { chromium } = require("playwright");

(async () => {
  const LOGIN_URL = process.env.GH_LOGIN_URL || "https://greathost.es/login";
  const DASHBOARD_URL = "https://greathost.es/dashboard";
  const CONTRACTS_URL = "https://greathost.es/contracts";
  const CONTRACT_URL = process.env.CONTRACT_URL;
  const EMAIL = process.env.EMAIL;
  const PASSWORD = process.env.PASSWORD;

  if (!CONTRACT_URL || !EMAIL || !PASSWORD) {
    console.error("❌ 缺少必要的环境变量 (CONTRACT_URL / EMAIL / PASSWORD)");
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // === 登录 ===
    console.log("🔑 打开登录页：", LOGIN_URL);
    await page.goto(LOGIN_URL, { waitUntil: "networkidle" });

    await page.fill('input[name="email"]', EMAIL);
    console.log("填写邮箱成功");
    await page.fill('input[name="password"]', PASSWORD);
    console.log("填写密码成功");

    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: "networkidle" }),
    ]);

    // === 跳转 dashboard ===
    console.log("📄 打开首页：", DASHBOARD_URL);
    await page.goto(DASHBOARD_URL, { waitUntil: "networkidle" });

    // === 跳转 contracts ===
    console.log("📄 打开合约列表：", CONTRACTS_URL);
    await page.goto(CONTRACTS_URL, { waitUntil: "networkidle" });

    // === 跳转具体合约续期页 ===
    console.log("📄 打开合约续期页：", CONTRACT_URL);
    await page.goto(CONTRACT_URL, { waitUntil: "networkidle" });

    // === 点击续期按钮 ===
    console.log("⚡ 尝试点击续期按钮...");
    await page.click('button:has-text("续期"), button:has-text("Renew")').catch(() => {
      console.log("⚠️ 没找到续期按钮，可能 UI 有变化");
    });

    // === 等待成功提示 ===
    try {
      await page.waitForSelector(
        '.alert-success, .success, text=续期成功, text=Renewed successfully',
        { timeout: 10000 }
      );
      console.log("🎉 检测到续期成功提示！");
    } catch (e) {
      console.error("⚠️ 未检测到成功提示，可能续期失败");
      await page.screenshot({ path: "renew-fail.png" });
      await browser.close();
      process.exit(3);
    }

    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error("❌ 脚本出错：", err);
    await page.screenshot({ path: "renew-error.png" });
    await browser.close();
    process.exit(2);
  }
})();
