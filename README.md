# 打工人世界 · Office World

一个在浏览器里运行的开放世界上班模拟小游戏（单文件，无需构建）。

## 玩法
- WASD / 方向键移动，Shift 快走，E 交互（工位处按住），回车聊天
- 9 点前打卡、在工位搬砖完成项目、开会点头、茶水间续命，别被老板抓到摸鱼
- 18:00 下班结算薪水

## 本地运行（含联机）
```bash
npm install
npm start          # 打开 http://localhost:3000，多开几个标签页即可联机
```

## 部署联机服务器（Render 免费版）
1. 把仓库推到 GitHub，在 Render 新建 Web Service 并选中该仓库（仓库内已有 `render.yaml`）。
2. 部署完成后访问 `https://你的服务名.onrender.com`，页面由服务器托管，自动连接同域 WebSocket。
3. 免费版闲置会休眠，首次访问需等待几十秒唤醒。

## 前端放 GitHub Pages、服务器单独部署
- 将 `index.html` 中的 `DEFAULT_SERVER` 改为 `wss://你的服务名.onrender.com`，
- 或直接用链接参数：`https://用户名.github.io/office-world/?server=wss://你的服务名.onrender.com`。

## 联机说明
- 服务器只转发位置与聊天，不保存数据，带限速和字段校验。
- 在 claude.ai 内发布的版本使用平台自带的 `room` 能力；其他环境走自建 WebSocket；两者都不可用时为单人模式。

## License
MIT
