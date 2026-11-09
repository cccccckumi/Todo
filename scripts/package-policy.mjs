// 检查文件路径，不打开任务文件或配置文件。配置读写的源码可以正常打包。
export function isPrivatePackagePath(path) {
  const normalized = path.replaceAll('\\', '/');
  const name = normalized.split('/').at(-1);
  return /(^|\/)(\.git|\.agents|\.test-profiles|test-results|playwright-report|__pycache__|tests|server)(\/|$)/i.test(normalized)
    || /^\.env(?:$|\.)/i.test(name)
    || /^(todo-data|ai-config)\.json(?:\.(bak|tmp))?$/i.test(name)
    || /^AI-Todo-(\d{4}-\d{2}-\d{2}|old-tasks)\.json$/i.test(name)
    || /\.py[co]$/i.test(name);
}
