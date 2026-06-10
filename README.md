# LLM Live Translate

使用 LLM 在 VS Code 中翻译整个文件或选中的部分内容。译文显示在并排打开的只读预览中，插件不会修改或覆盖原始文件。

## 功能

- 将整个文件按段落切分后翻译，避免一次发送过多内容。
- 翻译鼠标选中的部分内容。
- 保留原文格式，并在每段原文下方显示对应译文。
- 限制并发请求数量，并对失败请求自动重试。
- 原文件内容变化后，自动刷新整文件翻译预览。
- 支持 OpenAI Chat Completions 兼容接口。
- 支持 Anthropic Messages 兼容接口。
- 使用 VS Code SecretStorage 安全保存 API Key。

## 安装插件

本项目已经生成可直接安装的插件文件：

```text
llm-live-translate-0.1.0.vsix
```

### 方法一：通过 VS Code 界面安装

1. 打开 VS Code。
2. 点击左侧活动栏中的 **扩展** 图标，或者按：
   - macOS：`Cmd+Shift+X`
   - Windows/Linux：`Ctrl+Shift+X`
3. 点击扩展页面右上角的 `...` 菜单。
4. 选择 **从 VSIX 安装...**（Install from VSIX...）。
5. 选择本项目目录中的 `llm-live-translate-0.1.0.vsix`。
6. 安装完成后，点击提示中的 **重新加载**；如果没有提示，打开命令面板并执行 `Developer: Reload Window`。

安装成功后，可以在扩展列表中搜索 `LLM Live Translate`。

### 方法二：通过命令行安装

在本项目目录中执行：

```bash
code --install-extension llm-live-translate-0.1.0.vsix
```

如果终端提示找不到 `code` 命令：

1. 在 VS Code 中打开命令面板。
2. macOS 执行 `Shell Command: Install 'code' command in PATH`。
3. Windows/Linux 确认安装 VS Code 时已经将其加入 `PATH`。

## 首次配置

使用插件前，需要配置接口类型、接口地址、模型名称和 API Key。

### 1. 打开插件设置

1. 打开 VS Code 设置：
   - macOS：`Cmd+,`
   - Windows/Linux：`Ctrl+,`
2. 在设置搜索框中输入 `LLM Live Translate`。
3. 配置以下项目：

| 设置项 | 说明 | OpenAI 示例 | Anthropic 示例 |
| --- | --- | --- | --- |
| `Provider` | 接口兼容类型 | `openai` | `anthropic` |
| `Base Url` | API 基础地址 | `https://api.openai.com/v1` | `https://api.anthropic.com` |
| `Model` | 模型名称 | `gpt-4o-mini` | `claude-3-5-haiku-latest` |
| `Target Language` | 翻译目标语言 | `Simplified Chinese` | `Simplified Chinese` |

使用第三方兼容服务时，请填写该服务提供的 Base URL 和模型名称。

### 2. 配置 API Key

1. 打开命令面板：
   - macOS：`Cmd+Shift+P`
   - Windows/Linux：`Ctrl+Shift+P`
2. 输入并执行：

   ```text
   LLM Translate: Configure API Key
   ```

3. 输入 API Key，然后按回车。

API Key 会保存在 VS Code 的安全存储中，因此保存后的 Key 不会显示在普通设置页面里。

也可以在 `settings.json` 中配置 `llmLiveTranslate.apiKey`，但它会以明文保存，不推荐使用。

## 使用插件

### 翻译整个文件

1. 在 VS Code 中打开需要翻译的文件。
2. 使用以下任意一种方式开始翻译：
   - 打开命令面板，执行 `LLM Translate: Translate File`。
   - 在编辑器中点击鼠标右键，选择 `LLM Translate: Translate File`。
   - 使用快捷键：
     - macOS：`Cmd+Alt+T`
     - Windows/Linux：`Ctrl+Alt+T`
3. 插件会在编辑器右侧打开只读双语预览。

插件不会把整个文件一次性发送给 LLM。对于 Markdown 文件，它会将 YAML front matter、标题、正文段落、连续列表、引用块和代码块识别为独立的最小语义块。只有单个块超过 `Segment Max Characters` 时，才会继续拆分。翻译完成一个块后，预览会在该块原文下方立即显示对应译文。

默认情况下，继续编辑原始文件后，所有段落会重新切分和翻译。可以在设置中关闭 `Live Update`，或者调整 `Debounce Ms` 控制自动翻译等待时间。

