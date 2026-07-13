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

## Language architecture

Web 版只提供繁體中文（`zh-TW`）與英文（`en`）兩種介面語言：

- 語言狀態、持久化、URL `lang` 參數與 `Accept-Language` 均由 `src/i18n/index.js` 統一管理。
- 大中華地區時區預設為繁體中文，其他時區預設為英文；使用者手動選擇後以儲存值為準。
- 舊版儲存的 `zh-CN`、其他中文語系代碼及中文瀏覽器語系會自動正規化為 `zh-TW`。
- 資料源可以保留官方簡中欄位作為內容回退，但顯示層必須經過 `localize()` 或舊頁面繁中轉換層，不得把 `zh-CN` 當成介面語言。
- 新增頁面文案時只建立 `zh-TW` 與 `en` 兩個分支，預設回退順序為繁中、英文。

微信原生小程序源码保留在仓库根目录的 `wechat-miniapp/`，其封版标签为 `miniapp-v1.0.0`。
