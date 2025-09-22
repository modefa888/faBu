class MenuManager {
    constructor(bot) {
        this.bot = bot;
        this.setMenuCommands();
        this.setHandlers();
    }

    // 配置全局命令提示
    setMenuCommands() {
        const commands = [
            { command: '/start', description: '🚀 初始化机器人' },
            { command: '/help', description: '📖 查看帮助文档' },
            { command: '/menu', description: '🔍 打开功能菜单' },
            { command: '/sj', description: '🎲 视频' }
        ];
        this.bot.setMyCommands(commands);
    }

    // 生成带按钮的菜单
    generateMainMenu() {
        return {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '帮助文档 📖', callback_data: 'help' }],
                    [{ text: '源码仓库 🌐', url: 'https://github.com/bizhangjie' }]
                ]
            }
        };
    }

    // 事件监听配置
    setHandlers() {
        // /start 命令
        this.bot.onText(/\/start/, (msg) => {
            const chatId = msg.chat.id;
            const welcomeText = `
✨ 欢迎使用媒体管理机器人！
主要功能：
- 自动保存您发送的图片/视频
- 通过菜单快速操作
      `;
            this.bot.sendMessage(chatId, welcomeText, this.generateMainMenu());
        });

        // /help 命令
        this.bot.onText(/\/help/, (msg) => {
            const chatId = msg.chat.id;
            const helpText = `
📚 帮助指南
1. 发送图片或视频即可自动保存
2. 使用 /menu 查看功能菜单
3. 需要支持请联系管理员
      `;
            this.bot.sendMessage(chatId, helpText);
        });

        // /menu 命令
        this.bot.onText(/\/menu/, (msg) => {
            const chatId = msg.chat.id;
            this.bot.sendMessage(chatId, '请选择操作：', this.generateMainMenu());
        });

        // 按钮回调处理
        this.bot.on('callback_query', (query) => {
            const chatId = query.message.chat.id;
            switch (query.data) {
                case 'help':
                    this.bot.sendMessage(chatId, '📧 技术支持邮箱：support@example.com');
                    break;
                default:
                    this.bot.answerCallbackQuery(query.id, { text: '功能未实现' });
            }
            this.bot.answerCallbackQuery(query.id);
        });
    }
}

module.exports = MenuManager;