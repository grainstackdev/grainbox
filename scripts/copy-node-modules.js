import fs from 'fs-extra'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const pkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../package.json'), {
    encoding: 'utf8',
  }),
)

fs.mkdirSync(path.resolve(__dirname, '../dist/cdn/node_modules'))
for (const packageName of Object.keys(pkg.dependencies)) {
  console.log('packageName', packageName)
  fs.copySync(
    path.resolve(__dirname, '../node_modules', packageName),
    path.resolve(__dirname, '../dist/cdn/node_modules', packageName)
  )
}
