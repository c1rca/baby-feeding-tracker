import { spawnSync } from 'node:child_process'

export const selectTestCommand = (args) => {
  if (args.length === 0) return null
  return args.every((arg) => arg.endsWith('.node.mjs'))
    ? ['node', ['--test', ...args]]
    : ['npx', ['vitest', 'run', ...args]]
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  const args = process.argv.slice(2)
  const selected = selectTestCommand(args)
  const steps = selected ? [selected] : [
    ['npm', ['run', 'typecheck:server']],
    ['npx', ['vitest', 'run']],
    ['node', ['--test', 'test/*.node.mjs']],
  ]
  for (const [command, commandArgs] of steps) {
    const result = spawnSync(command, commandArgs, { stdio: 'inherit', shell: commandArgs.includes('test/*.node.mjs') })
    if (result.status !== 0) process.exit(result.status ?? 1)
  }
}
