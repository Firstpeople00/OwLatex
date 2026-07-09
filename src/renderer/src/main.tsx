import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// 不用 StrictMode：CodeMirror / PDF.js 是命令式库，
// StrictMode 的开发态双挂载会让它们初始化两次，徒增干扰。
ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
