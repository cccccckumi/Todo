module.exports = {
  appId: 'com.aitodo.desktop',
  productName: 'AI Todo',
  asar: true,
  electronDist: 'node_modules/electron/dist',
  directories: { output: 'release', buildResources: 'build' },
  files: [
    'dist/**/*', 'electron/**/*', 'shared/**/*', 'build/icon.png', 'package.json', 'LICENSE',
    '!**/.env', '!**/.env.*', '!**/*.map', '!**/test*/**',
  ],
  win: { target: [{ target: 'nsis', arch: ['x64'] }], icon: 'build/icon.ico', artifactName: 'AI-Todo-${version}-${arch}-Setup.${ext}' },
  nsis: {
    oneClick: false, perMachine: false, allowElevation: false, allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true, createStartMenuShortcut: true, deleteAppDataOnUninstall: false,
    installerIcon: 'build/icon.ico', uninstallerIcon: 'build/icon.ico',
  },
  // 构建命令和 CI 均只生成附件；发布由维护者手动执行。
  publish: null,
};
