# Firefox 英文网页翻译插件 — 任务拆分

> 依据文档：
> - 需求：[proposal.md](./proposal.md)
> - 架构：[design.md](./design.md)
> - 布局：[layouts/示意图-popup.md](./layouts/示意图-popup.md)、[layouts/示意图-options.md](./layouts/示意图-options.md)
>
> 说明：本任务清单供 AI 分步骤实现。每个任务模块**独立可完成、可验证**，完成后有可见效果；任务间仅保留必要依赖，按优先级从 P0 到 P3 依次推进。

## 1. 任务总览

| 优先级 | 任务 | 名称 | 依赖 | 完成后可见效果 |
| --- | --- | --- | --- | --- |
| P0 | T1 | 工程脚手架搭建 | 无 | 扩展可加载到 Firefox，Popup / Options 显示占位骨架 |
| P1 | T2 | 内容提取模块（Content Script） | T1 | 在文章页可看到提取出的标题 / 作者 / Markdown 原文 |
| P1 | T3 | 设置页（Options 配置） | T1 | 可保存并回填 API Key / Base URL / 模型名 |
| P1 | T4 | 翻译模块（Background 流式翻译） | T1、T3 | 可发起翻译并逐段收到中文译文（流式） |
| P2 | T5 | Popup 展示模块（md-wx + 打字机） | T1 | 用示例数据渲染出打字机效果的翻译界面 |
| P2 | T6 | 主流程串联（一键翻译全链路） | T2、T3、T4、T5 | 一键完成「提取 → 翻译 → 打字机展示」，可下载译文 |
| P3 | T7 | 打磨与验收（存储恢复 / 异常 / 样式） | T6 | 刷新恢复最近结果，异常有友好提示，界面完善 |

## 2. 任务详情

### T1 [P0] 工程脚手架搭建

- **目标**：搭建可运行的 Firefox 扩展工程骨架，打通构建与加载链路。
- **对应布局**：Popup 页面整体骨架（示意图-popup.md ② 翻译操作区的占位）、Options 页面整体骨架（示意图-options.md ① 顶部标题栏）。
- **内容要求**：
  - 基于 Vite + React + TypeScript 的多入口工程，包含 Content Script / Background / Popup / Options 四个入口。
  - manifest 采用 Firefox 兼容的 Manifest V3（background 使用 scripts 事件页方式），权限最小化（仅页面访问与存储所需权限），配置扩展图标。
  - 提供 `dev`（开发产物）与 `build`（发布产物）脚本，产物输出到 `dist/`，可被 Firefox「临时载入附加组件」加载。
  - Popup 与 Options 先渲染静态占位骨架（含标题与空内容区），Content Script 与 Background 为空壳监听。
- **涉及文件**：`package.json`、`vite.config.ts`、`tsconfig.json`、`public/manifest.json`、`src/popup/*`、`src/options/*`、`src/content/index.ts`、`src/background/index.ts`、`src/shared/*`。
- **验收 / 可见效果**：`npm run build` 成功产出 `dist/`；Firefox 临时加载后，点击工具栏图标可打开 Popup 占位页，右键扩展可打开 Options 占位页。
- **依赖**：无。

---

### T2 [P1] 内容提取模块（Content Script）

- **目标**：在目标页面提取文章并转换为 Markdown。
- **对应布局**：示意图-popup.md ③ 文章信息区所需的数据（标题 / 作者 / 原文链接），④ 内容展示区所需的数据（Markdown 原文）。
- **内容要求**：
  - 注入页面后，克隆 DOM 交给 `@mozilla/readability` 解析（不污染原页面），获取标题、作者、正文 HTML。
  - 用 `turndown` 将正文 HTML 转为 Markdown，保证图片转 `![alt](src)`、链接、代码块、列表语法不被破坏。
  - 监听「提取请求」消息，返回结构化结果 `{ title, author, url, markdown }`；非文章页或解析失败返回明确的错误码。
  - 在 `document_idle` 时机注入，兼顾 SPA 页面已渲染场景。
- **涉及文件**：`src/content/extractor.ts`、`src/content/converter.ts`、`src/content/index.ts`、`src/shared/types.ts`、`src/shared/messages.ts`。
- **验收 / 可见效果**：打开任意英文文章页，通过 Popup 调试区或控制台触发提取，可见文章标题、作者与转换后的 Markdown（图片为 `![alt](src)` 形式）；在无正文页面触发返回「未能识别文章内容」。
- **依赖**：T1。

---

### T3 [P1] 设置页（Options 配置）

- **目标**：实现 AI 模型服务配置的保存与读取。
- **对应布局**：示意图-options.md 全部模块（① 标题栏、② 配置表单区、③ 提示区、④ 保存操作、⑤ 状态反馈）。
- **内容要求**：
  - 表单包含：API Key（密码框，打码，不回填明文）、Base URL（默认 Qwen / DashScope 的 OpenAI 兼容端点）、模型名称（内置 `qwen-plus` / `qwen-turbo` / `qwen-max`，可自定义）。
  - 加载时从 `storage.local` 读取配置回填（API Key 除外）；保存时写入 `config` 键并给出「已保存 / 失败」反馈。
  - 提供「未配置 API Key」的校验提示，供 Popup 联动引导。
