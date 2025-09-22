const mysql = require('mysql2/promise');
const {MYSQL_CONFIG} = require('../config');

const pool = mysql.createPool(MYSQL_CONFIG);

async function initializeDB() {
    const conn = await pool.getConnection();
    try {
        // 新增 bot_name 字段到 media_groups 表
        await conn.query(`
            CREATE TABLE IF NOT EXISTS media_groups
            (
                id             INT AUTO_INCREMENT PRIMARY KEY,
                media_group_id VARCHAR(255) NOT NULL UNIQUE,
                bot_name       VARCHAR(255) NOT NULL, -- 新增字段
                chat_id        BIGINT       NOT NULL,
                chat_type      ENUM ('private', 'group', 'supergroup', 'channel'),
                user_id        BIGINT       NOT NULL,
                username       VARCHAR(255),
                first_name     VARCHAR(255),
                last_name      VARCHAR(255),
                message_count  INT      DEFAULT 0,
                created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX bot_index (bot_name)            -- 优化查询性能
            )`);

        // 新增 bot_name 字段到 media_items 表（可根据实际需求选择是否添加）
        await conn.query(`
            CREATE TABLE IF NOT EXISTS media_items
            (
                id             INT AUTO_INCREMENT PRIMARY KEY,
                media_group_id VARCHAR(255)                                 NOT NULL,
                bot_name       VARCHAR(255)                                 NOT NULL, -- 新增字段
                type           ENUM ('photo', 'video', 'document', 'audio') NOT NULL,
                file_id        VARCHAR(255)                                 NOT NULL,
                caption        TEXT,
                timestamp      DATETIME                                     NOT NULL,
                FOREIGN KEY (media_group_id) REFERENCES media_groups (media_group_id),
                INDEX bot_index (bot_name)                                            -- 索引优化
            )`);

        // 新增到 single_videos 表
        await conn.query(`
            CREATE TABLE IF NOT EXISTS single_videos
            (
                id        INT AUTO_INCREMENT PRIMARY KEY,
                file_id   VARCHAR(255) NOT NULL UNIQUE,
                bot_name  VARCHAR(255) NOT NULL,                       -- 新增字段
                chat_id   BIGINT       NOT NULL,
                user_id   BIGINT       NOT NULL,
                caption   TEXT,
                duration  INT,
                mime_type VARCHAR(50),
                timestamp DATETIME     NOT NULL,
                INDEX chat_user_bot_index (chat_id, user_id, bot_name) -- 联合索引
            )
        `);
    } finally {
        conn.release();
    }
}

module.exports = {
    pool,
    initializeDB
};