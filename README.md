# PokeChill

PokeChill 是一个微信原生小程序项目，定位为「宝可梦图鉴 + PTCG 卡牌图鉴 + 轻玩法盒子」。

当前工程已经收口到小程序方向：

- `wechat-miniapp/`：微信原生小程序工程。
- `server/`：自有 Node 中转服务，负责 PokeAPI/PTCG 数据缓存、图片代理、3D GIF 资源和热门卡组接口。
- `tools/`：小程序与自有服务端相关的同步、检查和验证脚本。
- `docs/`：需求、部署和本地测试文档。

本地开发常用入口：

```powershell
node server\index.js
```

然后用微信开发者工具导入：

```text
wechat-miniapp/
```

默认本地 API 地址为 `http://127.0.0.1:8787`。私有配置写入 `wechat-miniapp/miniprogram/config.local.js`，该文件不会提交。

更多说明：

- `docs/self-hosted-api.md`
- `docs/wechat-miniapp-v2-ptcg-requirements.md`
- `wechat-miniapp/README.md`
