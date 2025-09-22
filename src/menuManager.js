const { MenuTemplate, createBackMainMenuButtons } = require('telegraf-inline-menu');
const { TelegramBot } = require('node-telegram-bot-api');

class MenuManager {
    constructor(bot, pool) {
        this.bot = bot;
        this.pool = pool;
        this.menus = new Map();
        this.initCoreMenu();
    }

    // 初始化核心菜单
    initCoreMenu() {
        const mainMenu = new MenuTemplate(ctx => `🤖 欢迎使用机器人！\n当前模式：${ctx.session.mode || '普通'}`);

        // 主菜单选项
        mainMenu.interact('随机图片', 'random-pic', {
            do: async ctx => {
                await this.sendRandomMedia(ctx.chat.id, 'photo');
                return false; // 保持菜单打开
            }
        });

        mainMenu.interact('随机视频', 'random-video', {
            do: async ctx => {
                await this.sendRandomMedia(ctx.chat.id, 'video');
                return false;
            }
        });

        mainMenu.submenu('设置 ⚙️', 'settings', this.settingsMenu());

        // 注册菜单
        this.menus.set('main', mainMenu);
    }

    // 设置子菜单
    settingsMenu() {
        const menu = new MenuTemplate(ctx => '⚙️ 系统设置');

        menu.toggle('通知提醒', 'notifications', {
            set: (ctx, newState) => {
                ctx.session.notifications = newState;
                return true;
            },
            isSet: ctx => ctx.session.notifications ?? true
        });

        menu.select('语言', ['en', 'zh', 'ja'], {
            columns: 3,
            buttonText: (_, key) => key.toUpperCase(),
            set: (ctx, key) => {
                ctx.session.language = key;
                return true;
            },
            current: ctx => ctx.session.language ?? 'zh'
        });

        menu.manualRow(createBackMainMenuButtons());
        return menu;
    }

    // 注册全局命令
    async registerCommands() {
        await this.bot.setMyCommands([
            { command: 'start', description: '启动机器人' },
            { command: 'menu', description: '打开主菜单' },
            { command: 'help', description: '获取帮助' }
        ]);
    }

    // 集成到消息处理
    attachListeners() {
        // 处理菜单命令
        this.bot.onText(/\/menu/, (msg) => this.showMainMenu(msg.chat.id));
        this.bot.onText(/\/start/, (msg) => this.handleStart(msg));

        // 处理回调查询
        this.bot.on('callback_query', async (callbackQuery) => {
            const chatId = callbackQuery.message.chat.id;
            const data = callbackQuery.data;

            try {
                await this.handleMenuSelection(chatId, data);
                this.bot.answerCallbackQuery(callbackQuery.id);
            } catch (error) {
                this.bot.answerCallbackQuery(callbackQuery.id, { text: '⚠️ 操作失败' });
            }
        });
    }

    // 显示菜单
    async showMainMenu(chatId) {
        const menu = this.menus.get('main');
        await this.bot.sendMessage(chatId, '请选择操作：', {
            reply_markup: menu.replyMarkup()
        });
    }

    // 辅助方法
    async sendRandomMedia(chatId, type) {
        const res = await this.pool.query(
            'SELECT file_id FROM media WHERE type = $1 ORDER BY RANDOM() LIMIT 1',
            [type]
        );

        if (res.rows.length > 0) {
            const method = type === 'photo' ? 'sendPhoto' : 'sendVideo';
            this.bot[method](chatId, res.rows[0].file_id);
        }
    }

    handleStart(msg) {
        const welcomeText = `👋 欢迎新人 ${msg.from.first_name}！\n\n`
            + '可用命令:\n'
            + '/menu - 打开主菜单\n'
            + '/sj - 随机发送内容\n'
            + '/help - 查看帮助';

        this.bot.sendMessage(msg.chat.id, welcomeText, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🎲 随机图片', callback_data: 'random-pic' }],
                    [{ text: '⚙️ 设置', callback_data: 'settings' }]
                ]
            }
        });
    }
}

module.exports = MenuManager;