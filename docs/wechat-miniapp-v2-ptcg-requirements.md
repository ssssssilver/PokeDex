# PokeChill 微信小程序 V2 需求：宝可梦图鉴 + 卡牌图鉴

更新日期：2026-07-09

## 目标

在现有宝可梦图鉴基础上，增加 PTCG 卡牌图鉴，并把小程序从「图鉴 + 玩法 Tab」升级为「双图鉴 + 轻玩法入口」。

V2 的产品定位：

```text
首页发现 -> 宝可梦图鉴 / 卡牌图鉴 -> 详情 -> 收藏 / 记录 -> 轻玩法 -> 回到图鉴
```

核心变化：

- 底部 Tab 从 `首页 / 图鉴 / 玩法 / 我的` 调整为 `首页 / 宝可梦图鉴 / 卡牌图鉴 / 我的`。
- 原「玩法」不再作为底部一级入口，移动到首页快捷入口和「我的」里的玩法记录/工具区。
- 新增卡牌图鉴列表、卡牌详情、卡牌收藏、卡牌数据同步和对应轻玩法。
- 数据层继续走自有服务器中转缓存，不让小程序实时直连 PokeAPI 或 PTCG 上游。

## 当前基础

已经具备：

- 微信原生小程序工程：`wechat-miniapp/`
- 自有 Node 服务：`server/`
- 宝可梦图鉴 API：`/api/pokemon`、`/api/pokemon/:id`
- 完整宝可梦图鉴缓存、分页、详情页、中文描述、招式、特性、进化链和属性关系
- 首页、宝可梦图鉴、宝可梦详情、猜谜、队伍分析、属性克制、我的

V2 不推翻这些能力，只调整信息架构并增加卡牌数据线。

## 数据源评估

PTCG 数据建议参考：

- `PokemonTCG/pokemon-tcg-data`：包含 Pokémon TCG API 使用的原始 JSON 数据，仓库中有 `cards/en`、`decks/en`、`sets` 等目录。
- `docs.pokemontcg.io`：提供 V2 REST API 文档，卡牌、系列、类型、稀有度等查询能力齐全。

自有服务仍然是必需的：

- 小程序不应该直接请求上游 API，避免合法域名、跨境网络、限流和 API key 暴露问题。
- 卡牌图片数量大，必须由服务端缓存或转存，不能把图片打进小程序包。
- 列表数据量大，需要服务端分页、字段裁剪、搜索索引和缓存版本管理。
- 后续玩法需要自己的收藏、拥有状态、每日题目、随机种子和统计数据。

需要特别注意：

- `PokemonTCG` 主数据以英文为主。第一版可以先翻译固定枚举，例如属性、稀有度、卡牌大类、合法赛制；卡牌效果文本如无可靠中文来源，先保留英文，并在详情页做清晰展示。
- PTCG API 的价格字段来自第三方市场，不适合作为第一版核心功能。V2 暂不做行情价格，避免数据准确性和合规风险。
- PTCG Pocket 与传统 Pokémon TCG 不是同一套数据，V2 默认不做 Pocket。

## 底部 Tab 调整

### 首页

定位：双图鉴发现入口 + 今日内容 + 高频轻玩法。

首页模块调整为：

- 顶部搜索：支持切换 `宝可梦` / `卡牌` 搜索目标。
- 今日宝可梦。
- 今日卡牌。
- 快捷入口：
  - 宝可梦图鉴
  - 卡牌图鉴
  - 每日猜宝可梦
  - 今日卡牌挑战
  - 队伍分析
  - 属性克制
- 最近查看：分为宝可梦最近查看和卡牌最近查看，最多展示各 5 条。
- 收藏入口：宝可梦收藏、卡牌收藏。

首页不做长说明，不做营销式落地页。

### 宝可梦图鉴

原「图鉴」Tab 改名为「宝可梦图鉴」。

保留现有能力：

- 中文名、英文名、日文名、编号搜索。
- 属性、世代、地区图鉴筛选。
- 编号、名称、种族值排序。
- 分页加载，避免 `setData` 数据过长。
- 进入宝可梦详情。
- 收藏和最近查看。

新增联动：

- 宝可梦详情页增加「相关卡牌」区域。
- 宝可梦详情页可跳转到卡牌图鉴并自动筛选该宝可梦的卡牌。

### 卡牌图鉴

新增底部一级 Tab。

列表核心功能：

