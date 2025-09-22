const { pool } = require('./database');

class RandomMediaSender {
    constructor(bot) {
        if (!process.env.BOT_NAME) {
            throw new Error('BOT_NAME must be defined in environment variables');
        }

        this.bot = bot;
        this.botName = process.env.BOT_NAME;
        this.MAX_RETRIES = 3;
        this.CAPTION_MAX_LENGTH = 1024;
        this.SINGLE_VIDEO_WEIGHT = 0.5;
    }

    async handleCommand(msg) {
        console.log(`[${this.botName}] 随机请求 用户:${msg.from.id}`);
        try {
            const mediaData = await this._fetchRandomMedia();
            if (!mediaData) {
                return this._safeSend(msg.chat.id, "❌ 当前没有可用的媒体内容");
            }

            if (mediaData.type === 'media_group') {
                await this._sendMediaGroup(msg.chat.id, mediaData);
            } else {
                await this._sendSingleVideo(msg.chat.id, mediaData);
            }

            console.log(`[${this.botName}] 发送成功`, this._formatLog(mediaData));
        } catch (err) {
            console.error(`[${this.botName}] 发送失败:`, err.stack);
            this._safeSend(msg.chat.id, "⚠️ 发送失败，请稍后重试");
        }
    }

    async _fetchRandomMedia() {
        const conn = await pool.getConnection();
        try {
            // 优先尝试单视频（50%概率）
            let result = Math.random() < this.SINGLE_VIDEO_WEIGHT
                ? await this._fetchSingleVideo(conn)
                : await this._fetchMediaGroup(conn);

            // 回退逻辑：如果首选项没有数据则尝试另一种类型
            if (!result) {
                result = await (result ? this._fetchMediaGroup(conn) : this._fetchSingleVideo(conn));
            }

            return result;
        } finally {
            conn.release();
        }
    }

    async _fetchSingleVideo(conn) {
        const [videos] = await conn.query(`
            SELECT 
                id, 
                file_id,
                COALESCE(caption, '') AS caption
            FROM single_videos 
            WHERE bot_name = ?
            ORDER BY RAND()
            LIMIT 1
        `, [this.botName]);

        return videos[0] ? {
            type: 'single_video',
            id: String(videos[0].id),  // ✅ 强制转换为字符串
            file_id: videos[0].file_id,
            caption: this._sanitizeCaption(videos[0].caption)
        } : null;
    }

    async _fetchMediaGroup(conn) {
        // 随机选择一个媒体组
        const [groups] = await conn.query(`
            SELECT media_group_id 
            FROM media_groups 
            WHERE bot_name = ?
            ORDER BY RAND()
            LIMIT 1
        `, [this.botName]);

        if (!groups[0]) return null;

        // 获取组内所有媒体项
        const [items] = await conn.query(`
            SELECT 
                type, 
                file_id, 
                caption
            FROM media_items 
            WHERE 
                media_group_id = ?
                AND bot_name = ?
            ORDER BY id ASC
        `, [groups[0].media_group_id, this.botName]);

        return items.length > 0 ? {
            type: 'media_group',
            id: String(groups[0].media_group_id),  // ✅ 确保字符串类型
            items: items.map(item => ({
                type: item.type,
                file_id: item.file_id,
                caption: this._sanitizeCaption(item.caption)
            })),
            mainCaption: this._sanitizeCaption(items[0]?.caption)
        } : null;
    }

    async _sendMediaGroup(chatId, data) {
        try {
            const mediaGroup = data.items.map((item, index) => ({
                type: item.type,
                media: item.file_id,
                caption: index === 0 ? data.mainCaption : undefined,
                parse_mode: 'HTML'
            }));

            await this.bot.sendMediaGroup(chatId, mediaGroup);
        } catch (err) {
            console.error(`[${this.botName}] 媒体组发送失败:`, err.response?.body);
            throw new Error('MEDIA_GROUP_SEND_FAILED');
        }
    }

    async _sendSingleVideo(chatId, data) {
        for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
            try {
                await this.bot.sendVideo(chatId, data.file_id, {
                    caption: data.caption,
                    parse_mode: 'HTML'
                });
                return;
            } catch (err) {
                if (attempt === this.MAX_RETRIES) throw err;
                await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
            }
        }
    }

    async _safeSend(chatId, text) {
        try {
            await this.bot.sendMessage(chatId, text);
        } catch (err) {
            console.error(`[${this.botName}] 反馈消息发送失败:`, err.message);
        }
    }

    _formatLog(data) {
        try {
            // 防御性编程：处理 undefined/null 和数字类型
            const id = data?.id ? String(data.id) : 'unknown_id';
            const type = data?.type?.toUpperCase() || 'UNKNOWN_TYPE';
            return `${type} [ID:${id.slice(-6)}]`;
        } catch (err) {
            return `日志格式化失败: ${err.message}`;
        }
    }

    _sanitizeCaption(raw) {
        return String(raw || '')
            .substring(0, this.CAPTION_MAX_LENGTH)
            .replace(/[<>&]/g, char =>
                ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[char]));
    }
}

module.exports = RandomMediaSender;