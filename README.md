# 🤖 Telegram媒体机器人

![Node.js](https://img.shields.io/badge/Node.js-18.x-green)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15.x-blue)
![License](https://img.shields.io/badge/License-MIT-orange)

一个支持媒体管理、自动存储和随机发送的Telegram机器人

[![Deploy](https://img.shields.io/badge/Deploy_on-Replit-blue)](https://replit.com/github/yourusername/your-repo)
[![Demo Bot](https://img.shields.io/badge/Telegram-TestBot-blue)](https://t.me/your_demo_bot)

## 🌟 功能特性

- 📸 **媒体组处理** - 自动识别并存储图片组
- 🎥 **视频管理** - 独立处理视频消息存储
- 🎲 **随机发送** - 通过`/sj`命令随机发送媒体
- 🛡️ **代理支持** - 内置HTTPS代理连接
- 📊 **数据持久化** - MySQL数据库存储
- 👨💻 **管理功能** - 支持管理员权限校验

## 🚀 快速开始

### 前置要求
- Node.js 18.x+
- PostgreSQL 15+
- Telegram Bot Token

### 安装步骤
```bash
# 克隆仓库
git clone https://github.com/modefa888/faBu.git

# 进入目录
cd faBu

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
配置环境
编辑.env文件：

TELEGRAM_TOKEN=你的机器人Token
BOT_NAME=你的机器人name
PROXY_HOST=代理服务器地址          # 可选
PROXY_PORT=代理端口                # 可选
FORWARD_CHAT_IDS=12345678,87654321       # 管理员ID
MYSQL_HOST=地址
MYSQL_PORT=端口
MYSQL_USER=用户名
MYSQL_PASSWORD=密码
MYSQL_DATABASE=数据库名
启动运行
# 开发模式（带热重载）
npm run dev

# 生产模式
npm start
📚 使用文档
基础命令
命令	功能描述
/start	显示欢迎信息
/help	显示帮助文档
/sj	随机发送存储的媒体内容
数据库结构
-- 媒体组表
CREATE TABLE media_groups (
    id TEXT PRIMARY KEY,
    content JSONB NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- 视频表 
CREATE TABLE videos (
    id SERIAL PRIMARY KEY,
    file_id TEXT NOT NULL,
    user_id BIGINT NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW()
);
开发扩展
// 添加新的消息处理器
class CustomHandler {
  constructor(bot, pool) {
    this.bot = bot;
    this.pool = pool;
  }

  handleMessage(msg) {
    if (msg.text?.startsWith('/custom')) {
      this.bot.sendMessage(msg.chat.id, 'Custom command received!');
    }
  }
}

// 在主流程中初始化
const customHandler = new CustomHandler(bot, pool);
bot.on('message', msg => customHandler.handleMessage(msg));
🧩 项目结构
telegram-media-bot/
├── src/
│   ├── database.js        # 数据库连接
│   ├── mediaGroupHandler.js # 多媒体组处理
│   ├── videoHandler.js    # 单个视频处理
│   ├── randomSender.js    # 随机发送逻辑
│   └── menu.js           # 交互菜单管理
├── .env.example           # 环境配置示例
├── index.js              # 主入口文件
└── package.json
🤝 贡献指南
Fork本仓库
创建特性分支 (git checkout -b feature/awesome)
提交修改 (git commit -m 'Add awesome feature')
推送分支 (git push origin feature/awesome)
发起Pull Request
📜 许可协议
本项目采用 MIT License

温馨提示：实际部署前请确保已配置正确的代理和数据库连接参数，建议配合PM2等进程管理工具使用。
