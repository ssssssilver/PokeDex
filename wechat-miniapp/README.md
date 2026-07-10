# PokeChill 微信小程序

这是 PokeChill 的原生微信小程序路线，定位为「图鉴工具 + 轻玩法盒子」。

当前仓库已经收口到小程序方向。本目录是微信原生小程序前端，配合仓库根目录的 `server/` 自有中转服务使用；云开发相关文件保留为备选方案。

## 打开方式

1. 从仓库根目录运行 `node tools\configure-miniapp-cloud-local.js --init-empty`。
2. 打开微信开发者工具。
3. 选择「导入项目」。
4. 项目目录选择 `wechat-miniapp/`。
5. AppID 可以先使用测试号或自己的小程序 AppID。
6. 进入后可先用本地种子数据预览首页、图鉴、详情、玩法和我的页面。

## 云开发

第一版默认不强制调用云函数，默认配置在：

```text
miniprogram/config.js
```

真实云环境 ID 和切云开关建议写到本机私有的 `miniprogram/config.local.js`，这个文件已被 `.gitignore` 忽略。

当云环境和函数部署完成后：

1. 在微信开发者工具中开通云开发。
2. 运行 `node ..\tools\configure-miniapp-cloud-local.js --cloud-env=你的云环境ID --use-cloud-api=false`。
3. 运行 `node ..\tools\check-miniapp-cloud-readiness.js --mode=deploy`。
4. 上传并部署 `cloudfunctions/pokedex`。
5. 上传并部署 `cloudfunctions/syncPokeapi`。
6. 运行 `syncPokeapi` 同步 151 只宝可梦。
7. 保存 `syncPokeapi`、`validateCache`、`getSyncRuns` 的云端结果后，运行 `node ..\tools\promote-miniapp-cloud.js --cloud-env=你的云环境ID`。
8. 重新编译小程序，并在「我的」页运行云缓存自检。

详细步骤见：

```text
../docs/wechat-miniapp-cloud-setup.md
```

## 云函数

### `pokedex`

用于小程序运行期查询缓存数据。

支持 action：

- `listPokemon`
- `getPokemon`
- `getTypes`
- `getTypeRelations`
- `getEvolutionChain`
- `getDailyQuiz`
- `submitDailyQuiz`
- `analyzeTeam`
- `getSyncStatus`
- `getSyncRuns`
- `validateCache`

如果云数据库还没有同步数据，会回退到函数内置的首批种子数据。

### `syncPokeapi`

用于从 PokeAPI 同步数据到云数据库。

默认同步前 151 只宝可梦，写入：

- `pokemon_summary`
- `pokemon_detail`
- `sync_meta`

`cacheImages` 默认开启，会把官方图同步到微信云存储，并把数据库里的 `image` 改成云 fileID，同时保留 `image_remote` 作为排查来源，避免把 PokeAPI 图片域名放在用户实时首屏链路里。

首次全量同步缓存图片后，后续手动同步和每天定时同步都会复用已有云 fileID；即使继续传 `cacheImages: true`，也不会重复上传已缓存图片。只有需要临时跳过补图时才传 `cacheImages: false`；需要强制替换云存储图片时，才额外传 `refreshImages: true`。

`getSyncStatus` 的 `syncedCount` / `imageCachedCount` 表示当前云缓存实际可用总量；`lastRun*` 字段表示最后一次同步批次的运行结果，适合排查分批同步。`getSyncRuns` 会返回最近几次 `sync_runs` 记录，用来确认定时同步是否持续成功。

## 当前 MVP

- 4 个底部 Tab：首页、图鉴、玩法、我的。
- 首页：今日宝可梦、搜索入口、最近查看、功能入口。
- 图鉴：搜索、属性筛选、排序、收藏。
- 详情：基础资料、属性、种族值、进化链、收藏、加入队伍。
- 玩法：猜宝可梦、队伍分析、属性速查、随机挑战占位。
- 我的：收藏、最近查看、进度概览。

