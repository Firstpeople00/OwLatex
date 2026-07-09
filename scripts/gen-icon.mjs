// 从 src/images/logo-1.svg 生成 build/icon.ico（多尺寸）+ build/icon.png（256）
import { Resvg } from '@resvg/resvg-js'
import pngToIco from 'png-to-ico'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'

const svg = readFileSync('src/images/logo-1.svg', 'utf8')
const sizes = [256, 128, 64, 48, 32, 16]
const pngs = sizes.map((s) =>
  Buffer.from(
    new Resvg(svg, { fitTo: { mode: 'width', value: s }, background: 'rgba(0,0,0,0)' })
      .render()
      .asPng()
  )
)
mkdirSync('build', { recursive: true })
writeFileSync('build/icon.png', pngs[0]) // 256，用作运行时窗口图标
writeFileSync('build/icon.ico', await pngToIco(pngs))
console.log('生成 build/icon.ico + build/icon.png（256/128/64/48/32/16）')
