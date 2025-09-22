// require('dotenv').config();
// const TelegramBot = require('node-telegram-bot-api');
// const {HttpsProxyAgent} = require('https-proxy-agent');
// const {pool, initializeDB} = require('./src/database');
// const MediaGroupHandler = require('./src/mediaGroupHandler');
// const VideoHandler = require("./src/videoHandler");
// const RandomMediaSender = require('./src/randomSender');
// const MenuManager = require('./src/menu');
//
// // 初始化机器人
// const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, {
//     polling: {
//         interval: 300,
//         autoStart: true,
//         params: {timeout: 60}
//     },
//     // request: {
//     //     agent: new HttpsProxyAgent({
//     //         host: process.env.PROXY_HOST,
//     //         port: process.env.PROXY_PORT,
//     //     })
//     // }
// });
//
// // 初始化处理器
// const mediaHandler = new MediaGroupHandler(bot, pool);
// const videoHandler = new VideoHandler(bot, pool);
//
// // 在初始化部分添加
// const randomSender = new RandomMediaSender(bot);
//
//
// async function start() {
//     await initializeDB();
//
//     // 初始化菜单功能
//     new MenuManager(bot);
//
//     bot.on('message', msg => {
//         mediaHandler.handleMessage(msg);
//         videoHandler.handleMessage(msg);
//     });
//
//     // 新增随机命令
//     bot.onText(/\/sj/, (msg) => {
//         randomSender.handleCommand(msg);
//     });
//
// // 辅助函数示例
//     function isAdmin(userId) {
//         const admins = process.env.ADMIN_IDS?.split(',') || [];
//         return admins.includes(String(userId));
//     }
//
//     console.log('🤖 机器人启动成功');
// }
//
//
// process.on('SIGINT', async () => {
//     console.log('\n🚨 正在关闭服务...');
//     try {
//         await pool.end();
//         await bot.stopPolling();
//         console.log('✅ 资源释放完成');
//     } catch (err) {
//         console.error('❌ 关闭异常:', err);
//     } finally {
//         process.exit();
//     }
// });
//
// start()