- 搜索：卡牌名、宝可梦名、卡牌编号、系列名、画师。
- 筛选：
  - 系列 / 扩展包
  - 卡牌大类：Pokémon / Trainer / Energy
  - 属性：Grass / Fire / Water 等
  - 稀有度
  - 规则标记：regulation mark
  - 赛制合法性：Standard / Expanded / Unlimited
  - 阶段或子类型：Basic、Stage 1、Stage 2、ex、V、VMAX 等
- 排序：
  - 发售时间
  - 系列内编号
  - 名称
  - 稀有度
- 分页：建议每页 24 到 40 张，图片懒加载。

列表项信息：

- 卡图缩略图。
- 卡牌名。
- 系列名和系列编号。
- 稀有度。
- 类型/属性标签。
- 收藏或拥有状态。

空状态：

- 无搜索结果。
- 数据源未同步。
- 图片加载失败但文本可用。

### 我的

定位：个人记录、收藏、数据状态、设置。

新增/调整模块：

- 宝可梦图鉴进度。
- 卡牌收藏和拥有进度。
- 最近查看：宝可梦 / 卡牌。
- 玩法记录：每日猜宝可梦、今日卡牌挑战。
- 数据源状态：
  - 宝可梦缓存状态。
  - 卡牌缓存状态。
  - 最近同步时间。
  - 图片缓存数量。
  - 同步失败数量。
- 设置：
  - 清理本地缓存。
  - 数据源说明。
  - 免责声明。

原「玩法」Tab 页面可以暂时保留为二级页面，入口从首页和我的进入。

## 新增页面

### 卡牌图鉴列表页

路径建议：`pages/carddex/index`

主要状态：

- 首次加载。
- 搜索中。
- 筛选面板打开。
- 有结果。
- 无结果。
- 加载下一页。
- 同步数据不可用。

交互要求：

- 搜索框常驻顶部。
- 筛选项点击后弹出，不在首屏铺满所有筛选。
- 筛选面板支持重置和确认。
- 已应用筛选用短标签展示。
- 列表分页加载，不能一次性 `setData` 全量卡牌。

### 卡牌详情页

路径建议：`pages/card-detail/index`

信息分区：

- 顶部卡图：大图预览，支持点击查看高清图。
- 基础资料：卡名、系列、编号、稀有度、画师、发售日期。
- 卡牌属性：
  - supertype
  - subtypes
  - HP
  - types
  - evolvesFrom / evolvesTo
  - regulationMark
  - legalities
- 能力和招式：
  - ability 名称、类型、效果。
  - attack 名称、能量费用、伤害、效果、总能量费用。
- 对战资料：
  - weaknesses
  - resistances
  - retreatCost
- 规则文本。
- 图鉴联动：关联全国图鉴编号和宝可梦详情入口。
- 操作：收藏、标记拥有、加入愿望单、分享。

中文化策略：

- 固定枚举翻译成中文。
- 宝可梦名优先复用现有宝可梦图鉴中文名。
- 卡牌效果文本第一版可保留英文，后续再接中文补充源。

### 系列列表和系列详情

V2.0 可先不放到底部 Tab，但卡牌筛选里要可用。

路径建议：

- `pages/card-sets/index`
- `pages/card-set-detail/index`

能力：

- 按系列、发售时间查看扩展包。
- 展示系列 logo、symbol、发售日期、总卡数、合法性。
- 进入某个系列后自动筛选该系列卡牌。

## 轻玩法需求

玩法不再占底部 Tab，但仍是产品留存的重要部分。

### 已有宝可梦玩法

继续保留：

- 每日猜宝可梦。
- 队伍属性分析。
- 属性克制速查。
- 随机挑战生成器。

入口移动：

- 首页快捷入口。
- 我的页玩法记录。
- 宝可梦详情页相关操作。

### 新增卡牌轻玩法

#### 今日猜卡牌

玩法：

- 每日 1 题。
- 根据卡图局部、属性、系列、稀有度、招式名等提示猜卡牌。
- 最多 5 次机会。
- 答案页进入卡牌详情。

MVP 可简化为：

- 给出 4 个选项。
- 卡图先模糊或只展示局部。
- 猜错后增加系列/属性/稀有度提示。

#### 今日开包

定位：纯图鉴随机发现，不涉及付费、交易或真实抽卡概率承诺。

玩法：

- 每日随机展示 5 到 10 张卡。
- 可按某个系列开包。
- 可收藏或标记拥有。
- 不展示真实市场价值。