- **涉及文件**：`src/options/App.tsx`、`src/options/index.html`、`src/shared/constants.ts`、`src/shared/types.ts`。
- **验收 / 可见效果**：打开设置页填写并保存后刷新页面，配置保留；状态区显示「已保存」。
- **依赖**：T1。

---

### T4 [P1] 翻译模块（Background 流式翻译）

- **目标**：以 OpenAI 兼容协议流式调用 Qwen 模型翻译。
- **对应布局**：示意图-popup.md ④ 内容展示区所需的增量译文数据流。
- **内容要求**：
  - 后台监听「翻译请求」消息，读取 `config`（API Key / Base URL / 模型名）。
  - 按需求文档 §3.5 组装翻译输入：一级标题 + 引用块（作者 / 原文链接）+ 正文。
  - 使用 OpenAI 兼容 SDK 以**流式**方式调用，将增量内容逐段推送回 Popup；支持「停止翻译」中断，并向上层返回结构化错误（网络 / 鉴权 / 限流）。
- **涉及文件**：`src/background/translator.ts`、`src/background/index.ts`、`src/shared/types.ts`、`src/shared/messages.ts`。
- **验收 / 可见效果**：配置有效 API Key 后，通过调试入口发起翻译，可逐段收到中文译文增量；错误场景（如 Key 无效）返回可读错误信息。
- **依赖**：T1、T3。

---

### T5 [P2] Popup 展示模块（md-wx + 打字机）

- **目标**：实现翻译结果的 Markdown 渲染与打字机动态展示。
- **对应布局**：示意图-popup.md ③ 文章信息区、④ 内容展示区、⑥ 状态提示区。
- **内容要求**：
  - 引入 md-wx 依赖并在 Popup 中配置样式，验证 `MarkdownRenderer` 渲染。
  - 实现文章信息区（标题 / 作者 / 原文链接，缺失行隐藏）与内容展示区（可滚动、md-wx 渲染）。
  - 实现打字机效果的 Hook：对传入的增量文本逐段累积，实时刷新渲染内容。
  - 实现状态提示区四种状态样式（就绪 / 翻译中 / 已完成 / 错误）。
  - 本任务先用**本地示例 Markdown 数据**验证渲染与打字机效果，不接真实翻译链路。
- **涉及文件**：`src/popup/App.tsx`、`src/popup/components/*`、`src/popup/hooks/use-typewriter.ts`、`src/popup/index.html`。
- **验收 / 可见效果**：打开 Popup，用示例数据触发后可见文章信息区、Markdown 排版内容以及打字机逐段输出效果。
- **依赖**：T1。

---

### T6 [P2] 主流程串联（一键翻译全链路）

- **目标**：打通「提取 → 翻译 → 打字机展示 → 下载」完整链路。
- **对应布局**：示意图-popup.md 全部模块（② 翻译操作区、⑤ 底部操作栏为主）。
- **内容要求**：
  - 实现「一键翻译」：请求 Content Script 提取 → 组装格式 → 请求 Background 流式翻译 → 增量内容交由打字机渲染。
  - 实现「停止翻译」：中断流式输出并保留已输出部分（② 按钮切换为「停止」）。
  - 实现「下载译文」：将完整翻译结果（标题 / 作者 / 链接 / 正文）导出为 `.md` 文件，文件名取自文章标题（⑤ 底部操作栏）。
  - 翻译前校验配置：未配置 API Key 时提示并引导打开设置页。
  - 翻译完成后写入 `storage.local` 的 `lastResult`（整体覆盖，不保留历史）。
- **涉及文件**：`src/popup/App.tsx`、`src/popup/hooks/*`、`src/background/index.ts`、`src/content/index.ts`、`src/shared/*`。
- **验收 / 可见效果**：在英文文章页点击「一键翻译」，可见打字机动态输出中文译文；完成后可下载 `.md` 文件；停止翻译可中断。
- **依赖**：T2、T3、T4、T5。

---

### T7 [P3] 打磨与验收（存储恢复 / 异常 / 样式）

- **目标**：完善可用性与稳定性，对照需求验收。
- **对应布局**：示意图-popup.md ⑥ 状态提示区、示意图-options.md ⑤ 状态反馈区。
- **内容要求**：
  - Popup 打开时读取 `lastResult` 恢复展示最近一次翻译结果；重新翻译后覆盖旧结果。
  - 完善异常与边界：非文章页、未配置 Key、网络异常 / 超时 / 限流、翻译中断，均有友好提示且允许重试。
  - 统一两页面视觉风格（配色、间距、按钮态），检查输出格式严格符合需求 §3.5。
  - 对照需求文档 §6 验收标准逐项自测通过。
- **涉及文件**：`src/popup/*`、`src/options/*`、`src/background/index.ts`、`src/content/*`。
- **验收 / 可见效果**：刷新页面后 Popup 恢复最近一次译文；各异常场景提示友好；整体界面简洁美观。
- **依赖**：T6。

## 3. 实现顺序建议

按 P0 → P1 → P2 → P3 顺序推进：先跑通工程（T1），再完成数据来源（T2、T3、T4），随后实现展示（T5），串起全链路（T6），最后打磨（T7）。其中 T2、T3、T4 之间无强依赖，可并行或按任意顺序完成。
