import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readWindowsImports } from './prepare-resources.mjs'

// Node's -p accepts an expression where objdump's -p accepts a binary path.
// This exercises real child-process pipes without needing a Windows toolchain.
test('DLL imports survive large output and split lines', async () => {
  const imports = await readWindowsImports(`
    process.stdout.write('unwind table entry\\n'.repeat(200000));
    process.stdout.write('    DLL Na');
    setTimeout(() => {
      process.stdout.write('me: libvips-42.dll\\r\\n    DLL Name: KERNEL32.dll\\r\\n');
      process.stdout.write('export table entry\\n'.repeat(200000));
      process.stdout.write('    DLL Name: libheif.dll\\n    DLL Name: libvips-42.dll\\n');
    }, 10);
    ''
  `, process.execPath)
  assert.deepEqual(imports, ['libvips-42.dll', 'KERNEL32.dll', 'libheif.dll'])
})

test('DLL inspection failures identify the input and retain diagnostics', async () => {
  await assert.rejects(readWindowsImports(`process.stderr.write('invalid PE file'); process.exit(7)`, process.execPath),
    /objdump failed.*7.*invalid PE file/)
})

test('missing inspection tool rejects instead of returning an empty import list', async () => {
  await assert.rejects(readWindowsImports('input.exe', 'picpress-nonexistent-objdump'), { code: 'ENOENT' })
})