## 本地数据同步检查

从仓库根目录先跑一键 preflight：

```powershell
node tools\preflight-miniapp-cloud.js
```

它会检查真实数据快照、同步转换、PokeAPI dry-run、本地云函数闭环、云部署工件、JS 语法和 WXML 风险表达式。通过后再部署云函数、同步 151 只宝可梦并切换 `useCloudApi`。

部署前检查云环境配置：

```powershell
node tools\check-miniapp-cloud-readiness.js --mode=deploy
```

生成微信开发者工具云函数测试 payload：

```powershell
node tools\generate-miniapp-cloud-payloads.js
```

真实云端执行时打开 `tmp/wechat-cloud-payloads/RUNBOOK.md`，按表格保存每个云函数返回结果。

切换云缓存后检查页面读取配置：

```powershell
node tools\check-miniapp-cloud-readiness.js --mode=cloud
```

验证同步转换逻辑：

```powershell
node ..\tools\test-miniapp-sync-core.js
```

从 PokeAPI 拉取少量真实数据并 dry-run 转换：

```powershell
node ..\tools\smoke-miniapp-pokeapi-sync.js 3
```

本地模拟云函数闭环：

```powershell
node ..\tools\smoke-miniapp-cloudfunctions-local.js
```

部署后可在 `pokedex` 云函数测试里执行：

```json
{
  "action": "validateCache",
  "expectedCount": 151,
  "sampleIds": [1, 4, 7, 25, 151],
  "maxSyncAgeHours": 30
}
```

其中 `maxSyncAgeHours` 用来确认定时同步仍在持续工作；默认每日同步时，建议用 30 小时作为部署后验收阈值。

如果 `validateCache` 失败，返回的 `repair.payloads` 可以直接复制到 `syncPokeapi` 云函数测试面板执行，用来补同步缺失详情或图片缓存。

切换 `useCloudApi: true` 后，也可以在「我的」页点击「云缓存自检」做页面内验收；通过时会显示 `151 / 151` 和同步年龄。

如果要复验真实云端输出，可以把开发者工具里的 `syncPokeapi`、`validateCache` 和 `getSyncRuns` 返回结果放到 JSON 文件后执行：

```powershell
node tools\verify-miniapp-cloud-deploy-result.js --sync=tmp\wechat-cloud-sync-result.json --validate=tmp\wechat-cloud-validate-result.json --runs=tmp\wechat-cloud-sync-runs-result.json
```

分批同步时可以重复传 `--sync`：

```powershell
node tools\verify-miniapp-cloud-deploy-result.js --sync=tmp\wechat-cloud-sync-001-050.json --sync=tmp\wechat-cloud-sync-051-100.json --sync=tmp\wechat-cloud-sync-101-151.json --validate=tmp\wechat-cloud-validate-result.json --runs=tmp\wechat-cloud-sync-runs-result.json
```

如果使用 `generate-miniapp-cloud-payloads.js` 的默认目录结构，保存结果后可以直接跑：

```powershell
node tools\check-miniapp-cloud-evidence.js
```

证据通过后切换到云缓存读取：

```powershell
node tools\promote-miniapp-cloud.js --cloud-env=你的云环境ID
```

生成本地真实数据快照：

```powershell
node ..\tools\generate-miniapp-pokemon-snapshot.js --limit 151
node ..\tools\validate-miniapp-pokemon-snapshot.js
```

这个快照会写入 `miniprogram/data/generated-pokemon.js`，用于云开发接入前的本地兜底。

## 下一步

1. 在微信开发者工具里打开并确认页面渲染。
2. 部署云环境与 `pokedex` 云函数。
3. 运行 `syncPokeapi` 同步真实数据。
4. 替换/扩充图片资源和中文本地化字段。
5. 继续打磨猜谜、队伍分析和分享卡片。
