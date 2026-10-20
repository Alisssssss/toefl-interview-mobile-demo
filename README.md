# Speak 40 — TOEFL Interview Mobile Demo

一个面向手机端的 TOEFL Interview 口语训练原型。页面直接读取：

在线使用：<https://alisssssss.github.io/toefl-interview-mobile-demo/>

```text
data/interview-data.json
```

## 本地运行

由于浏览器对本地 JSON 和麦克风权限有限制，请通过本地服务器打开，不要直接双击 `index.html`：

```bash
cd /Users/coo/Documents/Projects/toefl-interview-mobile-demo
python3 -m http.server 8012
```

然后访问：

```text
http://localhost:8012
```

## Demo 功能

- 首页展示40套题及核心 Topic。
- 每完成四题一轮，套题按钮加深一阶绿色。
- 训练次数通过 `localStorage` 保存在当前浏览器。
- Scenario Prompt 可随页面向上滑走。
- 四道题通过横向滑动切换。
- 每题支持最长45秒录音、提前停止和本页回放。
- 每题的漂浮灯泡可展开一篇或多篇范答。
- 拖选范答文字即可高亮；点击已高亮片段可取消，标记保存在当前浏览器。
- 音频不会上传或永久保存；刷新页面后录音文件消失，完成次数仍保留。
