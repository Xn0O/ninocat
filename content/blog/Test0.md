---
title: Blog相关
date: 2026-04-22
summary: 写一下使用说明吧
tags: Blog,本站
cover: ./assets/Blog/P0/P0.jpg
hidden: 0
---

# BlogEditor页面说明
-------
* 使用步骤：
>1.先选择blog图片存放的主文件如assets/Blog
>2.填blog文章的文件名：如P1
>3.点击创建并切换，会自动创建以P1为名的文件夹：如assets/Blog/P1
>4.可以把外界的图片test.png拖进图片框，会自动复制图片到assets/Blog/P1，并自动填写图片地址在blog正文
>5.关于加密文章的密码：在私有目录tools/secrets里填入和编辑
>6.将MD导出至ninocat_private/content/blog中
>7.运行ninocat_page的 **update-posts-index.bat** 与 **add-post.bat** 进行导入文章和添加文章列表
------
# 发布
* 直接push origin即可
------
游戏页面的外链格式：
```json
    {
      "id": "remote-unity-example",
      "title": "外部网页",
      "description": "外部地址示例；若内嵌被拦截会自动提示新标签打开。",
      "status": "外部",
      "category": "test",
      "cover": "./assets/Blog/P0/P0.jpg",
      "coverHover": "./assets/Blog/P0/P1.jpg",
      "embedUrl": "https://example.com/unityweb/index.html",
      "openUrl": "https://example.com/unityweb/index.html",
      "launchMode": "auto",
      "tags": "远程|外部",
      "order": 99
    }
```