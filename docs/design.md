# Firefox 英文网页翻译插件 — 技术架构设计文档

> 对应需求文档：[proposal.md](./proposal.md)

## 1. 设计目标

- 基于 Firefox WebExtensions 标准，在浏览器本地完成「文章提取 → Markdown 转换 → AI 翻译 → 打字机展示 → 本地持久化」的完整链路。
- 文章提取为核心难点，采用业界成熟、且与 Firefox 同源的方案，保证多数网站的提取质量。
- 翻译层采用 OpenAI SDK 兼容协议，支持切换不同模型服务商；本项目默认使用通义千问（Qwen）模型。
- 渲染层复用 npm 包 md-wx（React 组件），保证翻译结果的 Markdown 呈现质量与排版美观。

## 2. 总体架构

插件采用浏览器扩展标准的「三进程 + 一页面」分层结构：

| 层         | 载体              | 职责                                                              |
| ---------- | ----------------- | ----------------------------------------------------------------- |
| 内容脚本层 | Content Script    | 注入当前页面，执行文章提取与 Markdown 转换，读取当前页 DOM        |
| 后台层     | Background Script | 消息路由、调用 AI 翻译接口（流式）、持久化读写、跨层协调          |
| 交互层     | Sidebar / Options | React 应用：侧边栏触发翻译、打字机效果展示翻译结果、设置 API 配置 |
| 渲染组件   | md-wx             | 在 Sidebar 中渲染翻译后的 Markdown 内容                           |

### 2.1 核心数据流

1. 用户在英文文章页点击工具栏插件图标，Background 调用 `browser.sidebarAction.toggle()` 打开 / 关闭右侧翻译侧边栏。
2. 侧边栏向 Content Script 发送「提取请求」。
3. Content Script 在页面 DOM 上执行文章提取，获得标题、作者、正文 HTML；随后转换为 Markdown 原文，并携带原文 URL 回传。
4. 侧边栏将 Markdown 原文发送至 Background Script。
5. Background Script 以 OpenAI 兼容协议、流式调用 Qwen 模型翻译为中文，逐段推送增量内容。
6. 侧边栏接收增量内容，以打字机效果动态渲染（经 md-wx 呈现）。
7. 翻译完成后，Background Script 将「最近一次翻译结果」整体写入本地存储，覆盖旧数据。
8. 用户再次打开侧边栏时，先从本地存储恢复最近一次结果展示。

## 3. 关键技术选型

### 3.1 文章内容提取（核心难点）

候选方案对比：

| 方案                                          | 说明                                                      | 优缺点                                                                                                                                                   |
| --------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mozilla Readability（`@mozilla/readability`） | Mozilla 官方维护，Firefox Reader View（阅读模式）同款引擎 | 优点：与 Firefox 同源、经过海量页面验证、直接在浏览器 DOM 上运行、一次解析即可返回标题/作者/正文；缺点：对非典型结构页面可能失败，输出为 HTML 需二次转换 |
| Mercury Parser                                | Postlight 维护的通用解析器，面向服务端按 URL 抓取         | 优点：元信息丰富；缺点：维护活跃度低、需按 URL 抓取而非操作当前页 DOM、体积大，不适合作为 Content Script 注入                                            |
| Trafilatura                                   | Python 生态的高质量抽取库                                 | 优点：质量高；缺点：Python 实现，无法在浏览器扩展内运行                                                                                                  |

**结论：采用 `@mozilla/readability`。**

理由：

- 与目标浏览器（Firefox）技术同源，引擎即 Firefox 阅读模式的实现，可靠性有长期背书。
- 在 Content Script 中直接对当前页面 DOM 执行，无需额外网络请求，速度快、权限小。
- 一次 `parse()` 即可返回标题、作者（byline）、正文 HTML、站点名等元信息，与需求文档的元信息要求完全对应。
- 官方建议对 DOM 克隆后再解析，避免影响原页面，可保证页面无感知。

配套处理：Readability 输出 HTML，需配合 HTML→Markdown 转换器（见 3.2）生成 Markdown。

### 3.2 HTML → Markdown 转换

采用 **Turndown**（`turndown`）：

- 社区主流、成熟稳定的 HTML 转 Markdown 库。
- 内置将 `<img>` 转换为 `![alt](src)` 的能力，支持 `alt` 与 `src` 提取，满足需求「图片转 Markdown 图片格式」的要求。
- 可自定义规则，用于处理标题层级、列表、引用块、代码块等结构的保真转换。

### 3.3 AI 翻译（OpenAI SDK 兼容）

采用 **OpenAI SDK 兼容协议**，理由：

