import { resolve } from 'path'
import { readFileSync } from 'fs'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const version = JSON.parse(readFileSync('package.json', 'utf8')).version

export default defineConfig({
  main: {
    // 主进程依赖不打包进 bundle，交给 Electron 运行时 require
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    define: {
      // 构建时注入版本号（跟随 package.json）
      __APP_VERSION__: JSON.stringify(version)
    },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()]
  }
})
