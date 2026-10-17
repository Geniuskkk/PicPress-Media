# Electron Forge 迁移记录

迁移日期：2026-10-17。本次迁移随 v2.2.0 发布。

## 构建与目录

- 使用 Electron Forge 8 的 Vite 插件替代 electron-vite 和 electron-builder。
- Node 依赖和锁文件统一放在根目录，删除前端独立安装步骤。使用 Node 24 LTS（24.20+）执行 `npm ci`。
- `forge.config.ts` 负责开发启动、应用打包、安装包制作和资源钩子；三个 `vite.*.config.ts` 分别编译主进程、preload 和 Vue 页面。
- 主进程和 preload 输出 `.vite/build/main.cjs`、`preload.cjs`；页面输出 `.vite/renderer/main_window/`。配置文件使用 ESM。
- `npm start`、`npm run package`、`npm run make` 自动编译 Go sidecar。`npm run build:web` 只编译页面。
- `package` 输出 `out/PicPress Media-<platform>-<arch>/`；`make` 输出 `out/make/`。
- 保留 ffmpeg/ffprobe 运行时依赖并解包二进制。Go sidecar 和动态库放入 `resources/bin/`。macOS 在最终签名前复制、修正并验证 libvips 动态库；Windows 按依赖递归复制 MinGW DLL；Linux 使用系统 libvips。
- 显式收集 HEIF/AVIF 动态插件及其编解码依赖，设置打包后的插件搜索路径。Fedora 安装依赖包含 `vips-heif`，Windows 构建依赖包含 `libheif`；仅复制 libvips 主库会使 AVIF 输出不可用。

## 主要版本

版本按迁移时稳定版查询结果固定，并提交单一锁文件。

| 组件 | 原版本声明 | 当前版本 |
| --- | --- | --- |
| Electron | 42.7.0 | 44.9.0 |
| 构建工具 | electron-builder 26.15.7 / electron-vite 4.0.1 | Electron Forge 8.0.1 |
| Vite / Vue 插件 | 7.3.6 / 6.0.8 | 8.3.4 / 6.0.10 |
| Vue | 3.5.40 | 3.5.44 |
| Vue Router | 4.6.4 | 5.4.0 |
| Pinia | 2.3.1 | 4.1.0 |
| Tailwind CSS | 3.4.19 | 4.3.3 |
| CropperJS | 1.6.2 | 2.3.1 |
| 图标 | lucide-vue-next 0.577.0 | @lucide/vue 1.59.0 |
| JSZip | 3.10.1 | 3.10.2 |
| TypeScript / vue-tsc | 5.9.3 / 3.3.7 | 6.0.3 / 3.3.13 |
| Go | 1.26.2 | 1.27.2 |
| chi | 5.3.1 | 5.5.0 |
| bimg | 1.1.9 | 1.1.9（保持最新稳定版） |
| ffmpeg-static / ffprobe-static | 5.3.0 / 3.1.0 | 保持最新稳定版 |

TypeScript 7.0.2 实测无法与 vue-tsc 3.3.13 配合运行：vue-tsc 加载 `typescript/lib/tsc` 时抛出 `ERR_PACKAGE_PATH_NOT_EXPORTED`。因此保留 TypeScript 6.0.3；没有使用 `legacy-peer-deps` 或新增 `skipLibCheck` 来绕过故障。

`@types/node` 使用匹配 Node 24 LTS 的 24.19.2，未跨到 Node 26 类型。ffmpeg/ffprobe 的 npm 包已是最新稳定版，但其中的二进制由上游包维护，不等同于 FFmpeg 项目最新版本。

Tailwind 4 改用官方 Vite 插件、CSS 主题和自定义 dark 变体。CropperJS 2 改为 Web Components API：从选区按原图分辨率导出无损 PNG，再交给 Go 缩放、编码。旋转、翻转和裁剪不会重复提交到后端；独立 API 客户端仍可使用 Go 的变换参数。

大图预览修复：Cropper 的居中方法依赖平移能力，初始化和旋转时临时允许程序平移；日常鼠标拖动仍操作选区。窗口变化时重新适配图片并保留裁剪内容和输出尺寸。选区启用浮点坐标，避免预览像素舍入导致大图越界或导出少一个像素。

