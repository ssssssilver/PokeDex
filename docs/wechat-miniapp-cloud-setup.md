# 微信云开发接入检查表

本文档用于把 `wechat-miniapp/` 从本地种子数据切换到微信云开发缓存层。

## 1. 开通云开发

1. 用微信开发者工具打开 `wechat-miniapp/`。
2. 点击「云开发」。
3. 创建或选择一个云环境。
4. 记下云环境 ID。

## 2. 配置小程序端

默认配置在：

```text
wechat-miniapp/miniprogram/config.js
```

真实云环境配置建议写到本机私有文件 `config.local.js`。这个文件已被 `.gitignore` 忽略，不会混进版本里。先生成云环境 ID，但保持本地模式：

如果只是本地预览，还没有云环境 ID，先生成一个空本地配置文件：

```powershell
node tools\configure-miniapp-cloud-local.js --init-empty
```

准备部署云环境时，再写入云环境 ID：

```powershell
node tools\configure-miniapp-cloud-local.js --cloud-env=你的云环境ID --use-cloud-api=false
```

确认本地页面仍能正常显示后，再切换：

```powershell
node tools\configure-miniapp-cloud-local.js --cloud-env=你的云环境ID --use-cloud-api=true
```

## 3. 部署云函数

部署前先确认云部署工件和配置：

```powershell
node tools\check-miniapp-cloud-readiness.js --mode=deploy
```

这个检查会要求有效配置里已填写真实 `cloudEnv`，并确认 `project.config.json`、云函数依赖、`syncPokeapi` 定时触发器和本地真实数据快照都齐全。有效配置来自 `config.js` 默认值加本机私有的 `config.local.js` 覆盖。

如果想确认本机是否可以用微信开发者工具 CLI 辅助云端部署/查询，先跑：

```powershell
node tools\check-wechat-devtools-cli.js
```

如果输出提示 `IDE service port is enabled` 未通过，打开微信开发者工具，进入「设置 -> 安全设置」，开启「服务端口」，然后再执行：

```powershell
node tools\check-wechat-devtools-cli.js --strict
```

这个脚本不会修改云端数据；它只检查本机 CLI、项目路径、服务端口、登录态和云环境是否可查询。

服务端口和登录态都通过后，可以先 dry-run 预览云函数部署命令：

```powershell
node tools\deploy-wechat-cloudfunctions.js --cloud-env=你的云环境ID
```

确认命令里的云环境和函数名正确后，再显式执行部署：

```powershell
node tools\deploy-wechat-cloudfunctions.js --cloud-env=你的云环境ID --execute
```

这个脚本会先调用 `check-wechat-devtools-cli.js --strict`，只有 CLI、服务端口、登录态和云环境查询通过后，才会执行微信开发者工具的 `cloud functions deploy` 命令。默认部署 `pokedex` 和 `syncPokeapi`，并使用云端安装 npm 依赖。

在微信开发者工具中依次上传并部署：

```text
wechat-miniapp/cloudfunctions/pokedex
wechat-miniapp/cloudfunctions/syncPokeapi
```

`pokedex` 是运行期查询函数。

`syncPokeapi` 是同步函数，只需要手动执行或定时执行，不要在用户访问链路里调用。

## 4. 先测试查询函数

在云函数本地/云端测试里执行 `pokedex`：

```json
{
  "action": "listPokemon"
}
```

预期：

- 返回 `items`。
- 如果还没同步数据库，`source` 可能是 `seed`。
- 小程序「我的」页的数据源会显示本地或种子状态。

## 5. 执行 PokeAPI 同步

可以先生成微信开发者工具测试面板要用的 JSON payload：

```powershell
node tools\generate-miniapp-cloud-payloads.js
```

默认会写入：

```text
tmp/wechat-cloud-payloads/
```

