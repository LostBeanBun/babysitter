import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { initTheme } from './composables/useTheme'
import './styles/main.css'

// 应用启动即应用主题（含暗色），避免首屏闪烁
initTheme()

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
