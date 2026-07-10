# PTCG Pocket 数据采集

PTCG Pocket 是独立的手机网络游戏频道，数据和实体 PTCG 完全分开存储。运行时缓存位于 `server/.data/pocket-cache.json`，原始来源快照位于 `server/.data/pocket-sources/`；两者均不会提交到 Git。

## 数据来源

| 来源 | 用途 |
| --- | --- |
| RaenonX `global-master` | 卡牌规则、卡包、扩展、装饰、道具、预设牌组与排位主数据 |
| RaenonX `event-brief` | 当前及预告活动、任务组、商店、单人战、PvP、神奇挑选 |
| RaenonX 繁中页面载荷 | 繁中卡名、招式、特性、任务、活动、商店和道具文本 |
| `chase-mew/pokemon-tcg-pocket-cards` | 英文名、卡图、系列和卡包交叉校验 |
| `flibustier/pokemon-tcg-pocket-database` | 系列发布日期、稀有度和抽包概率 |
| `bcollazo/deckgym-core` | 英文对战规则、招式、能量、弱点和撤退数据 |
| Limitless Pocket | 当前赛制热门卡组、使用率、胜率、代表宝可梦和赛事牌表链接 |

采集器只请求匿名公开资源，不执行登录、游戏账号同步或付费权限绕过。每份原始快照都会记录 URL、抓取时间、字节数、SHA-256、ETag 和新鲜度；网络暂时失败时可以回退到上一次原始快照，并将来源标记为 `stale-cache`。

## 同步与校验

```powershell
node tools\sync-pocket-data.js
node tools\validate-pocket-cache.js
node tools\smoke-pocket-api.js
```

只验证远端解析、不替换当前归一化缓存：

```powershell
node tools\sync-pocket-data.js --dry-run
```

也可以在服务启动后触发：

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8787/api/sync/pocket -ContentType 'application/json' -Body '{}'
```

## 查询接口

```text
GET /api/pocket/cards
GET /api/pocket/cards/:id
GET /api/pocket/expansions
GET /api/pocket/packs
GET /api/pocket/packs/:id
GET /api/pocket/rarities
GET /api/pocket/pull-rates
POST /api/pocket/open-pack
GET /api/pocket/events
GET /api/pocket/missions
GET /api/pocket/battles
GET /api/pocket/shops
GET /api/pocket/wonder-picks
GET /api/pocket/profile-decorations
GET /api/pocket/peripheral-goods
GET /api/pocket/rental-decks
GET /api/pocket/preset-decks
GET /api/pocket/pvp-ranks
GET /api/pocket/hot-decks
GET /api/pocket/hot-decks/:id
GET /api/pocket/meta
GET /api/pocket/sync-status
GET /api/pocket/sync-runs
POST /api/sync/pocket
GET /api/pocket/scheduler
POST /api/pocket/scheduler/run
```

卡牌列表支持 `q`、`expansion`、`rarity`、`type`、`page` 和 `pageSize`。活动列表支持 `type`、`status`、`page` 和 `pageSize`，其中 `status` 为 `current`、`upcoming`、`permanent` 或 `expired`。

服务启动后会启用独立的 Pocket 调度器：默认每 6 小时检查，缓存少于 3000 张卡或超过 8 小时未同步时更新。可用 `POKECHILL_POCKET_SYNC_SCHEDULER`、`POKECHILL_POCKET_SYNC_INTERVAL_HOURS`、`POKECHILL_POCKET_MAX_SYNC_AGE_HOURS` 和 `POKECHILL_POCKET_MIN_CARD_COUNT` 调整。

## 数据边界

- RaenonX 主数据按唯一游戏卡牌对象存储；同一张卡在多个扩展复刻时通过 `collections` 保留全部图鉴编号。
- 招式和特性说明保留繁中模板及原始结构化效果，模板中的动态数值占位符暂不提前渲染。
- 活动摘要包含公开的时间、奖励、卡牌池、概率和规则。若某类任务目标没有出现在公开响应中，不构造猜测数据。
- 第三方图片和数据仍受各来源自身条款及宝可梦相关权利约束，生产发布前应复核使用范围。
