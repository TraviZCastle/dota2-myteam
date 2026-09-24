# 游戏首页二维码

`game-qr.png` 编码 `https://dota2-myteam.vercel.app/`，指向游戏首页，不含玩家数据。

使用 Python qrcode 8.2 生成，纠错级别 Q、四模块静区、每模块 10 px；原图 370 × 370。使用 zxing-cpp 2.3.0 独立解码验证。网站和长图只使用静态 PNG，没有第三方二维码接口或运行依赖。

变更公网首页域名时，同时更新 `career.js` 的 HOME、`career-view.js` 的页脚文本及这张二维码，并重新独立解码验证。
