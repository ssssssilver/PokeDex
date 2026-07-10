# OSS 静态数据版部署

## 目标

线上小程序只读取阿里云 OSS，不运行 Node API。PokeAPI、PTCG、Pocket、Limitless 和 ProjectPokemon 的同步任务继续在本地执行，生成不可变版本快照后上传 OSS。

不适合放进 OSS 的能力只有账号、跨设备收藏、支付、排行榜和用户投稿等写操作。当前工程的收藏、最近查看、队伍和开包记录都保存在微信本地存储，因此本版本不需要后台。

## 静态契约

- `manifest.json`：当前线上版本指针，最后上传。
- `releases/<version>/`：不可变数据版本。
- `pokemon|ptcg|pocket/list/*.json`：列表分片。默认首屏只读取一个分片。
- `pokemon|ptcg|pocket/details/*.json`：128 个详情哈希桶，最大对象限制为 4 MB。
- `meta/*.json`：筛选项、属性关系、活动、卡包和同步状态。
- `decks/*.json`：实体卡与 Pocket 热门卡组及详情。
- `assets/`：可选的 OSS 图片镜像和 ProjectPokemon 3D GIF。

搜索和组合筛选首次使用时会加载对应图鉴的全部列表分片，当前会话内复用；详情始终只读取一个哈希桶。猜谜答案、队伍分析和模拟开包在小程序端计算。

## OSS 设置

1. 使用独立 Bucket 或独立前缀，开启公网只读或通过 CDN 公开读取。不要把 AccessKey 放入小程序。
2. 绑定已备案的 HTTPS 自定义域名。微信小程序后台把该域名加入 `request` 和 `downloadFile` 合法域名。
3. CORS 允许 `GET`、`HEAD`，允许请求头 `Content-Type`、`Cache-Control`。
4. `releases/` 与 `assets/` 可使用长期缓存；`manifest.json` 建议使用 `Cache-Control: no-cache`。
5. 为 `releases/` 配置生命周期规则，只保留最近若干版本。

## 小程序配置

在被 `.gitignore` 忽略的 `wechat-miniapp/miniprogram/config.local.js` 中配置：

```js
module.exports = {
  useStaticApi: true,
  staticBaseUrl: 'https://static.example.com/pokechill',
  useRemoteApi: false,
  useCloudApi: false,
  requestTimeoutMs: 15000,
  pageSize: 30
};
```

`staticBaseUrl` 指向包含 `manifest.json` 的目录，不带末尾斜杠。

## 本地构建与验证

```powershell
node tools/build-oss-snapshot.js
node tools/test-oss-static-api.js
node tools/check-oss-static-readiness.js
```

完整镜像所有图鉴图片会产生较大下载量，可断点续跑：

```powershell
node tools/sync-oss-assets.js --datasets=pokemon,ptcg,pocket --concurrency=8
node tools/build-oss-snapshot.js
```

未镜像的图片保留可靠的上游 HTTPS 地址；完成镜像后，下一次构建会自动改写为 `/assets/` 下的 OSS 地址。

## 发布

先安装并配置阿里云 `ossutil`，凭证只保存在本机。发布脚本使用 `-u` 跳过 OSS 中已存在且较新的资源，先上传不可变版本和资源，最后切换根 `manifest.json`：

```powershell
.\tools\publish-oss-static.ps1 -Bucket your-bucket -Prefix pokechill
```

完整定时任务：

```powershell
.\tools\sync-and-publish-oss.ps1 -Bucket your-bucket -Prefix pokechill
```

可用 Windows 任务计划程序定时执行。宝可梦图鉴可每周更新，实体卡和 Pocket 每日更新，热门卡组每 6 小时更新。

上线回滚只需把目标历史版本内的 `manifest.json` 重新上传到根目录；数据版本本身不会被覆盖。
