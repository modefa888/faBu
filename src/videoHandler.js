const { format } = require('util');
const GroupManager = require('./GroupManager');

class VideoHandler {
    constructor(bot, pool) {
        if (!process.env.BOT_NAME) {
            throw new Error('BOT_NAME environment variable is required');
        }

        this.bot = bot;
        this.pool = pool;
        this.botName = process.env.BOT_NAME;
    }

    async handleMessage(msg) {
        try {
            // 过滤非视频消息和媒体组消息
            if (!msg?.video || msg.media_group_id) return;

            const videoData = this._parseVideo(msg);
            if (!videoData) return;

            const conn = await this.pool.getConnection();

            try {
                await conn.beginTransaction();

                // 检查并删除旧记录
                const [existing] = await conn.query(
                    `SELECT id FROM single_videos 
           WHERE file_id = ? AND bot_name = ? 
           LIMIT 1 FOR UPDATE`,
                    [videoData.fileId, this.botName]
                );

                if (existing.length > 0) {
                    await conn.query(
                        `DELETE FROM single_videos 
             WHERE file_id = ? AND bot_name = ?`,
                        [videoData.fileId, this.botName]
                    );
                    console.log(`[${this.botName}] 清理旧记录: ${videoData.fileId.slice(-8)}`);
                }

                // 插入新记录（使用正确的时间戳格式）
                await conn.query(
                    `INSERT INTO single_videos (
            file_id, bot_name, chat_id, 
            user_id, caption, duration,
            mime_type, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, FROM_UNIXTIME(?))`,  // ✅ 关键修改点
                    [
                        videoData.fileId,
                        this.botName,
                        msg.chat.id,
                        msg.from.id,
                        videoData.caption,
                        videoData.duration,
                        videoData.mimeType,
                        msg.date  // 直接使用原始时间戳（秒级）
                    ]
                );

                await conn.commit();
                console.log(`[${this.botName}] 视频保存成功`, this._formatLog(msg, videoData));

                // 用户反馈与媒体处理
                await this._sendUserFeedback(msg, videoData);

                // 替换原有转发群组代码
                const forwardResult = await GroupManager.forwardMedia(
                    this.bot,
                    {
                        msg: msg,
                        videoData: videoData
                    },
                    'video'
                );

                // 生成用户反馈信息
                const report = this._generateForwardReport(forwardResult);

                // 发送转发结果给用户
                await this.bot.sendMessage(
                    msg.chat.id,
                    report,
                    {
                        parse_mode: 'HTML',
                        reply_to_message_id: msg.message_id
                    }
                );

                console.log(`[${this.botName}] 媒体组转发结果`, forwardResult);

            } catch (err) {
                await conn.rollback();
                this._handleError(msg, err);
            } finally {
                conn.release();
            }
        } catch (err) {
            console.error(`[${this.botName}] 处理流程异常:`, err.message);
        }
    }

    // 解析视频数据
    _parseVideo(msg) {
        try {
            return {
                fileId: msg.video.file_id,
                caption: msg.caption || null,
                duration: msg.video.duration,
                mimeType: msg.video.mime_type
                // 不再需要处理 timestamp，直接传 msg.date
            };
        } catch (err) {
            console.error(`[${this.botName}] 视频解析失败:`, err.message);
            return null;
        }
    }

    // 用户反馈（带重试机制）
    async _sendUserFeedback(msg, videoData) {
        const retryOptions = {
            retries: 3,
            factor: 2,
            minTimeout: 1000
        };

        try {
            await this._retry(async () => {
                await this.bot.sendMessage(
                    msg.chat.id,
                    `✅ <b>视频已保存</b>\n` +
                    `├ 时长: ${videoData.duration}s\n` +
                    `└ 格式: ${videoData.mimeType.split('/')[1]}`,
                    {
                        parse_mode: 'HTML',
                        reply_to_message_id: msg.message_id
                    }
                );
            }, retryOptions);
        } catch (err) {
            console.error(`[${this.botName}] 反馈发送失败:`, err.message);
        }
    }

    // 错误处理
    _handleError(msg, err) {
        console.error(`[${this.botName}] 数据库错误:`, format(err));
        this.bot.sendMessage(
            msg.chat.id,
            `❌ 保存失败: ${err.code || 'SERVER_ERROR'}`,
            { reply_to_message_id: msg.message_id }
        );
    }

    // 日志格式化
    _formatLog(msg, videoData) {
        return `聊天:${msg.chat.id} 用户:${msg.from.id} 文件:${videoData.fileId.slice(-10)}`;
    }


    // 重试逻辑封装
    async _retry(fn, { retries = 3, factor = 2, minTimeout = 1000 }) {
        try {
            return await fn();
        } catch (err) {
            if (retries <= 0) throw err;
            await new Promise(r => setTimeout(r, minTimeout));
            return this._retry(fn, {
                retries: retries - 1,
                factor,
                minTimeout: minTimeout * factor
            });
        }
    }

    // 生成转发报告 (新增方法)
    _generateForwardReport(result) {
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

        return `📮 转发完成 \n\n` +
            successPart +
            failedPart;
    }
}

module.exports = VideoHandler;