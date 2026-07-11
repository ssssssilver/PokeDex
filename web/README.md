# PokeChill Web

宝批小站 Web 版，使用 Taro 4.2、React 18 和 Sass 构建，数据默认从阿里云 OSS 的版本化静态快照读取。

## Development

```powershell
npm install
npm run dev
```

开发服务器默认运行在 `http://localhost:10086/`。

## Production build

```powershell
npm run build
```

产物输出到 `dist/`，可部署到支持 SPA 回退的静态托管服务。服务器应把未知路径回退到 `index.html`。

## Source layout

- `src/pages/`：宝可梦、实体卡牌、Pocket、玩法和个人数据页面。
- `src/services/static-api.js`：OSS 静态数据访问与缓存层。
- `src/services/api.js`：统一业务 API 和本地降级逻辑。
- `src/components/`：跨页面组件。
- `config/`：Taro H5 构建配置。

微信原生小程序源码保留在仓库根目录的 `wechat-miniapp/`，其封版标签为 `miniapp-v1.0.0`。
