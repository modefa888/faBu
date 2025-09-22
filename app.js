require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { pool, initializeDB } = require('./src/database');

// ✅ 改为 Webhook 模式（Vercel 无服务器函数不支持长轮询）
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, {
    webHook: {
        port: process.env.PORT || 3000,
    }
});

// ✅ 添加 Vercel 的 serverless 请求处理函数
module.exports = async (req, res) => {
    try {
        // ✅ 动态设置 Webhook 地址（部署后生成）
        if (req.url === '/setWebhook') {
            const webhookUrl = `${process.env.VERCEL_URL}/api/bot`;
            await bot.setWebHook(webhookUrl);
            return res.send('Webhook set successfully');
        }

        // ✅ 处理 Telegram 的 POST 请求
        if (req.method === 'POST') {
            const update = req.body;
            await handleUpdate(update);
            res.status(200).end();
        }
    } catch (err) {
        console.error('Serverless Error:', err);
        res.status(500).send('Internal Server Error');
    }
};

// ✅ 初始化逻辑（Vercel 冷启动时执行）
let isInitialized = false;

async function initialize() {
    if (!isInitialized) {
        await initializeDB();
        console.log('🤖 机器人初始化完成');
        isInitialized = true;
    }
}

// ✅ 消息处理逻辑拆分
async function handleUpdate(update) {
    await initialize();

    // 原有消息处理逻辑保持不变...
    const MediaGroupHandler = require('./src/mediaGroupHandler');
    const VideoHandler = require("./src/videoHandler");
    const RandomMediaSender = require('./src/randomSender');
    const MenuManager = require('./src/menu');

    // ✅ 实例化需要每次请求创建的处理器
    new MenuManager(bot);

    const mediaHandler = new MediaGroupHandler(bot, pool);
    const videoHandler = new VideoHandler(bot, pool);
    const randomSender = new RandomMediaSender(bot);

    // ✅ 消息处理逻辑
    if (update.message) {
        const msg = update.message;

        mediaHandler.handleMessage(msg);
        videoHandler.handleMessage(msg);

        if (msg.text === '/sj') {
            randomSender.handleCommand(msg);
        }
    }
}

// ✅ 添加数据库连接释放（针对 Vercel 无服务器环境）
process.on('beforeExit', async () => {
    console.log('Releasing database connections');
    await pool.end();
});