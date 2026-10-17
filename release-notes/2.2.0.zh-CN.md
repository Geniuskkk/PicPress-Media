# PicPress Media v2.2.0

## 更新内容

- 重新设计应用图标：暖白底、石墨黑裁剪符号与朱红播放标记，统一 macOS、Windows、Linux 和前端资源；修复 macOS 运行时图标加载方式，补充 Windows 多 DPI 图标尺寸。
- 升级 CropperJS 2，按原图分辨率导出裁剪结果，改善大图居中、旋转、翻转和窗口缩放后的裁剪保持。
- 自定义宽高确认后同步更新裁剪框，修复贴边裁剪框手柄难以拖动的问题。
- 修复页面不必要的上下滚动。感谢 @1257992879 的贡献（[#2](https://github.com/Geniuskkk/PicPress-Media/pull/2)）。
- 迁移至 Electron Forge 8，升级 Electron、Vue 和构建依赖，统一根目录依赖管理。
- 完善 HEIF/AVIF 插件和原生依赖打包，修复 Windows DLL 扫描、Linux Maker 配置及 Fedora RPM 暂存路径问题。

## 下载与安装

- **macOS（Apple Silicon arm64）**：提供 DMG 和 ZIP。Intel Mac 需另行在 Intel 环境构建。
- **Windows（x64）**：使用 Squirrel `Setup.exe`。旧版 NSIS 安装请先卸载。
- **Linux（x64）**：提供 DEB 和 RPM，运行依赖由系统包管理器安装。

图片和视频处理均在本地完成，ffmpeg 随应用内置。

**完整变更：** [v2.1.0 → v2.2.0](https://github.com/Geniuskkk/PicPress-Media/compare/v2.1.0...v2.2.0)
