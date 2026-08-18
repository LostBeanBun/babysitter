import pluginVue from 'eslint-plugin-vue'
import vueTsEslintConfig from '@vue/eslint-config-typescript'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'

export default [
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}'],
  },

  {
    name: 'app/files-to-ignore',
    ignores: ['**/dist/**', '**/dist-ssr/**', '**/coverage/**', '**/node_modules/**', '**/*.tsbuildinfo'],
  },

  // Vue 3 essential 规则（create-vue 官方标准）
  ...pluginVue.configs['flat/essential'],
  // Vue + TypeScript 规则
  ...vueTsEslintConfig(),
  // Prettier 格式化（冲突规则关闭，交由 prettier 处理）
  skipFormatting,
]