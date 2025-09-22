class GroupManager {
    constructor() {
        this.groups = new Set();
        this._loadInitialGroups();
        this.botName = process.env.BOT_NAME;
    }

    // 从环境变量初始化群组
    _loadInitialGroups() {
        if (process.env.FORWARD_CHAT_IDS) {
            process.env.FORWARD_CHAT_IDS.split(',').forEach(id => {
                this.addGroup(id.trim());
            });
        }
    }

    // 添加群组 (返回操作结果)
    addGroup(chatId) {
        const existed = this.groups.has(chatId);
        this.groups.add(chatId);
        return !existed; // 返回是否新增成功
    }

    // 核心转发方法（添加成功群组收集）
    async forwardMedia(bot, data, type) {
        const failedGroups = [];
        const successGroups = []; // 新增成功群组数组

        for (const chatId of this.groups) {
            let title;
            try {
                switch (type) {
                    case 'media_group':
                        title = await this._forwardMediaGroup(bot, chatId, data.items, data.mgId);
                        break;
                    case 'video':
                        title = await this._handleMediaForward(bot, chatId, data.msg, data.videoData);
                        break;
                    default:
                        throw new Error('未知的媒体类型');
                }
                console.log(`[转发成功] 群组 ${chatId} 类型 ${type}`);
                successGroups.push(title); // 成功时记录群组ID
            } catch (err) {
                console.error(`[转发失败] 群组 ${chatId}`, err.message);
                failedGroups.push(chatId);
            }
        }

        return {
            total: this.groups.size,
            success: successGroups.length, // 改为使用数组长度
            successGroups: successGroups,  // 新增成功群组列表
            failed: failedGroups
        };
    }

    // 多媒体组消息发送
    async _forwardMediaGroup(bot, chatId, items, mgId) {
        const forwardChatId = chatId;
        if (!forwardChatId) return;

        try {
            const mediaGroup = items.map((item, index) => ({
                type: item.type,
                media: item.fileId,
                caption: index === 0 ? items[0].caption || '' : undefined,
                parse_mode: 'HTML'
            }));

            const result = await bot.sendMediaGroup(forwardChatId, mediaGroup);
            const title = result[0].sender_chat.title;
            console.log(`[${this.botName}] 已转发组 ${mgId.slice(-6)} 至 ${forwardChatId}`);
            return forwardChatId + '[ ' + title + ' ]';
        } catch (err) {
            console.error(`[${this.botName}] 转发失败:`, err.stack);
        }
    }

    // 单个视频消息发送
    async _handleMediaForward(bot, chatId, msg, videoData) {
        const forwardChatId = chatId;
        if (!forwardChatId) return;

        try {
            const result = await bot.sendVideo(
                forwardChatId,
                videoData.fileId,
                {
                    caption: `${videoData.caption || ''}`.trim(),
                    parse_mode: 'HTML'
                }
            );
            const title = result.sender_chat.title;
            console.log(`[${this.botName}] 已转发至群组 ${forwardChatId}`);
            return forwardChatId + '[ ' + title + ' ]';
        } catch (err) {
            console.error(`[${this.botName}] 转发失败:`, err.message);
            await bot.sendMessage(
                msg.chat.id,
                `⚠️ 转发失败: ${err.code || '网络错误'}`,
                { reply_to_message_id: msg.message_id }
            );
        }
    }
}

module.exports = new GroupManager(); // 单例模式