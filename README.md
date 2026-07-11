# PokeChill

PokeChill 定位为「宝可梦图鉴 + PTCG 卡牌图鉴 + Pocket 图鉴 + 轻玩法盒子」。

微信小程序已经在 `miniapp-v1.0.0` 标签封版，后续产品开发转向 Taro Web：

- `web/`：Taro 4.2 + React 的 Web/H5 主工程。
- `wechat-miniapp/`：已封版的微信原生小程序工程。
- `server/`：自有 Node 中转服务和本地数据同步服务。
- `tools/`：数据同步、OSS 发布、检查和验证脚本。
- `docs/`：需求、部署和本地测试文档。

## Web development

```powershell
cd web
npm install
npm run dev
```

生产构建：

```powershell
cd web
npm run build
```

Web 默认使用阿里云 OSS 静态数据，不依赖本地 Node 服务。构建产物位于 `web/dist/`。

如需维护已封版的小程序，可从 `miniapp-v1.0.0` 标签创建修复分支，并用微信开发者工具导入 `wechat-miniapp/`。

## Documentation

- `web/README.md`
- `docs/oss-static-deployment.md`
- `docs/self-hosted-api.md`
- `wechat-miniapp/README.md`