- OpenAI 官方 SDK（Node.js）支持自定义 `baseURL` 与 `model`，可无缝切换不同模型服务商。
- 支持流式（streaming）返回，是打字机效果的数据基础。
- 本项目使用 **Qwen（通义千问）模型**：其 DashScope 服务提供 OpenAI 兼容接口，配置对应的 Base URL 与模型名即可接入，未来可切换到任意 OpenAI 兼容服务。

配置项（用户可配置）：

- API Key（密钥）
- Base URL（服务端点，默认指向 Qwen 的 OpenAI 兼容端点）
- 模型名称（默认 Qwen 系列模型）
- 温度等可选参数

### 3.4 Markdown 渲染

采用 **md-wx**（npm 包，React 组件）：

- 提供 `MarkdownRenderer` 组件，可在 React 中直接引入使用。
- 内置多种主题、代码高亮、视图模式切换、复制等功能，满足「展示界面美观、便于阅读与复制」的需求。
- 本项目将其嵌入 Sidebar，用于渲染翻译后的 Markdown 结果；打字机效果通过增量更新传入 md-wx 的 markdown 内容实现。
- 使用前需在项目中安装该依赖。

参考：组件 API 详见 [md-wx-api-usage.md](./md-wx-api-usage.md)。

### 3.5 构建与工程

- 语言：TypeScript（类型安全，跨模块共享类型）。
- UI：React。
- 构建：Vite（多入口构建 Content Script / Background / Sidebar / Options，产物为 Firefox 可加载的扩展目录）。
- 包管理器：npm。

## 4. 模块设计

### 4.1 提取模块（Content Script 侧）

- 对页面 DOM 克隆后执行 Readability 解析，防止污染原页面。
- 解析失败或非文章页（如无正文）时，返回明确的错误信息，由 UI 友好提示。
- 输出结构：`{ title, author, url, markdown }`（作者缺失时可为空）。

### 4.2 转换模块（Content Script 侧）

- 将提取的正文 HTML 交给 Turndown 转换，产出 Markdown 原文。
- 保证图片（`![alt](src)`）、链接、代码块、列表等语法不被破坏。

### 4.3 翻译模块（Background Script 侧）

- 接收 Markdown 原文与元信息，按需求文档规定的格式组装翻译输入。
- 以流式方式调用 OpenAI 兼容接口（Qwen），逐段下发增量内容。
- 支持中断（用户停止翻译）。
- 错误处理：网络异常、鉴权失败、超时等，向上层返回可读的错误信息。

### 4.4 展示模块（Sidebar / React + md-wx）

- 载体：Firefox 侧边栏。manifest 通过 `sidebar_action` 声明面板页面（`sidebar.html`）；点击工具栏图标由 Background 监听 `browser.action.onClicked` 调用 `browser.sidebarAction.toggle()` 开关侧边栏。侧边栏高度自动撑满浏览器窗口全高，宽度由浏览器侧边栏机制提供（用户可拖拽调整），满足长文阅读需求。
- 顶部：文章标题、作者、原文链接信息区。
- 中部：md-wx 渲染翻译结果，支持打字机增量展示、滚动、复制。
- 操作：翻译按钮、停止按钮、加载/错误状态。
- 打开时优先恢复本地最近一次结果。

### 4.5 配置模块（Options 页面）

- 提供 API Key、Base URL、模型名等配置表单。
- 配置写入本地存储；API Key 仅在 Background 层使用，不注入页面上下文。

### 4.6 存储模块

- 使用 `browser.storage.local`。
- 存储内容：最近一次翻译结果（含标题、作者、原文链接、翻译后正文 Markdown、原文 Markdown、时间戳）、用户配置。
- 语义为「单槽覆盖」：新翻译结果覆盖旧结果，不保留历史。

## 5. 目录结构规范

