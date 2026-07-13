import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = path.resolve(process.cwd(), 'src')
const failures = []

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(target) : [target]
  })
}

for (const file of walk(root).filter(file => /\.(js|jsx|ts|tsx)$/.test(file))) {
  const source = fs.readFileSync(file, 'utf8')
  const relative = path.relative(process.cwd(), file)
  const checks = [
    [/["']zh-CN["']\s*:/g, 'Simplified Chinese locale catalog'],
    [/getLocale\(\)\s*===\s*["']zh-CN["']/g, 'Simplified Chinese runtime branch'],
    [/value=["']zh-CN["']/g, 'Simplified Chinese language control']
  ]
  checks.forEach(([pattern, label]) => {
    if (pattern.test(source)) failures.push(`${relative}: ${label}`)
  })
}

const i18nSource = fs.readFileSync(path.join(root, 'i18n', 'index.js'), 'utf8')
if (!i18nSource.includes("SUPPORTED_LOCALES = ['zh-TW', 'en']")) {
  failures.push('src/i18n/index.js: supported locales must remain zh-TW and en')
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('Locale architecture check passed: zh-TW + en')
