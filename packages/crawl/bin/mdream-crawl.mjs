#!/usr/bin/env node

if (process.argv[2] === 'fetch') {
  process.argv.splice(2, 1)
  const m = await import('../dist/fetch.mjs')
  m.main().catch((err) => {
    process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`)
    process.exit(m.ParseError && err instanceof m.ParseError ? 2 : 1)
  })
}
else {
  import('../dist/cli.mjs')
}