```
chrome-extension-en-translation/
├── docs/                        # 文档
│   ├── proposal.md              # 需求文档
│   └── design.md                # 本架构文档
├── src/
│   ├── content/                 # 内容脚本（注入页面）
│   │   ├── extractor.ts         # 文章提取（Readability）
│   │   ├── converter.ts         # HTML → Markdown（Turndown）
│   │   └── index.ts             # 内容脚本入口、消息监听
│   ├── background/
│   │   ├── translator.ts        # AI 翻译（OpenAI 兼容、流式）
│   │   └── index.ts             # 后台入口、消息路由、存储
│   ├── sidebar/                 # 右侧翻译侧边栏（React）
│   │   ├── App.tsx              # 主界面（翻译全链路）
│   │   ├── main.tsx             # 入口挂载
│   │   ├── style.css            # 界面样式
│   │   ├── components/          # 子组件（文章信息、操作栏、状态栏等）
│   │   ├── hooks/               # 自定义 Hooks（打字机效果等）
│   │   └── index.html
│   ├── options/                 # 设置页（React）
│   │   ├── App.tsx
│   │   └── index.html
│   ├── shared/                  # 跨模块共享
│   │   ├── types.ts             # 消息与数据结构类型
│   │   ├── constants.ts         # 常量（存储键、默认配置）
│   │   └── messages.ts          # 消息协议定义
│   └── assets/                  # 图标、样式等静态资源
├── public/                      # 扩展静态资源（manifest.json 等）
├── dist/                        # 构建产物（可加载到 Firefox）
├── .eslintrc / eslint 配置
├── .prettierrc                  # 格式化配置
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

命名约定：

- 目录：小写单词，多个单词用短横线连接（kebab-case）。
- 文件：TS/TSX 文件使用 kebab-case；组件文件后缀 `.tsx`，普通模块后缀 `.ts`。
- 每个模块保持单一职责，模块内部按「入口 + 业务逻辑」拆分。

## 6. 编码规范

### 6.1 通用规范

- 统一使用 TypeScript，禁止 `any` 泛滥；跨模块数据必须使用 `shared/types.ts` 中定义的显式类型。
- 一律使用相对路径导入；模块间通信只能通过定义的「消息协议」（`shared/messages.ts`），禁止直接互相调用。

### 6.2 命名规范

| 对象        | 规范                         | 示例                       |
| ----------- | ---------------------------- | -------------------------- |
| 变量 / 函数 | camelCase                    | `translateArticle`         |
| 组件 / 类   | PascalCase                   | `TranslationResult`        |
| 常量        | UPPER_SNAKE_CASE             | `STORAGE_KEYS.LAST_RESULT` |
| 类型 / 接口 | PascalCase（前缀 I 可选）    | `ArticleResult`            |
| 文件 / 目录 | kebab-case                   | `article-extractor.ts`     |
| 消息事件名  | 常量或字符串字面量，集中定义 | `MSG.EXTRACT_ARTICLE`      |

### 6.3 代码风格

- 使用 ESLint + Prettier 统一风格，提交前必须通过检查。
- 缩进 2 空格、单引号、末尾分号（具体以 Prettier 配置为准）。
- 注释使用中文；公共函数、复杂逻辑必须写明作用与关键约束。

### 6.4 错误处理

- 网络 / 鉴权 / 提取失败等异常必须显式处理，并向上层返回结构化错误（错误码 + 用户可读信息）。
- 禁止吞掉异常；UI 层对所有用户可见操作提供错误提示。

### 6.5 安全规范

- API Key 等敏感信息只能存于本地存储，且仅在 Background 层读取，不得注入 Content Script 或页面上下文。
- 不信任页面内容：提取与转换只做文本处理；渲染翻译结果时避免直接注入 HTML（md-wx 按 Markdown 解析渲染）。
- 最小权限原则：manifest 仅申请功能必需的权限。

## 7. 数据存储设计

| 存储键       | 类型 | 说明                                                                           |
| ------------ | ---- | ------------------------------------------------------------------------------ |
| `config`     | 对象 | API Key、Base URL、模型名等配置                                                |
| `lastResult` | 对象 | 最近一次翻译结果：标题、作者、原文链接、原文 Markdown、译文 Markdown、完成时间 |

规则：

- 写入采用整体覆盖，不维护历史列表，满足「仅保留最近一次」的需求。
- Sidebar 打开时读取 `lastResult` 恢复展示；新翻译完成时立即覆盖写入。

## 8. 异常与边界处理

- 非文章页 / 提取失败：返回可读错误，UI 提示「未能识别文章内容」。
- 未配置 API Key：引导用户跳转设置页。
- 翻译中断：用户可点击停止，展示已完成的部分。
- 网络异常 / 超时 / 模型限流：结构化错误提示，允许重试。
- 页面为已渲染的 SPA：Content Script 在 `document_idle` 时机注入，尽量保证 DOM 完整。

## 9. 构建与发布

- 开发：`npm run dev` 输出开发产物，通过 Firefox「临时载入附加组件」加载 `dist/` 目录进行调试。
- 构建：`npm run build` 产出可发布产物。
- 发布：产物打包后通过 Firefox Add-ons 开发者中心提交（本期文档仅规划，实施阶段落地）。

## 10. 依赖清单（实施阶段安装）

| 依赖                                      | 用途                        |
| ----------------------------------------- | --------------------------- |
| `@mozilla/readability`                    | 文章内容提取                |
| `turndown`                                | HTML 转 Markdown            |
| `openai`（SDK）                           | OpenAI 兼容接口调用（Qwen） |
| `md-wx`                                   | Markdown 渲染组件（React）  |
| `react` / `react-dom`                     | UI 框架                     |
| `typescript` / `vite` / ESLint / Prettier | 工程化                      |
