# 打工人世界 · Office World

一个在浏览器里运行的开放世界上班模拟小游戏（单文件，无需构建）。

## 玩法
- WASD / 方向键移动，Shift 快走，E 交互（工位处按住），回车聊天
- 9 点前打卡、在工位搬砖完成项目、开会点头、茶水间续命，别被老板抓到摸鱼
- 18:00 下班结算薪水

## 账号与存档
- 玩家用「名字 + 密码」注册或登录，进度（天数、存款、完成项目数、精力、压力、颜色）保存在外部 Postgres 数据库。
- 密码用 scrypt 加盐哈希存储；登录后发放 30 天有效的签名令牌；登录接口有限流。
- 服务器会校验存档并限制单次增长幅度，防止直接伪造；游客可试玩但不保存，联机名字自动带“游客”前缀，防止冒充。
- 没配置数据库时服务器仍可运行，只是只有游客模式。

### 1. 申请免费数据库（Neon）
1. 到 https://neon.tech 注册并新建项目，复制连接字符串（形如 `postgresql://用户:密码@xxx.neon.tech/neondb?sslmode=require`）。
2. 表会在服务器首次启动时自动创建，无需手动建表。（Supabase 等任意 Postgres 也行，只要给连接字符串。）

### 2. 部署到 Render
1. 把仓库推到 GitHub，在 Render 新建 Web Service 并选中它（已有 `render.yaml`）。
2. 在 Render 的 Environment 里设置：
   - `DATABASE_URL`：上一步的连接字符串
   - `AUTH_SECRET`：一串随机长字符（`render.yaml` 会自动生成；手动创建时要自己填，否则每次重启所有人都要重新登录）
3. 部署完成后访问 `https://你的服务名.onrender.com`。

## 本地运行
```bash
npm install
DATABASE_URL="你的连接字符串" AUTH_SECRET="随便一串长字符" npm start
# 打开 http://localhost:3000 ；不设 DATABASE_URL 则只有游客模式
```

## 前端放 GitHub Pages、服务器单独部署
- 把 `index.html` 里的 `DEFAULT_SERVER` 改为 `wss://你的服务名.onrender.com`，
- 或用链接参数：`https://用户名.github.io/office-world/?server=wss://你的服务名.onrender.com`。
- 服务器已开启 CORS，账号接口可跨域使用。

## 联机说明
- 服务器转发位置与聊天，带限速和字段校验。
- 在 claude.ai 内发布的版本使用平台自带的 `room` 能力，没有账号功能；其他环境走自建服务器；都不可用时为单人模式。

## License
MIT
