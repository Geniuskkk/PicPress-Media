# PicPress Media 前端

这里是 PicPress Media 的 Vue 3 + TypeScript 渲染进程。Electron 主进程会加载
`frontend` 的构建结果，开发时由 Vite 提供热更新。

## 常用命令

```bash
npm install
npm run dev       # 仅启动 Vite 前端
npm run typecheck # TypeScript 检查
npm run build     # 类型检查并构建前端
```

从仓库根目录启动完整 Electron 开发环境请执行 `npm run dev`。图片和视频请求通过
`src/utils/api.ts` 发往本机 Go sidecar；在浏览器开发模式下则使用 Vite 代理。

页面使用 hash 路由，以兼容 Electron 打包后的 `file://` 页面。上传的文件和处理结果
只保留在本地浏览器上下文中，不会上传到外部服务。