### 翻译选中的内容

1. 使用鼠标选中需要翻译的文字。
2. 使用以下任意一种方式开始翻译：
   - 打开命令面板，执行 `LLM Translate: Translate Selection`。
   - 在选中的文字上点击鼠标右键，选择 `LLM Translate: Translate Selection`。
   - 使用快捷键：
     - macOS：`Cmd+Alt+S`
     - Windows/Linux：`Ctrl+Alt+S`
3. 插件会在编辑器右侧打开该选区的只读双语预览。

选区翻译使用执行命令时的内容快照，不会随着原文件变化自动刷新。

### 手动刷新译文

打开译文预览，然后通过命令面板执行：

```text
LLM Translate: Refresh Preview
```

## 配置示例

可以执行 `Preferences: Open User Settings (JSON)`，直接编辑 VS Code 的 `settings.json`。

OpenAI：

```json
{
  "llmLiveTranslate.provider": "openai",
  "llmLiveTranslate.baseUrl": "https://api.openai.com/v1",
  "llmLiveTranslate.model": "gpt-4o-mini",
  "llmLiveTranslate.targetLanguage": "Simplified Chinese"
}
```

Anthropic：

```json
{
  "llmLiveTranslate.provider": "anthropic",
  "llmLiveTranslate.baseUrl": "https://api.anthropic.com",
  "llmLiveTranslate.model": "claude-3-5-haiku-latest",
  "llmLiveTranslate.targetLanguage": "Simplified Chinese"
}
```

### 分段与并发配置

```json
{
  "llmLiveTranslate.segmentMaxCharacters": 20000,
  "llmLiveTranslate.maxConcurrentRequests": 5,
  "llmLiveTranslate.retryCount": 2
}
```

- `Segment Max Characters`：每个请求最多发送的字符数。较小的段落通常翻译得更完整，但会产生更多请求。
- `Max Concurrent Requests`：同时发送的最大请求数量。如果接口容易限流，可以改为 `1` 或 `2`。
- `Retry Count`：单个段落失败后的重试次数。
- `Max Characters`：单个请求允许发送的硬性字符上限，应该大于或等于 `Segment Max Characters`。

## 更新插件

生成新版 VSIX 后，再次执行 **从 VSIX 安装...** 并选择新版文件即可。安装完成后重新加载 VS Code。

如果新版仍然使用相同版本号，VS Code 可能不会正确刷新插件。开发新版本时，应先修改 `package.json` 中的 `version`。

## 卸载插件

1. 打开 VS Code 的 **扩展** 页面。
2. 搜索 `LLM Live Translate`。
3. 点击齿轮图标并选择 **卸载**。
4. 重新加载 VS Code。

## 常见问题

### 设置页面中看不到已保存的 API Key

这是正常现象。通过 `LLM Translate: Configure API Key` 保存的 Key 位于 VS Code SecretStorage，不会显示在设置页面中。

### 提示 API key is not configured

打开命令面板并重新执行 `LLM Translate: Configure API Key`。

### 翻译请求失败

检查以下配置是否与接口服务商提供的信息一致：

- `Provider`
- `Base Url`
- `Model`
- API Key

第三方兼容接口可能只兼容 OpenAI 或 Anthropic 中的一种请求格式，需要选择正确的 `Provider`。

如果出现限流或请求过多错误，请降低 `Max Concurrent Requests`。

### 返回的内容像总结，而不是翻译

新版默认提示词会明确禁止总结、解释和删减，并且按段落翻译。升级后请检查设置中的 `System Prompt`：如果之前手动修改过这个设置，VS Code 会继续使用旧值。可以删除自定义的 `llmLiveTranslate.systemPrompt`，恢复新版默认提示词。

### 文件过大，无法翻译

插件默认单个语义块最多发送 20000 个字符，单次请求硬上限为 50000 个字符。可以修改 `Segment Max Characters` 和 `Max Characters`，但接口模型本身仍可能受到上下文长度限制。

## 从源码开发和打包

只有需要修改插件代码时才需要执行本节操作。普通使用者直接安装 VSIX 即可。

安装依赖并构建：

```bash
npm install
npm run build
```

在 VS Code 中按 `F5`，可以启动 Extension Development Host 调试插件。

重新生成 VSIX：

```bash
npm run package -- --allow-missing-repository
```
