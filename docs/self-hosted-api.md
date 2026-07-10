# PokeChill 自有服务器本地方案

当前本地方案是：

```text
微信原生小程序 -> wx.request -> 本机 Node API -> JSON 缓存 -> PokeAPI 同步
```

本机启动：

```powershell
node server\index.js
```

默认地址是 `http://127.0.0.1:8787`，缓存文件在 `server/.data/pokedex-cache.json`，图片缓存文件在 `server/.data/artwork/`。

先同步完整全国图鉴 1025 只宝可梦：

```powershell
node tools\sync-self-hosted-cache.js --end-id=1025 --cache-images=false
```

快速本地验证：

```powershell
node tools\smoke-self-hosted-api.js
node tools\test-self-hosted-scheduler.js
node tools\check-self-hosted-readiness.js
```

小程序端本机私有配置：

```js
module.exports = {
  useRemoteApi: true,
  apiBaseUrl: 'http://127.0.0.1:8787',
  useCloudApi: false
};
```

上线到自己的服务器时，需要把 `apiBaseUrl` 换成 HTTPS 域名，并在微信公众平台的小程序后台配置“request 合法域名”。生产环境不要使用 IP、localhost 或 HTTP。

本地首轮建议先用 `cacheImages = $false` 跑通数据链路，因为 PokeAPI 图片源在本地测试时可能被限流。上线前再执行一次 `cacheImages = $true` 的同步，或改成自己的对象存储/CDN 图片缓存。

## PTCG 卡牌图鉴

PTCG 使用独立缓存文件：

```text
server/.data/ptcg-cache.json
server/.data/ptcg-images/cards/
```

开发期先同步一小批卡牌和完整系列列表：

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8787/api/sync/ptcg -ContentType "application/json" -Body '{"pageSize":20,"maxPages":1}'
```

默认同步参数适合本地预览，会拉取前 2 页卡牌；需要全量卡牌时传 `full: true`：

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8787/api/sync/ptcg -ContentType "application/json" -Body '{"full":true,"pageSize":250}'
```

常用查询：

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8787/api/cards?page=1&pageSize=30"
Invoke-RestMethod -Uri "http://127.0.0.1:8787/api/cards?keyword=pikachu&page=1&pageSize=20"
Invoke-RestMethod -Uri "http://127.0.0.1:8787/api/cards?type=Fire&supertype=Pok%C3%A9mon"
Invoke-RestMethod -Uri "http://127.0.0.1:8787/api/cards/base1-4"
Invoke-RestMethod -Uri "http://127.0.0.1:8787/api/pokemon/25/cards?page=1&pageSize=6"
Invoke-RestMethod -Uri "http://127.0.0.1:8787/api/ptcg/meta"
Invoke-RestMethod -Uri "http://127.0.0.1:8787/api/ptcg/sync-status"
Invoke-RestMethod -Uri "http://127.0.0.1:8787/api/card-quiz/daily"
```

卡图由自有服务代理并按需缓存，例如：

```text
http://127.0.0.1:8787/assets/ptcg/cards/base1-4/small
http://127.0.0.1:8787/assets/ptcg/cards/base1-4/large
```

卡牌数据第一版优先中文化固定枚举：属性、卡牌大类、子类型、稀有度和赛制状态。卡牌效果文本如果上游只有英文，会先保留英文。

## ProjectPokemon 3D 动态图

宝可梦详情页会从自有服务读取 ProjectPokemon Sprite Index 的 3D GIF 缓存，不把 GIF 打进小程序包：

```text
server/.data/projectpokemon-3d/index.json
server/.data/projectpokemon-3d/images/normal/
server/.data/projectpokemon-3d/images/shiny/
```

首次同步或刷新缓存：

```powershell
node tools\sync-projectpokemon-3d.js --concurrency=8
node tools\sync-projectpokemon-3d.js --refresh --concurrency=8
```

常用接口：

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8787/api/pokemon/1"
Invoke-RestMethod -Uri "http://127.0.0.1:8787/api/pokemon/1/3d-model"
Invoke-RestMethod -Uri "http://127.0.0.1:8787/api/pokemon-3d/sync-status"
```

图片由服务本地缓存并通过静态路由提供：

```text
http://127.0.0.1:8787/assets/pokemon/3d/normal/bulbasaur.gif
http://127.0.0.1:8787/assets/pokemon/3d/shiny/bulbasaur.gif
```

Gen8 页面注明 GIF 来自 pkparaiso 并要求使用时 credit；接口会把 `sourceName`、`sourceUrl` 和 `credit` 返回给小程序详情页展示。ProjectPokemon 当前 3D Models 页面覆盖 Gen1-8 的大部分条目；后续 DLC、洗翠和 Gen9 若源站没有同类 3D GIF，会在详情页自动回退为不显示 3D 卡片。

## 持续更新

`node server\index.js` 启动时会同时启动同步调度器。调度器默认：

- 启动时检查一次缓存是否缺失或过期。
- 每 24 小时检查一次。
- 如果缓存少于 1025 条，或最近同步超过 30 小时，会自动执行一次 PokeAPI 同步。
- 默认只同步 JSON 数据，`cacheImages` 为 `false`，图片优先由 `server/assets/local-pokemon/` 里的服务端兜底素材通过 `/assets/local-pokemon/` 提供。

可用环境变量调整：

```powershell
$env:POKECHILL_SYNC_INTERVAL_HOURS="24"
$env:POKECHILL_MAX_SYNC_AGE_HOURS="30"
$env:POKECHILL_SYNC_END_ID="1025"
$env:POKECHILL_SYNC_CACHE_IMAGES="false"
node server\index.js
```

查看调度器状态：

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:8787/api/sync/scheduler
```

让调度器按“是否过期/缺失”的规则立即检查一次：

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8787/api/sync/scheduler/run -ContentType "application/json" -Body "{}"
```