其中包含 3 批同步 payload、一个空 event 的 `syncPokeapi-timer-default.json`、`validateCache` payload、`getSyncStatus` payload、`getSyncRuns` payload、机器可读的 `MANIFEST.json`、`README.md` 和更详细的 `RUNBOOK.md`。真实云端操作时优先打开 `tmp/wechat-cloud-payloads/RUNBOOK.md`，按表格逐个执行云函数并保存结果文件；`check-miniapp-cloud-evidence.js` 会优先读取 `MANIFEST.json`，避免生成清单和检查清单漂移。

在云函数测试里执行 `syncPokeapi`：

```json
{
  "limit": 151,
  "retries": 2,
  "concurrency": 4,
  "cacheImages": true,
  "strictImageCache": false
}
```

预期：

- `syncedCount` 接近 151。
- `imageCachedCount` 接近 151。
- `failedCount` 为 0，或只有少量网络失败。
- 云数据库出现以下集合：
  - `pokemon_summary`
  - `pokemon_detail`
  - `sync_meta`
- 云存储出现 `pokemon/artwork/` 下的图片文件。

如果网络不稳定，可以先执行：

```json
{
  "startId": 1,
  "endId": 50,
  "retries": 2,
  "concurrency": 3,
  "cacheImages": true,
  "strictImageCache": false
}
```

确认链路正常后，可以继续分批同步：

```json
{
  "startId": 51,
  "endId": 100,
  "retries": 2,
  "concurrency": 3,
  "cacheImages": true,
  "strictImageCache": false
}
```

```json
{
  "startId": 101,
  "endId": 151,
  "retries": 2,
  "concurrency": 3,
  "cacheImages": true,
  "strictImageCache": false
}
```

也可以在确认链路正常后一次同步 151。真实云函数如果有超时风险，优先用上面的 3 批方案。

分批同步完成后，再执行一次空 event，用来验证每天 03:30 定时触发器会走的默认全量同步路径：

```json
{}
```

预期返回里应包含 `startId: 1`、`endId: 151`、`limit: 151`、`concurrency: 6`、`cacheImages: true`，并且 `status` 为 `success`。这一次通常会复用前面已经上传的云存储图片，所以 `imageReusedCount` 可能较高。

也可以按范围补同步：

```json
{
  "startId": 152,
  "endId": 251,
  "retries": 2,
  "concurrency": 4,
  "cacheImages": true,
  "strictImageCache": false
}
```

只验证 PokeAPI 拉取和转换、不写云数据库：

```json
{
  "limit": 12,
  "dryRun": true
}
```

注意：`dryRun: true` 只验证拉取和转换，不写云数据库，也不会上传图片到云存储。

如果想自定义云存储路径：

```json
{
  "limit": 151,
  "cacheImages": true,
  "strictImageCache": false,
  "imageCloudPathPrefix": "pokemon/artwork"
}
```

`strictImageCache` 默认是 `false`。也就是说图片上传失败时，图鉴数据仍会入库，失败图片会记录到 `imageCacheFailed`。如果希望图片失败时该条宝可梦也算同步失败，可以设为 `true`。

`syncPokeapi` 会写入：

- `sync_meta/pokeapi`：最新同步状态。
- `sync_runs/{runId}`：每次同步的执行记录。
- `evolutionCacheSize`：本次同步复用的进化链缓存数量，用来观察 PokeAPI 请求复用情况。
- `pokemon_summary.image` / `pokemon_detail.image`：开启 `cacheImages` 后为云存储 fileID。
- `pokemon_summary.image_remote` / `pokemon_detail.image_remote`：保留 PokeAPI 原图 URL，方便排查。
- `imageCachedCount` / `imageCacheFailedCount`：图片缓存成功和失败数量。
- `imageUploadedCount`：本次实际上传到云存储的图片数量。
- `imageReusedCount`：本次没有重新上传、但复用了已有云存储 fileID 的图片数量。
- `pokemon_detail.evolution_chain`：PokeAPI 进化链里的 species ID，详情页会用它解析可点击的进化链节点。

