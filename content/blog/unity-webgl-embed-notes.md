---
title: 网页引擎内嵌笔记
date: 2026-04-21
summary: 使用弹窗内嵌预览，并在远程站点阻止嵌入时回退到新标签打开。
tags: 引擎, 网页图形, 内嵌
cover: ./assets/hero-game.svg
---

我的网页引擎导出目录在：

`games/aio_Web/`

建议保留以下结构：

- `index.html`
- `Build/`
- `TemplateData/`

## 弹窗内嵌流程

当用户点击游戏卡片时：

1. 打开弹窗。
2. 给内嵌窗口设置游戏地址。
3. 允许全屏与手柄权限。

## 跨站回退策略

对于远程地址：

- 若允许嵌入，则在弹窗中正常加载。
- 若被 `X-Frame-Options` 或 CSP `frame-ancestors` 拦截，则显示“新标签打开”按钮。
