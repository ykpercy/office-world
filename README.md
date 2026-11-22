# 打工人世界 · Office World

一个在浏览器里运行的开放世界上班模拟小游戏（单文件，无需构建）。

## 玩法
- WASD / 方向键移动，Shift 快走，E 交互（工位处按住），回车聊天
- 9 点前打卡、在工位搬砖完成项目、开会点头、茶水间续命，别被老板抓到摸鱼
- 18:00 下班结算薪水

## 3D 画面
- 画面用 Three.js（r128，从 cdnjs 加载）渲染：固定 55° 斜俯视角，低多边形风格，静态几何体按颜色合并以减少绘制调用，不开实时阴影；名字、气泡和互动图标画在上层的 2D 叠加层上。游戏逻辑（时间、数值、联机、存档）与画面完全分离。
- 加载不到 Three.js 或设备不支持 WebGL 时，自动退回原来的 2D 画面。
- 触屏设备分辨率上限 1.5 倍、帧率约 30–40，用来控制发热。

## 背景音乐
- 8-bit 像素风循环（脉冲波旋律 + 贝斯 + 轻鼓点，8 小节 C-G-Am-F-C-G-F-G，约 16 秒一轮）。
- 音乐是**预渲染好的 MP3**（22.05kHz 单声道 80kbps，约 360KB，内嵌在 `index.html` 里），运行时只解码并循环播放，几乎不占 CPU；静音时会彻底暂停音频线程。
- MP3 编码会在开头多出几十毫秒的静音，直接整段循环会有停顿。这里把约 2.25 轮渲染进文件，播放时只在中间一轮里循环（循环点写在 `MUSIC_LOOP`），因为内容以一轮为周期，所以不受解码器延迟影响，首尾无缝。
- `tools/music-preview.mp3` 可直接下载试听（含开头约 17 秒的前奏）。想改旋律、速度、音色：编辑 `tools/render-music.html` 里的合成代码，然后运行 `python tools/build_music.py`（需 `pip install playwright lameenc && playwright install chromium`），会自动重新生成并写回 `index.html`。
- 点击顶部 🔊 或按 M 静音，选择会被记住。

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