`pokedex/getSyncStatus` 返回的是面向页面的聚合状态：`syncedCount` 和 `imageCachedCount` 代表当前云数据库实际可用总量；`lastRunSyncedCount`、`lastRunImageCachedCount`、`lastRunImageUploadedCount`、`lastRunImageReusedCount` 才代表最后一次同步运行的批次结果。分批同步时，以 `syncedCount` / `imageCachedCount` 判断当前图鉴是否完整。

`pokedex/getSyncRuns` 返回最近几次 `sync_runs` 记录，适合在部署后确认手动同步和定时同步是否持续成功：

```json
{
  "action": "getSyncRuns",
  "limit": 5
}
```

如果最近记录里出现 `skipped`，表示定时触发器执行过，但上一轮同步仍在运行，函数没有覆盖原有 running lock；如果它持续出现，需要检查单次同步是否过慢或是否卡住。如果出现 `partial` 或 `failed`，优先查看对应返回里的 `failedCount`、`imageFailedCount`，再运行 `validateCache` 获取修复 payload。`failed` 通常代表同步函数外层异常已经被记录下来，不会只停留在模糊的 `running` 状态；这时也可以查看 `sync_runs/{runId}` 里的 `message` 字段定位原因。

同步函数目录包含一个定时触发配置：

```text
wechat-miniapp/cloudfunctions/syncPokeapi/config.json
```

默认每天 03:30 触发一次。上传云函数时需要在开发者工具里确认触发器也被部署；`RUNBOOK.md` 里的 `syncPokeapi-timer-default.json` 就是用来手动验证这个空 event 默认路径。

`cacheImages` 默认是 `true`，所以手动同步和每天 03:30 的空 event 定时同步都会具备图片缓存自修复能力。已有云存储 fileID 会被优先复用，不会重复下载和上传已缓存图片；只有在临时排查、确实不想补图时，才传 `cacheImages: false`。如果需要强制替换云存储图片，再额外传 `refreshImages: true`。

## 6. 切换到云缓存

同步成功并保存云端证据后，先 dry-run 检查“证据通过后切云”的完整流程：

```powershell
node tools\promote-miniapp-cloud.js --cloud-env=你的云环境ID --dry-run
```

确认通过后正式切换本机私有配置：

```powershell
node tools\promote-miniapp-cloud.js --cloud-env=你的云环境ID
```

这个脚本会先执行 `check-miniapp-cloud-evidence.js`，确认 `syncPokeapi`、`validateCache`、`getSyncRuns` 的真实云端结果都达标，然后才写入 `config.local.js` 的 `useCloudApi: true`，最后自动跑 `check-miniapp-cloud-readiness.js --mode=cloud`。切换后重新编译小程序。

## 7. 验证页面

先在云函数测试里执行 `pokedex` 自检：

```json
{
  "action": "validateCache",
  "expectedCount": 151,
  "sampleIds": [1, 4, 7, 25, 151],
  "maxSyncAgeHours": 30
}
```

预期：

- `ok` 为 `true`。
- `checks.actualCount` 不小于 151。
- `checks.missingSummaryIds` 为空。
- `checks.missingDetailIds` 为空。
- `checks.invalidEvolutionIds` 为空。
- `checks.syncFresh` 为 `true`，`checks.syncStale` 为 `false`。
- `checks.syncFailedCount` 为 0。

`maxSyncAgeHours: 30` 用来验证定时同步是否持续工作。默认触发器是每天 03:30，如果这个检查失败，优先确认 `syncPokeapi/config.json` 的定时触发器是否随云函数一起部署，以及最近一次 `sync_runs` 是否有失败记录。

如果 `validateCache.ok` 为 `false`，返回结果里的 `repair` 字段会给出建议修复 payload：

```json
{
  "repair": {
    "needed": true,
    "ids": [25],
    "payloads": [
      {
        "startId": 25,
        "endId": 25,
        "retries": 2,
        "concurrency": 3,
        "cacheImages": true,
        "strictImageCache": false,
        "force": true
      }
    ]
  }
}
```

