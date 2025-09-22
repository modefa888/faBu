const escapeHtml = require('escape-html');
const GroupManager = require('./GroupManager');

class MediaGroupHandler {
    constructor(bot, pool) {
        if (!process.env.BOT_NAME) {
            throw new Error('BOT_NAME must be defined in environment variables');
        }

        this.bot = bot;
        this.pool = pool;
        this.botName = process.env.BOT_NAME;
        this.mediaGroupCache = new Map();
        this.MAX_WAIT_TIME = 3500; // 媒体组收集等待时间（毫秒）
    }

    // 主消息处理入口
    async handleMessage(msg) {
        try {
            if (!msg?.media_group_id) return;

            const mgId = msg.media_group_id; // ✅ 定义媒体组 ID
            const timestampSeconds = msg.date; // 原始秒级时间戳

            // 初始化缓存条目
            if (!this.mediaGroupCache.has(mgId)) {
                this._initCacheEntry(msg, mgId);
            }

            // 获取缓存并解析媒体数据
            const entry = this.mediaGroupCache.get(mgId);
            const mediaData = this._parseMedia(msg);

            if (mediaData) {
                this._updateCache(entry, mediaData, timestampSeconds, mgId, msg); // ✅ 传递 mgId
            }
        } catch (err) {
            console.error(`[${this.botName}] 处理失败`, this._formatMessageInfo(msg), err);
        }
    }

    // 初始化缓存条目
    _initCacheEntry(msg, mgId) {
        const { chat, from } = msg;
        const userInfo = {
            id: from.id,
            username: from.username || '无用户名',
            name: [from.first_name, from.last_name].filter(Boolean).join(' ')
        };

        this.mediaGroupCache.set(mgId, {
            meta: {
                chatId: chat.id,
                chatType: chat.type,
                user: userInfo,
                startTime: Date.now()
            },
            items: [],
            timer: this._createSaveTimer(mgId) // ✅ 正确初始化计时器
        });
    }

    // 解析媒体消息
    _parseMedia(msg) {
        const types = ['photo', 'video', 'document', 'audio'];
        const type = types.find(t => msg[t]);

        return type ? {
            type,
            fileId: type === 'photo' ? msg.photo[0].file_id : msg[type].file_id,
            caption: msg.caption ? escapeHtml(msg.caption) : null
        } : null;
    }

    // 更新缓存条目（新增 mgId 参数）
    _updateCache(entry, mediaData, timestampSeconds, mgId, msg) { // ✅ 接收 mgId
        entry.items.push({
            ...mediaData,
            timestamp: timestampSeconds
        });

        // 重置计时器时使用正确的 mgId
        clearTimeout(entry.timer);
        entry.timer = this._createSaveTimer(mgId, msg); // ✅ 使用传入的 mgId
    }

    // 创建计时器（保持参数明确）
    _createSaveTimer(mgId, msg) {
        return setTimeout(() => this._persistMediaGroup(mgId, msg), this.MAX_WAIT_TIME);
    }

    // 持久化媒体组到数据库
    async _persistMediaGroup(mgId, msg) {
        const entry = this.mediaGroupCache.get(mgId);
        if (!entry) return;

        const { meta, items } = entry;
        const conn = await this.pool.getConnection();

        try {
            await conn.beginTransaction();

            // 1. 保存媒体组元数据
            await conn.query(
                `INSERT INTO media_groups (
          media_group_id, bot_name, chat_id,
          chat_type, user_id, username,
          first_name, last_name, message_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          message_count = VALUES(message_count)`,
                [
                    mgId,
                    this.botName,
                    meta.chatId,
                    meta.chatType,
                    meta.user.id,
                    meta.user.username,
                    meta.user.name.split(' ')[0],
                    meta.user.name.split(' ')[1] || null,
                    items.length
                ]
            );

            // 2. 批量插入媒体项（使用正确的时间戳格式）
            await Promise.all(
                items.map(item =>
                    conn.query(
                        `INSERT INTO media_items (
              media_group_id, bot_name, type,
              file_id, caption, timestamp
            ) VALUES (?, ?, ?, ?, ?, FROM_UNIXTIME(?))`,
                        [
                            mgId,
                            this.botName,
                            item.type,
                            item.fileId,
                            item.caption,
                            item.timestamp // 直接传递秒级时间戳
                        ]
                    )
                )
            );

            await conn.commit();
            console.log(`[${this.botName}] 保存完成 [组ID:${mgId.slice(-6)}] 数量:${items.length}`);

            // 3. 发送用户反馈
            await this.bot.sendMessage(
                meta.chatId,
                `✅ 已保存 ${items.length} 个文件\n` +
                `└ 组ID: <code>${mgId.slice(-6)}</code>`,
                {
                    parse_mode: 'HTML',
                    reply_to_message_id: msg.message_id
                }
            );

            // 4. 转发到目标群组（可选）
            const forwardResult = await GroupManager.forwardMedia(
                this.bot,
                {
                    items: items,
                    mgId: mgId
                }, // 发送的媒体组数据
                'media_group'
            );

            // 生成用户反馈信息
            const report = this._generateForwardReport(forwardResult, mgId);

            // 发送转发结果给用户
            await this.bot.sendMessage(
                meta.chatId,
                report,
                {
                    parse_mode: 'HTML',
                    reply_to_message_id: msg.message_id
                }
            );

            console.log(`[${this.botName}] 媒体组转发结果`, forwardResult);

        } catch (err) {
            await conn.rollback();
            console.error(`[${this.botName}] 保存失败`, err.stack);
            await this.bot.sendMessage(
                meta.chatId,
                `❌ 保存失败: ${err.code || 'DB_ERROR'}`
            );
        } finally {
            conn.release();
            this.mediaGroupCache.delete(mgId); // 清理缓存
        }
    }

    // 生成转发报告 (新增方法)
    _generateForwardReport(result, mgId) {
        const formatId = (id) => `<code>${String(id).slice(-6)}</code>`; // 确保转为字符串

        let successPart = '';
        if (result.successGroups.length > 0) {
            successPart = `✅ 已成功转发至 ${result.success} 个群组\n` +
                `${result.successGroups.map(id => `└ 群组 ID: ${id}`).join('\n')}`;
        }

        let failedPart = '';
        if (result.failed.length > 0) {
            failedPart = `\n❌ 失败群组：${formatId}`;
        }

        return `📮 转发完成 [组ID: ${formatId(mgId)}]\n\n` +
            successPart +
            failedPart;
    }

    // 辅助方法：日志格式化
    _formatMessageInfo(msg) {
        return `聊天:${msg.chat.id} 用户:${msg.from.id}`;
    }
}

module.exports = MediaGroupHandler;