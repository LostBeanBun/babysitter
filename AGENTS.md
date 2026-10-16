# 项目约定

## 版本号规范

- 每次改动（含修复、文案、样式、重构、依赖升级）都必须升版：`npm run version:bump patch|minor|major`，并补全 `CHANGELOG.md` 顶部条目
- 版本号唯一来源为 `package.json` 的 `version`；界面展示统一用 `APP_VERSION`（`src/constants/version.ts`，由 `vite.config.ts` 注入），不要硬编码版本号
- `npm run lint` 末尾会执行 `npm run version:check`：工作区有改动却未升版会直接失败
- 行为需与 React 版仓库（`../babysitter-next`）保持一致：功能同步实现、版本号同步升版（`../babysitter-next/package.json`）

## 代码风格

- 无分号、单引号、2 空格缩进；不使用 `as any` / `@ts-ignore`
- 校验流程：`npm run typecheck` → `npm run lint` → `npm test`