把 `repair.payloads` 里的对象逐个复制到 `syncPokeapi` 云函数测试面板执行，然后重新运行 `validateCache`。默认 `validateCache` 会检查 `1-151` 的 summary 和 detail 文档，并对缺失详情、缺失图片、未缓存图片、进化链解析异常生成修复建议。

如果要把真实云端执行结果变成可复验的发布证据，可以把微信开发者工具里 `syncPokeapi`、`validateCache`、`getSyncStatus` 和 `getSyncRuns` 的返回 JSON 分别放到：

```text
tmp/wechat-cloud-sync-result.json
tmp/wechat-cloud-validate-result.json
tmp/wechat-cloud-sync-status-result.json
tmp/wechat-cloud-sync-runs-result.json
```

然后执行：

```powershell
node tools\verify-miniapp-cloud-deploy-result.js --sync=tmp\wechat-cloud-sync-result.json --validate=tmp\wechat-cloud-validate-result.json --status=tmp\wechat-cloud-sync-status-result.json --runs=tmp\wechat-cloud-sync-runs-result.json
```

如果采用分批同步，把每批结果分别保存，然后重复传入 `--sync`：

```text
tmp/wechat-cloud-sync-001-050.json
tmp/wechat-cloud-sync-051-100.json
tmp/wechat-cloud-sync-101-151.json
tmp/wechat-cloud-sync-timer-default.json
tmp/wechat-cloud-validate-result.json
tmp/wechat-cloud-sync-status-result.json
tmp/wechat-cloud-sync-runs-result.json
```

```powershell
node tools\verify-miniapp-cloud-deploy-result.js --sync=tmp\wechat-cloud-sync-001-050.json --sync=tmp\wechat-cloud-sync-051-100.json --sync=tmp\wechat-cloud-sync-101-151.json --sync=tmp\wechat-cloud-sync-timer-default.json --validate=tmp\wechat-cloud-validate-result.json --status=tmp\wechat-cloud-sync-status-result.json --runs=tmp\wechat-cloud-sync-runs-result.json
```

脚本会汇总多个批次的 `syncedCount`、`imageCachedCount`，检查同步结果覆盖 `1-151`，要求存在一次默认全量同步结果，确认 `getSyncStatus` 已经能给页面返回 `healthTone: "ready"`，并要求每个 `syncPokeapi` 返回的 `runId` 都能在 `getSyncRuns` 最近记录里查到。

如果使用 `generate-miniapp-cloud-payloads.js` 生成的目录结构，并按 README 把结果保存到 `tmp/wechat-cloud-payloads/results/`，可以直接执行：

```powershell
node tools\check-miniapp-cloud-evidence.js
```

它会先检查所有结果文件是否齐全，再自动调用 `verify-miniapp-cloud-deploy-result.js` 做内容验收。验收通过后会写入 `tmp/wechat-cloud-payloads/results/wechat-cloud-evidence-summary.json`，作为这次真实云端同步、缓存、页面状态和运行记录的发布证据摘要。

这个脚本会检查：

- `syncPokeapi` 不是 `dryRun`，且单次或多批合计 `syncedCount` 不小于 151。
- 每个 `syncPokeapi` 结果都是 `status: "success"`，并带有唯一 `runId`。
- 至少有一次默认全量同步结果，证明空 event 的定时器路径会同步 `1-151` 且默认开启 `cacheImages`。
- `failedCount`、`failed`、`imageCacheFailedCount` 都为 0。
- `cacheImages` 为 `true`，单次或多批合计 `imageCachedCount` 不小于 151。
- `validateCache.ok` 为 `true`，详情、进化链、图片和同步新鲜度都达标。
- `getSyncStatus` 返回 `source: "cloud"`、`mode: "cloud"`、`cacheReady: true`、`healthTone: "ready"`，页面读取的聚合状态达标。
- `getSyncRuns` 能返回云端最近同步记录，包含上述 `runId`，且最近记录没有 `partial`、`failed` 或 `running`。

如果实际图片缓存允许少量失败，可以显式放宽阈值，例如：

