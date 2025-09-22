require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { pool, initializeDB } = require('./src/database');

// ===================== 全局初始化 =====================
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, {
    webHook: {
        port: process.env.PORT || 3000,
        autoOpen: false // ✅ 禁用自动启动 webhook
    },
    request: {
        agentOptions: {
            keepAlive: true // ✅ 保持长连接提升性能
        }
    }
});

// ===================== Serverless 入口 =====================
module.exports = async (req, res) => {
    try {
        await initializeApp(); // ✅ 确保冷启动初始化

        // Webhook 设置端点
        if (req.method === 'GET' && req.url === '/setWebhook') {
            return await handleWebhookSetup(res);
        }

        // Telegram 消息处理
        if (req.method === 'GET' && req.url === '/api/bot') {
            return await handleTelegramUpdate(req, res);
        }

        // 健康检查端点
        if (req.method === 'GET' && req.url === '/health') {
            return res.json({ status: 'ok', ts: Date.now() , env: process.env });
        }

        res.status(404).send('Not Found');
    } catch (err) {
        console.error('[FATAL]', err);
        res.status(500).json({ error: 'Server Error' });
    }
};

// ===================== 核心逻辑 =====================
let isInitialized = false;

async function initializeApp() {
    if (!isInitialized) {
        // ✅ 数据库初始化
        await initializeDB();

        // ✅ 预热数据库连接
        await pool.query('SELECT 1');

        console.log('⚡ App initialized');
        isInitialized = true;
    }
}

async function handleWebhookSetup(res) {
    try {
        const webhookUrl = `${process.env.VERCEL_URL}/api/bot`;
        await bot.setWebHook(webhookUrl, {
            max_connections: 50,
            allowed_updates: ['message', 'callback_query']
        });
        res.send(`✅ Webhook configured: ${webhookUrl}`);
    } catch (err) {
        console.error('Webhook setup failed:', err);
        res.status(500).send('Webhook setup failed');
    }
}

async function handleTelegramUpdate(req, res) {
    const update = req.body;
    try {
        // ✅ 异步处理避免超时
        processUpdate(update);
        res.status(200).end();
    } catch (err) {
        console.error('Update process error:', err);
        res.status(500).end();
    }
}

// ===================== 业务逻辑 =====================
async function processUpdate(update) {
    const { MediaGroupHandler } = require('./src/mediaGroupHandler');
    const { VideoHandler } = require('./src/videoHandler');
    const { RandomMediaSender } = require('./src/randomSender');
    const { MenuManager } = require('./src/menu');

    try {
        // ✅ 独立实例保证无状态
        const mediaHandler = new MediaGroupHandler(bot, pool);
        const videoHandler = new VideoHandler(bot, pool);
        const randomSender = new RandomMediaSender(bot);
        new MenuManager(bot);

        if (update.message) {
            const msg = update.message;

            await mediaHandler.handleMessage(msg);
            await videoHandler.handleMessage(msg);

            if (msg.text === '/sj') {
                await randomSender.handleCommand(msg);
            }
        }
    } finally {
        // ✅ 确保释放处理器资源
        // await pool.release();
    }
}

// ===================== 资源管理 =====================
process.on('SIGTERM', async () => {
    console.log('🚨 接收到终止信号，清理资源...');
    await bot.closeWebHook().catch(console.error);
    process.exit(0);
});