合规边界：

- 不做付费。
- 不做概率承诺。
- 不做稀有卡价值刺激。
- 文案使用「随机发现」或「今日卡包」，避免商业抽卡语义过强。

#### 卡牌收藏册

玩法：

- 用户标记已拥有、想要、收藏。
- 展示按系列的收集进度。
- 展示按宝可梦的卡牌收集进度。

MVP：

- 本地存储优先。
- 后续再接用户服务端同步。

#### 认卡挑战

玩法：

- 根据卡牌招式、属性、弱点或系列猜对应宝可梦。
- 结果跳转宝可梦详情或卡牌详情。

这个玩法能把宝可梦图鉴和卡牌图鉴串起来。

#### 牌组轻分析

第一版只做轻工具，不做完整规则模拟。

能力：

- 用户选择最多 60 张或输入简化列表。
- 统计 Pokémon / Trainer / Energy 比例。
- 统计属性/能量分布。
- 提醒明显问题，例如能量过少、宝可梦过少。

V2 暂不做：

- 完整比赛合法性判断。
- 复杂规则引擎。
- 对战模拟。

## 数据模型草案

### `card_summary`

- id
- name
- name_zh
- supertype
- subtypes
- types
- hp
- set_id
- set_name
- set_series
- number
- rarity
- regulation_mark
- legalities
- national_pokedex_numbers
- artist
- image_small
- image_cached
- updated_at

### `card_detail`

- id
- name
- supertype
- subtypes
- level
- hp
- types
- evolves_from
- evolves_to
- rules
- ancient_trait
- abilities
- attacks
- weaknesses
- resistances
- retreat_cost
- converted_retreat_cost
- set
- number
- artist
- rarity
- flavor_text
- national_pokedex_numbers
- legalities
- regulation_mark
- images
- localized
- cached_at

### `card_set`

- id
- name
- series
- printed_total
- total
- legalities
- ptcgo_code
- release_date
- updated_at
- images
- image_cached

### `user_card_state`

本地或服务端均可：

- card_id
- favorite
- owned
- wishlist
- owned_count
- last_viewed_at

### `daily_card_challenge`

- date
- mode
- answer_card_id
- option_card_ids
- hints
- seed

## API 草案

卡牌图鉴：

```text
GET /api/cards?keyword=&setId=&series=&supertype=&subtype=&type=&rarity=&regulationMark=&format=&pokemonId=&page=&pageSize=&sort=
GET /api/cards/:id
GET /api/cards/:id/related-pokemon
GET /api/pokemon/:id/cards?limit=&page=
```

系列：

```text
GET /api/card-sets?keyword=&series=&page=&pageSize=&sort=
GET /api/card-sets/:id
GET /api/card-sets/:id/cards?page=&pageSize=
```

元数据：

```text
GET /api/ptcg/meta
GET /api/ptcg/sync-status
```

玩法：

```text
GET /api/card-quiz/daily
POST /api/card-quiz/daily/answer
GET /api/card-pack/daily?setId=
POST /api/card-collection/state
GET /api/card-collection/summary
```

同步和运维接口仅本地或后台使用，不暴露给小程序：

```text
POST /internal/sync/ptcg
GET /internal/sync/ptcg/status
```

## 后端同步方案

### 第一阶段：本地 JSON 缓存

适合当前开发阶段。

```text
pokemon-tcg-data / PTCG API
-> server 同步脚本
-> server/.data/ptcg-cache.json
-> /api/cards 分页查询
-> 微信小程序
```

要求：

- 支持全量同步卡牌和系列。
- 支持字段裁剪，列表接口不返回大字段和高清图。
- 支持分页和排序。
- 支持图片 URL 转本地缓存 URL。
- 同步失败时继续使用上一版缓存。

### 第二阶段：SQLite 或 Postgres

当卡牌数量和搜索筛选变复杂后迁移。

需要索引：

- card id
- name
- set_id
- series
- supertype
- subtypes
- types
- rarity
- regulation_mark
- national_pokedex_numbers
- release_date

### 图片缓存

原则：

- 小程序不直接引用上游图片。
- 服务端缓存 small 图用于列表，large 图用于详情。
- 列表优先 small，详情再加载 large。
- 图片失败时保留文字数据。

建议路径：

```text
server/.data/ptcg-images/cards/{cardId}.png
server/.data/ptcg-images/cards/{cardId}_large.png
server/.data/ptcg-images/sets/{setId}_symbol.png
server/.data/ptcg-images/sets/{setId}_logo.png
```