```powershell
node tools\verify-miniapp-cloud-deploy-result.js --sync=tmp\wechat-cloud-sync-result.json --validate=tmp\wechat-cloud-validate-result.json --status=tmp\wechat-cloud-sync-status-result.json --runs=tmp\wechat-cloud-sync-runs-result.json --min-image-cached=145 --max-image-cache-failures=6
```

检查：

- 首页能加载今日宝可梦。
- 图鉴列表数量变为云缓存数量。
- 详情页能打开云端同步的宝可梦。
- 御三家详情页能显示云端同步的三段进化链。
- 猜谜能正常提交。
- 队伍分析能正常出结果。
- 「我的」页显示数据源为云开发缓存数据，并展示最近同步时间。
- 「我的」页同步健康显示为「已同步」，同步年龄不超过 `30h`。
- 「我的」页最近同步记录能看到最新同步批次；定时触发后，列表应出现新的成功记录。
- 「我的」页点击「云缓存自检」，结果为「通过」，数量为 `151 / 151`。
- 「我的」页图片缓存数量接近同步成功数量。

## 本地 smoke test

部署或切换云缓存前，优先跑一键 preflight：

```powershell
node tools\preflight-miniapp-cloud.js
```

它会串联检查本地配置形状、云部署工件、151 只真实数据快照、同步核心逻辑、PokeAPI 少量真实 dry-run、本地云函数闭环、JS 语法和 WXML 表达式风险。这个命令通过后，再进入真实微信云环境部署和 151 只云端同步。

不用云环境，先验证同步转换逻辑：

```powershell
node tools\test-miniapp-sync-core.js
```

直接从 PokeAPI 拉取少量真实数据并转换，但不写云数据库：

```powershell
node tools\smoke-miniapp-pokeapi-sync.js 3
```

这个 smoke test 还会下载第一张官方图并输出将要使用的云存储路径，但不会上传到云存储。

本地模拟微信云环境，验证 `syncPokeapi -> 云数据库/云存储 -> pokedex` 闭环：

```powershell
node tools\smoke-miniapp-cloudfunctions-local.js
```

这个脚本会 mock `wx-server-sdk`，同步 3 只真实 PokeAPI 数据，模拟上传图片到云存储，再用 `pokedex` 查询列表、详情、进化链和同步状态。它不会访问真实微信云环境。

## 本地真实数据快照

云开发是主链路；本地快照是部署云函数前的兜底和验收工具。它可以把 PokeAPI 真实数据生成到小程序包内，让 `useCloudApi: false` 时也能使用同一套转换字段。

只验证不写文件：

```powershell
node tools\generate-miniapp-pokemon-snapshot.js --limit 12 --dry-run
```

生成默认快照文件：

```powershell
node tools\generate-miniapp-pokemon-snapshot.js --limit 151
```

验证快照质量：

```powershell
node tools\validate-miniapp-pokemon-snapshot.js
```

默认输出：

```text
wechat-miniapp/miniprogram/data/generated-pokemon.js
```

小程序端会优先使用这个生成快照；如果文件为空，则回退到手写的 12 只种子数据。生成快照适合开发和离线兜底，生产仍建议使用云数据库 + 云存储图片缓存。

云端 `pokedex` 查询函数会分页读取 `pokemon_summary`，不会在完整图鉴超过 1000 条时静默截断。同步/快照生成也会在同一轮运行中复用 PokeAPI 进化链请求，减少重复访问。

## 8. 图片域名注意

如果没有开启 `cacheImages`，`syncPokeapi` 会保存 PokeAPI 返回的远程图片地址。微信小程序真机预览和发布时，需要配置合法图片域名。

更稳的生产方案是开启：

```json
{
  "cacheImages": true
}
```

这样数据库里的 `image` 会使用微信云存储 fileID，小程序首屏不再依赖 PokeAPI 图片域名实时加载。

## 9. 下一步优化

- 为中文名称、分类、招式说明补本地化修正表。
- 给 `pokemon_summary` 增加按属性和世代的查询索引。
