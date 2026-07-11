# PokeChill Web

宝批小站 Web 版，使用 Taro 4.2、React 18 和 Sass 构建。数据、热门卡组、轻玩法和图片统一由仓库中的 Node 服务提供。

## Development

```powershell
npm install
npm run dev
```

开发服务器默认运行在 `http://localhost:10086/`，并把 `/api`、`/assets` 和 `/health` 代理到 `http://127.0.0.1:8787`，因此需要同时运行：

```powershell
node ..\server\index.js
```

## Production build

```powershell
npm run build
```

产物输出到 `dist/`。`server/index.js` 会托管该目录、处理 SPA 回退、gzip 压缩和哈希资源强缓存，因此生产环境只需部署并运行一个 Node 服务。

## Source layout

- `src/pages/`：宝可梦、实体卡牌、Pocket、玩法和个人数据页面。
- `src/services/api.js`：自有 Node 服务客户端。
- `src/components/`：跨页面组件。
- `config/`：Taro H5 构建配置。

微信原生小程序源码保留在仓库根目录的 `wechat-miniapp/`，其封版标签为 `miniapp-v1.0.0`。