## 小程序性能要求

- 卡牌列表每页 24 到 40 条。
- 列表接口只返回摘要字段。
- 详情页单独请求完整字段。
- 图片懒加载，失败显示占位。
- 筛选选项用弹层，不把所有筛选平铺到首屏。
- 搜索输入防抖，避免每输入一个字就请求。
- 本地缓存最近查看、收藏和筛选偏好。
- 避免出现 `setData 数据传输长度过长`。

## 视觉和交互调整

全局：

- 保持微信小程序工具型风格，信息密度比游戏官网高一些。
- Tab 名称明确：`宝可梦图鉴` 和 `卡牌图鉴`，避免两个「图鉴」混淆。
- 卡牌图鉴可以使用卡面图片作为强视觉，但列表仍要克制，不能像瀑布流图片站。

卡牌列表：

- 建议两列卡图网格或单列信息列表二选一。
- MVP 推荐单列信息列表，稳定、易筛选、文本信息清楚。
- 后续可增加「卡图模式」切换。

详情页：

- 卡图优先，但文字信息要结构化。
- 能量费用用小圆点/标签展示。
- 弱点、抵抗、撤退费用使用清晰图标或色块。

## 成功标准

V2.0 达标标准：

- 用户打开首页后 3 秒内能理解现在有宝可梦图鉴和卡牌图鉴。
- 用户 2 次点击内能进入卡牌搜索。
- 卡牌图鉴可以分页浏览，不再触发数据传输过长警告。
- 卡牌详情能展示卡图、系列、编号、稀有度、属性、招式、弱点、抵抗和关联宝可梦。
- 自有服务可以在本地完成 PTCG 数据同步和查询。
- 小程序不依赖上游 PTCG API 实时请求。
- 至少一个卡牌轻玩法可用，例如今日猜卡牌或今日开包。

## V2 不做

- 不做完整 PTCG 对战模拟器。
- 不做完整牌组规则校验。
- 不做真实交易、估价、行情推荐。
- 不做付费开包。
- 不做实时多人玩法。
- 不做 PTCG Pocket。
- 不承诺第一版卡牌效果全文中文化。
- 不把卡牌图片打包进小程序代码包。

## 版本路线

### V2.0 信息架构和卡牌数据 PoC

- Tab 调整为 `首页 / 宝可梦图鉴 / 卡牌图鉴 / 我的`。
- 原玩法入口移动到首页和我的。
- 自有服务新增 PTCG 同步脚本。
- 本地缓存卡牌摘要、详情、系列。
- 卡牌列表和详情页可浏览。

### V2.1 图鉴联动

- 宝可梦详情页展示相关卡牌。
- 卡牌详情页展示关联宝可梦。
- 首页增加今日卡牌。
- 我的页增加卡牌收藏和最近查看。

### V2.2 卡牌收藏册

- 收藏、拥有、愿望单。
- 按系列展示收集进度。
- 按宝可梦展示卡牌进度。

### V2.3 卡牌轻玩法

- 今日猜卡牌。
- 今日开包。
- 认卡挑战。

### V2.4 体验和运维打磨

- 图片缓存状态。
- 同步健康检查。
- 分享卡片。
- 卡图模式切换。
- 更完整的中文本地化。

## 下一步拆工

1. 新增服务端 PTCG 数据适配层，先跑通本地同步和 `/api/cards`。
2. 新增卡牌图鉴页面目录和路由。
3. 调整 `app.json` 的 Tab：移除玩法 Tab，加入卡牌图鉴 Tab，重命名原图鉴为宝可梦图鉴。
4. 首页改为双图鉴入口，并把现有玩法卡片迁移进首页。
5. 我的页增加玩法入口、卡牌收藏、卡牌数据状态。
6. 增加卡牌详情页，并做宝可梦和卡牌的双向跳转。
7. 做第一款卡牌轻玩法，优先推荐「今日猜卡牌」。

## 参考资料

- PokemonTCG/pokemon-tcg-data: https://github.com/PokemonTCG/pokemon-tcg-data
- Pokémon TCG API docs: https://docs.pokemontcg.io/
- Card object fields: https://docs.pokemontcg.io/api-reference/cards/card-object/
- Search cards API: https://docs.pokemontcg.io/api-reference/cards/search-cards/
- Set object fields: https://docs.pokemontcg.io/api-reference/sets/set-object/
