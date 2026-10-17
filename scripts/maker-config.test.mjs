import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'
import config from '../forge.config.ts'
import { listrMake } from '../node_modules/@electron-forge/core/dist/api/make.js'

const workflow = readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8')

for (const name of ['deb', 'rpm']) {
  test(`CI selects the configured ${name} maker and retains its options`, async () => {
    const job = workflow.split(`  build-${name}:`)[1].split(/\n  [\w-]+:/)[0]
    const target = /--targets=([^\s]+)/.exec(job)?.[1]
    assert.ok(target, 'The Linux job must select a target')
    const maker = config.makers.find(maker => maker.name === name).clone()
    // Test Forge's real target resolution without requiring native RPM/DEB tools.
    maker.isSupportedOnCurrentPlatform = () => true
    maker.ensureExternalBinariesExist = () => {}
    const childTrace = ({ name }, task) => ['load-forge-config', 'resolve-make-targets'].includes(name)
      ? (...args) => task(childTrace, ...args) : async () => {}
    const runner = listrMake(childTrace, {
      dir: resolve('.'), platform: 'linux', arch: 'x64',
      forgeConfig: { ...config, makers: [maker] }, overrideTargets: [target],
    })
    await runner.run()
    assert.equal(runner.ctx.makers.length, 1)
    const selected = runner.ctx.makers[0]()
    await selected.prepareConfig('x64')
    assert.equal(selected.config.options.icon, resolve('build/icons/512x512.png'))
    if (name === 'rpm') {
      assert.equal(selected.config.options.specTemplate, resolve('build/rpm.spec.ejs'))
      assert.ok(selected.config.options.requires.includes('vips-heif'))
    } else {
      assert.ok(selected.config.options.depends.includes('libvips42'))
    }
  })
}
