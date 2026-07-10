# PTCG Pocket 小程序频道

PTCG Pocket 在小程序中是与宝可梦图鉴、实体 PTCG 卡牌图鉴同级的独立频道。底部导航使用第 5 个 tab `Pocket`，首页顶部同时提供“宝可梦 / 实体卡牌 / Pocket”三频道切换。

## 页面

| 页面 | 路径 | 内容 |
| --- | --- | --- |
| Pocket 频道 | `pages/pocket/index` | 搜索、常用入口、今日卡牌、活动、热门卡组、最近查看 |
| Pocket 卡牌图鉴 | `pages/pocket-carddex/index` | 分页、搜索、扩展包/稀有度/卡牌类型筛选、收藏和拥有状态 |
| Pocket 卡牌详情 | `pages/pocket-card-detail/index` | 卡图、繁中名称、HP、属性、弱点、撤退、招式、特性、编号和获得方式 |
| 活动与任务 | `pages/pocket-events/index` | 活动、任务、对战、商店四个视图 |
| 热门卡组 | `pages/pocket-hot-decks/index` | 使用数、使用率、胜率和赛事成绩 |
| 卡组详情 | `pages/pocket-deck-detail/index` | 20 张代表赛事牌表、缩略图、繁中卡名和一键复制 |
| 模拟开包 | `pages/pocket-pack/index` | 正式卡包选择、手动开包、5 卡位和稀有包结果 |

Pocket 收藏、拥有和最近查看使用 `pokechill:pocket:*` 独立存储键，不与实体卡牌状态混用。

## 图片

小程序不会直接请求 GitHub 卡图。服务端通过以下地址代理并按需缓存：

```text
GET /assets/pocket/cards/:id
server/.data/pocket-assets/cards/
```

这样可以减少微信端跨域配置和 GitHub 限流导致的空图。开发环境默认地址由 `miniprogram/config.local.js` 指向 `http://127.0.0.1:8787`。

## 验证

```powershell
node tools\check-pocket-miniapp.js
node tools\validate-pocket-cache.js
node tools\smoke-pocket-api.js
```

微信开发者工具预览编译：

```powershell
& 'C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat' preview `
  --project 'F:\pokechill\wechat-miniapp' `
  --port 9420
```
