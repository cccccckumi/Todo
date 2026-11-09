import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { listPackage, extractFile } from '@electron/asar';
import { normalize } from 'node:path';
import { isPrivatePackagePath } from './package-policy.mjs';

const archive = 'release/win-unpacked/resources/app.asar';
assert.ok(existsSync(archive), '请先运行 npm run dist:win 或 npm run pack:win');
const files = listPackage(archive).map((path) => path.replaceAll('\\', '/').replace(/^\//, ''));
const forbidden = files.filter(isPrivatePackagePath);
assert.equal(forbidden.length, 0, `安装包包含不应打包的文件：${forbidden.join(', ')}`);
assert.ok(files.includes('electron/main.js') && files.includes('electron/preload.cjs'));
assert.ok(files.includes('LICENSE'), '安装包缺少 MIT 许可证，请重新构建');
assert.ok(extractFile(archive, 'LICENSE').equals(readFileSync('LICENSE')), '安装包许可证与源文件不一致，请重新构建');
const sources = files.filter((path) => /^(electron|shared)\/.*\.(js|cjs)$/.test(path) || /^dist\/.*\.(html|js|css)$/.test(path));
for (const path of sources) assert.ok(extractFile(archive, normalize(path)).equals(readFileSync(path)), `打包内容已过期，请重新构建：${path}`);
assert.ok(!extractFile(archive, 'dist/index.html').toString().includes('src="/assets/'), '静态资源需要相对路径');
const key = existsSync('.env') ? readFileSync('.env', 'utf8').match(/^\s*ARK_API_KEY\s*=\s*(.+)\s*$/m)?.[1]?.trim().replace(/^(['"])(.*)\1$/, '$2') : '';
if (key && key.length > 10) {
  for (const path of files) {
    if (!/\.(js|cjs|mjs|json|html|css|txt|md)$/.test(path)) continue;
    assert.ok(!extractFile(archive, normalize(path)).includes(Buffer.from(key)), '安装包发现本地凭据，停止分发');
  }
}
console.log('安装包内容检查通过：桌面入口存在，静态路径有效，未包含 .env、任务数据或本地 API Key。');