## 安装包与 CI

| 平台 | 格式 | 构建环境 |
| --- | --- | --- |
| macOS arm64 | DMG + ZIP | macos-14 |
| Windows x64 | Squirrel Setup.exe、nupkg、RELEASES | windows-latest + MSYS2 UCRT64 |
| Debian / Ubuntu x64 | DEB | ubuntu-22.04 |
| Fedora x64 | RPM | Fedora 44 容器 |

Windows 旧版 NSIS 安装应先卸载；Squirrel 不会接管原安装目录。Linux 不再生成 AppImage，安装时由包管理器解决系统库依赖。RPM 在 Fedora 内编译，避免使用链接 Ubuntu 库的 Go 二进制。容器中仅将当前 GITHUB_WORKSPACE 加入 Git safe.directory，保证 Go 可以读取 VCS 状态；Windows 使用 UCRT64 工具链及对应的 libvips/libheif 包。

由于 CGO、libvips 和 ffmpeg 的原生依赖，构建脚本拒绝跨平台或跨架构打包。Intel Mac 需在 Intel 环境执行 `npm run dist:mac:x64`。

CI 在版本标签上构建并发布，手动触发只生成构建产物。设置 `APPLE_SIGNING_IDENTITY` 可启用 macOS 身份签名；本次本地构建未配置开发者证书和公证。

## 发布构建兼容性修复

- Windows 的 `objdump -p` 会输出大量导出和展开表；DLL 依赖扫描改为流式逐行读取，避免同步调用默认缓冲区的 `ENOBUFS`，并在工具执行失败时保留诊断信息。
- Fedora 44 的 RPM 会进入独立构建子目录。使用 `build/rpm.spec.ejs` 从 `%{_topdir}/BUILD/usr/.` 复制暂存文件，避免上游模板的相对路径 `usr/*` 找不到文件。模板保留上游 MIT 许可。
- `npm run test:packaging` 验证超过默认缓冲区的大输出、分段行与子进程错误；CI 安装依赖后运行。

## 验证命令

```bash
npm ci
npm run typecheck
npm run test:packaging
npm run build:web
go test ./...
npx playwright install chromium
npm test
npm run make
npm run smoke:package
npm run smoke:electron
```

本地 macOS arm64 已验证：

- Electron/config 和 Vue 类型检查；Go 包编译检查（当前 Go 包没有单元测试）。
- 最终锁文件的干净 `npm ci` 和 Forge 开发启动。
- 13 项浏览器回归：原图分辨率、顺时针旋转、水平和垂直翻转、旋转后翻转、比例与照片尺寸预设/深色模式/导航、EXIF 方向、大图拖入/窗口缩放后保留裁剪、竖图与小图居中、贴边手柄拖动、手动输入尺寸及窗口缩放后保持。
- 打包应用的健康检查、PNG/JPG/WebP/AVIF 图片缩放、MP4/H.264 和 WebM/VP9 编码。
- 打包 Electron 的 file:// 加载、preload 端口注入、真实图片处理、哈希路由刷新、macOS 隐藏/恢复窗口和退出后 Go 服务关闭。
- macOS 动态库依赖路径和 sidecar/动态库签名检查由打包钩子执行。

Windows、Linux 和 macOS x64 的安装验证仍需在对应平台执行；CI 已配置，尚未远程运行。`smoke:electron` 需要桌面会话，当前 CI 在 macOS 执行。

## 已知上游依赖问题

`npm audit` 仍报告 DMG 制作工具链中的 4 项 high 记录，来自同一条 `image-size → appdmg → electron-installer-dmg → @electron-forge/maker-dmg` 依赖链。这些是构建工具，不进入应用运行时依赖。当前 Forge Maker 没有兼容的自动修复；未强制覆盖不兼容的大版本。应跟踪上游修复后更新锁文件。

参考：[Forge 8 发布说明](https://github.com/electron/forge/releases/tag/v8.0.1)、[Forge 文档](https://www.electronforge.io/)、[CropperJS 2 迁移指南](https://fengyuanchen.github.io/cropperjs/migration.html)。
