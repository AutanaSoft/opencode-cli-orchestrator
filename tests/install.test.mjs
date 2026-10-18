import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PassThrough } from 'node:stream';
import { parse } from 'jsonc-parser';
import { install, parseArgs, terminalAsk } from '../scripts/install.mjs';

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMP_ROOT = '/tmp/opencode';
const fixtures = [];
const requiredResources = [
  'AGENTS.md',
  'agents/AutanaSoft.md',
  'agents/explore.md',
  'agents/worker.md',
  'agents/review.md',
  'templates/design-artifact-task.md',
  'templates/correction-task.md',
  'templates/synthesis-task.md',
  'templates/review-task.md',
  'templates/exploration-task.md',
  'templates/execution-task.md',
];

async function fixture() {
  await fs.mkdir(TEMP_ROOT, { recursive: true });
  const root = await fs.mkdtemp(path.join(TEMP_ROOT, 'installer-test-'));
  const result = {
    root,
    home: path.join(root, 'home'),
    configDir: path.join(root, 'config'),
    repositoryRoot: path.join(root, 'repository'),
    binDir: path.join(root, 'bin'),
    messages: [],
  };
  fixtures.push(root);
  await fs.mkdir(result.home, { recursive: true });
  await fs.mkdir(result.binDir, { recursive: true });
  await fs.mkdir(result.repositoryRoot, { recursive: true });
  await fs.cp(path.join(REPOSITORY_ROOT, 'src'), path.join(result.repositoryRoot, 'src'), { recursive: true });
  return result;
}

after(async () => {
  await Promise.all(fixtures.map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

async function run(target, options = {}) {
  const messages = [];
  const env = { HOME: target.home, PATH: '', ...(options.env ?? {}) };
  const result = await install({
    configDir: target.configDir,
    repositoryRoot: target.repositoryRoot,
    env,
    output: (message) => messages.push(message),
    ...options,
  });
  target.messages = messages;
  return result;
}

async function writeConfig(target, name, valueOrText) {
  await fs.mkdir(target.configDir, { recursive: true });
  const content = typeof valueOrText === 'string' ? valueOrText : `${JSON.stringify(valueOrText, null, 2)}\n`;
  await fs.writeFile(path.join(target.configDir, name), content);
  return content;
}

async function readConfig(target, name = 'opencode.jsonc') {
  return parse(await fs.readFile(path.join(target.configDir, name), 'utf8'));
}

async function fakeExecutable(target, name, directory = target.binDir) {
  await fs.mkdir(directory, { recursive: true });
  const executable = path.join(directory, name);
  const marker = path.join(target.root, `${name}-was-run`);
  await fs.writeFile(executable, `#!/bin/sh\nprintf executed > '${marker}'\nexit 99\n`, { mode: 0o755 });
  await fs.chmod(executable, 0o755);
  return { executable: await fs.realpath(executable), marker };
}

function fakeEnv(target, additional = {}) {
  return { HOME: target.home, PATH: target.binDir, ...additional };
}

async function exists(filePath) {
  try {
    await fs.lstat(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function promptAll(answer) {
  return async (_question, choices) => {
    if (choices.includes(answer)) return answer;
    if (choices.includes('yes')) return 'yes';
    if (choices.includes('keep-jsonc')) return 'keep-jsonc';
    if (choices.includes('keep')) return 'keep';
    return choices[0];
  };
}

test('T01 installs required resources and new configuration in an isolated destination', async () => {
  const target = await fixture();
  const result = await run(target, { yes: true });
  for (const resource of requiredResources)
    assert.equal(await exists(path.join(target.configDir, resource)), true, resource);
  assert.equal(await exists(path.join(target.configDir, 'instructions/engram.md')), false);
  assert.deepEqual((await readConfig(target)).mcp.servers, {
    context7: { type: 'remote', url: 'https://mcp.context7.com/mcp' },
  });
  assert.equal(await exists(result.backupDirectory), true);
});

test('T02 preserves nested properties, MCP servers, and unrelated instructions', async () => {
  const target = await fixture();
  const config = {
    $schema: 'https://opencode.ai/config.json',
    default_agent: 'AutanaSoft',
    custom: { nested: { keep: true }, list: ['one', 'two'] },
    mcp: {
      servers: { context7: { type: 'remote', url: 'https://mcp.context7.com/mcp' }, other: { command: ['custom'] } },
    },
    instructions: ['workspace.md'],
  };
  await writeConfig(target, 'opencode.jsonc', `// keep this comment\n${JSON.stringify(config, null, 2)}\n`);
  await run(target, { yes: true });
  const installed = await readConfig(target);
  assert.deepEqual(installed.custom, config.custom);
  assert.deepEqual(installed.mcp.servers.other, config.mcp.servers.other);
  assert.deepEqual(installed.instructions, ['workspace.md']);
  assert.match(await fs.readFile(path.join(target.configDir, 'opencode.jsonc'), 'utf8'), /^\/\/ keep this comment/m);
});

test('T03 edits existing JSON without losing comments or unrelated properties', async () => {
  const target = await fixture();
  const initial = '{\n  // comment in .json\n  "custom": {"nested": 7}\n}\n';
  await writeConfig(target, 'opencode.json', initial);
  await run(target, { yes: true });
  const text = await fs.readFile(path.join(target.configDir, 'opencode.json'), 'utf8');
  assert.match(text, /\/\/ comment in \.json/);
  assert.deepEqual((await readConfig(target, 'opencode.json')).custom, { nested: 7 });
  assert.equal(await exists(path.join(target.configDir, 'opencode.jsonc')), false);
});

test('T04 preserves comments and line endings in JSONC', async () => {
  const target = await fixture();
  const initial = '{\r\n  // user-owned note\r\n  "custom": {"value": 3}\r\n}\r\n';
  await writeConfig(target, 'opencode.jsonc', initial);
  await run(target, { yes: true });
  const output = await fs.readFile(path.join(target.configDir, 'opencode.jsonc'), 'utf8');
  assert.match(output, /\/\/ user-owned note/);
  assert.match(output, /\r\n/);
  assert.deepEqual((await readConfig(target)).custom, { value: 3 });
});

test('T05 creates JSONC when no configuration file exists', async () => {
  const target = await fixture();
  await run(target, { yes: true });
  assert.equal(await exists(path.join(target.configDir, 'opencode.jsonc')), true);
  assert.equal(await exists(path.join(target.configDir, 'opencode.json')), false);
});

test('T06 explicitly consolidates both files and preserves equal and exclusive values', async () => {
  const target = await fixture();
  const jsoncText = '{\n  // JSONC base\n  "base": {"same": 1},\n  "equal": [1, 2]\n}\n';
  await writeConfig(target, 'opencode.jsonc', jsoncText);
  await writeConfig(target, 'opencode.json', { base: { same: 1 }, equal: [1, 2], fromJson: { kept: true } });
  const ask = async (_question, choices) =>
    choices.includes('yes') ? 'yes' : choices.includes('keep-jsonc') ? 'keep-jsonc' : 'keep';
  await run(target, { ask });
  assert.equal(await exists(path.join(target.configDir, 'opencode.json')), false);
  const output = await readConfig(target);
  assert.deepEqual(output.base, { same: 1 });
  assert.deepEqual(output.equal, [1, 2]);
  assert.deepEqual(output.fromJson, { kept: true });
  assert.match(await fs.readFile(path.join(target.configDir, 'opencode.jsonc'), 'utf8'), /JSONC base/);
});

test('T07 treats arrays present in both files as atomic conflicts; they are not concatenated and JSONC can be kept', async () => {
  const target = await fixture();
  await writeConfig(target, 'opencode.jsonc', '{"nested":{"fromJsonc":1,"same":1},"array":["jsonc"]}\n');
  await writeConfig(target, 'opencode.json', { nested: { fromJson: 2, same: 2 }, array: ['json'] });
  const choices = [];
  const ask = async (question, options) => {
    choices.push(question);
    assert.equal(await exists(path.join(target.configDir, 'opencode.json')), true);
    assert.equal((await fs.readFile(path.join(target.configDir, 'opencode.jsonc'), 'utf8')).includes('jsonc'), true);
    if (options.includes('yes')) return 'yes';
    if (options.includes('keep-jsonc')) return 'keep-jsonc';
    return 'keep';
  };
  await run(target, { ask });
  const output = await readConfig(target);
  assert.deepEqual(output.nested, { fromJsonc: 1, fromJson: 2, same: 1 });
  assert.deepEqual(output.array, ['jsonc']);
  assert.equal(
    choices.some((question) => question.includes('array')),
    true
  );
});

test('T08 rolls back consolidation if removing JSON fails', async () => {
  const target = await fixture();
  const originalJsonc = '{\n  // exact base\n  "jsonc": true\n}\n';
  const originalJson = '{"json":true}\n';
  await writeConfig(target, 'opencode.jsonc', originalJsonc);
  await writeConfig(target, 'opencode.json', originalJson);
  await fs.chmod(path.join(target.configDir, 'opencode.jsonc'), 0o640);
  await assert.rejects(
    run(target, {
      ask: promptAll('yes'),
      hooks: {
        beforeOperation: ({ kind }) => {
          if (kind === 'delete') throw new Error('injected delete failure');
        },
      },
    }),
    /previous changes were rolled back/
  );
  assert.equal(await fs.readFile(path.join(target.configDir, 'opencode.jsonc'), 'utf8'), originalJsonc);
  assert.equal(await fs.readFile(path.join(target.configDir, 'opencode.json'), 'utf8'), originalJson);
  assert.equal((await fs.stat(path.join(target.configDir, 'opencode.jsonc'))).mode & 0o777, 0o640);
  assert.equal(await exists(path.join(target.configDir, 'AGENTS.md')), false);
  const backupRun = path.join(
    target.configDir,
    '.autanasoft-backups',
    (await fs.readdir(path.join(target.configDir, '.autanasoft-backups')))[0]
  );
  assert.equal((await fs.stat(backupRun)).mode & 0o777, 0o700);
  assert.equal((await fs.stat(path.join(backupRun, 'journal.json'))).mode & 0o777, 0o600);
  assert.equal((await fs.stat(path.join(backupRun, '000.bin'))).mode & 0o777, 0o600);
});

test('T09 replaces a conflicting MCP server as a unit instead of mixing its fields', async () => {
  const target = await fixture();
  const codegraph = await fakeExecutable(target, 'codegraph');
  await writeConfig(target, 'opencode.jsonc', {
    mcp: { servers: { codegraph: { command: ['untrusted'], apiKey: 'keep-only-if-kept' } } },
  });
  const ask = async (question, choices) =>
    question.includes('codegraph') && choices.includes('replace') ? 'replace' : promptAll('replace')(question, choices);
  await run(target, { env: fakeEnv(target), ask });
  const installed = (await readConfig(target)).mcp.servers.codegraph;
  assert.deepEqual(installed, { type: 'local', command: ['codegraph', 'serve', '--mcp'] });
  assert.equal(await exists(codegraph.marker), false);
});

test('T10 skips the Engram instruction when the executable is not detected', async () => {
  const target = await fixture();
  await run(target, { yes: true });
  const config = await readConfig(target);
  assert.equal(Object.hasOwn(config.mcp.servers, 'engram'), false);
  assert.equal(config.instructions, undefined);
  assert.equal(await exists(path.join(target.configDir, 'instructions/engram.md')), false);
});

test('T11 detects Engram through PATH, uses absolute paths, and does not run the binary', async () => {
  const target = await fixture();
  const engram = await fakeExecutable(target, 'engram');
  await run(target, { yes: true, env: fakeEnv(target) });
  const config = await readConfig(target);
  assert.deepEqual(config.mcp.servers.engram.command, [engram.executable, 'mcp', '--tools=agent']);
  assert.deepEqual(config.instructions, [path.join(target.configDir, 'instructions', 'engram.md')]);
  assert.equal(await exists(engram.marker), false);
  assert.match(target.messages.join(''), /compatibility unknown; operability not checked/);

  const fallback = await fixture();
  const fallbackBin = path.join(fallback.home, '.local', 'bin');
  const fallbackEngram = await fakeExecutable(fallback, 'engram', fallbackBin);
  await run(fallback, { yes: true, env: fakeEnv(fallback, { PATH: '' }) });
  assert.deepEqual((await readConfig(fallback)).mcp.servers.engram.command, [
    fallbackEngram.executable,
    'mcp',
    '--tools=agent',
  ]);
  assert.equal(await exists(fallbackEngram.marker), false);
});

test('T12 preserves a conflicting Engram configuration and does not install or enable its instruction', async () => {
  const target = await fixture();
  const engram = await fakeExecutable(target, 'engram');
  const existing = { command: ['different-engram', 'mcp'], custom: 'preserve' };
  await writeConfig(target, 'opencode.jsonc', { mcp: { servers: { engram: existing } } });
  const ask = async (question, choices) =>
    question.includes('engram') && choices.includes('keep') ? 'keep' : choices[0];
  await run(target, { env: fakeEnv(target), ask });
  const config = await readConfig(target);
  assert.deepEqual(config.mcp.servers.engram, existing);
  assert.equal(config.instructions, undefined);
  assert.equal(await exists(path.join(target.configDir, 'instructions/engram.md')), false);
  assert.equal(await exists(engram.marker), false);
});

test('T13 only detects Codegraph and keeps Context7 remote without connectivity checks or execution', async () => {
  const target = await fixture();
  const codegraph = await fakeExecutable(target, 'codegraph');
  await run(target, { yes: true, env: fakeEnv(target) });
  const config = await readConfig(target);
  assert.deepEqual(config.mcp.servers.context7, { type: 'remote', url: 'https://mcp.context7.com/mcp' });
  assert.deepEqual(config.mcp.servers.codegraph.command, ['codegraph', 'serve', '--mcp']);
  assert.equal(await exists(codegraph.marker), false);
  assert.match(target.messages.join(''), /Context7: remote configured; connectivity and operability not checked/);
});

test('T14 restores missing resources, updates managed resources, and protects local edits', async () => {
  const target = await fixture();
  await fs.mkdir(target.configDir, { recursive: true });
  await fs.copyFile(path.join(target.repositoryRoot, 'src', 'AGENTS.md'), path.join(target.configDir, 'AGENTS.md'));
  await run(target, { yes: true });
  const manifest = JSON.parse(await fs.readFile(path.join(target.configDir, '.autanasoft-install.json'), 'utf8'));
  assert.equal(typeof manifest.files['AGENTS.md'], 'string');
  const agentsPath = path.join(target.configDir, 'AGENTS.md');
  await fs.rm(agentsPath);
  const updatedSource = path.join(target.repositoryRoot, 'src', 'AGENTS.md');
  await fs.appendFile(updatedSource, '\nManaged update fixture.\n');
  await run(target, { yes: true });
  assert.match(await fs.readFile(agentsPath, 'utf8'), /Managed update fixture/);
  const reviewPath = path.join(target.configDir, 'agents/review.md');
  await fs.appendFile(reviewPath, '\nlocal edit\n');
  const ask = async (_question, choices) => (choices.includes('keep') ? 'keep' : choices[0]);
  await run(target, { ask });
  assert.match(await fs.readFile(reviewPath, 'utf8'), /local edit/);
});

test('T15 a no-op rerun preserves the manifest, mtime, and number of backups', async () => {
  const target = await fixture();
  const first = await run(target, { yes: true });
  const manifestPath = path.join(target.configDir, '.autanasoft-install.json');
  const originalBytes = await fs.readFile(manifestPath);
  const originalTime = (await fs.stat(manifestPath)).mtimeMs;
  const backupEntries = await fs.readdir(path.join(target.configDir, '.autanasoft-backups'));
  const second = await run(target, { yes: true });
  assert.equal(second.backupDirectory, undefined);
  assert.deepEqual(await fs.readFile(manifestPath), originalBytes);
  assert.equal((await fs.stat(manifestPath)).mtimeMs, originalTime);
  assert.deepEqual(await fs.readdir(path.join(target.configDir, '.autanasoft-backups')), backupEntries);
  assert.notEqual(first.backupDirectory, undefined);
});

test('T16 does not adopt or overwrite a same-named resource without a manifest', async () => {
  const target = await fixture();
  await fs.mkdir(target.configDir, { recursive: true });
  const custom = 'unowned content\n';
  await fs.writeFile(path.join(target.configDir, 'AGENTS.md'), custom);
  await fs.mkdir(path.join(target.configDir, 'agents'), { recursive: true });
  await fs.writeFile(path.join(target.configDir, 'agents/AutanaSoft.md'), 'custom primary agent\n');
  const ask = async (_question, choices) => (choices.includes('keep') ? 'keep' : choices[0]);
  await run(target, { ask });
  assert.equal(await fs.readFile(path.join(target.configDir, 'AGENTS.md'), 'utf8'), custom);
  assert.equal(
    await fs.readFile(path.join(target.configDir, 'agents/AutanaSoft.md'), 'utf8'),
    'custom primary agent\n'
  );
  assert.equal((await readConfig(target)).default_agent, undefined);
  const manifest = JSON.parse(await fs.readFile(path.join(target.configDir, '.autanasoft-install.json'), 'utf8'));
  assert.equal(manifest.files['AGENTS.md'], undefined);
});

test('T17 fresh and conflicting dry runs create no files or temporary files and run no binaries', async () => {
  const fresh = await fixture();
  const fake = await fakeExecutable(fresh, 'engram');
  const result = await run(fresh, { dryRun: true, env: fakeEnv(fresh) });
  assert.equal(result.conflicts, 0);
  assert.equal(await exists(fresh.configDir), false);
  assert.equal(await exists(fake.marker), false);

  const existing = await fixture();
  await fs.mkdir(existing.configDir, { recursive: true });
  await fs.writeFile(path.join(existing.configDir, 'AGENTS.md'), 'secret-not-previewed');
  const snapshot = await fs.readFile(path.join(existing.configDir, 'AGENTS.md'));
  const originalMtime = (await fs.stat(path.join(existing.configDir, 'AGENTS.md'))).mtimeMs;
  const conflictResult = await run(existing, { dryRun: true });
  assert.equal(conflictResult.conflicts > 0, true);
  assert.deepEqual(await fs.readFile(path.join(existing.configDir, 'AGENTS.md')), snapshot);
  assert.equal((await fs.stat(path.join(existing.configDir, 'AGENTS.md'))).mtimeMs, originalMtime);
  assert.deepEqual(await fs.readdir(existing.configDir), ['AGENTS.md']);
});

test('T18 --yes does not choose conflicts; it cancels before writing', async () => {
  const target = await fixture();
  await fs.mkdir(target.configDir, { recursive: true });
  await fs.writeFile(path.join(target.configDir, 'AGENTS.md'), 'unowned');
  await assert.rejects(run(target, { yes: true }), /Unresolved conflict/);
  assert.deepEqual(await fs.readdir(target.configDir), ['AGENTS.md']);

  const mcp = await fixture();
  const originalText = await writeConfig(mcp, 'opencode.jsonc', {
    mcp: { servers: { context7: { type: 'local', command: ['private'] } } },
  });
  await assert.rejects(run(mcp, { yes: true }), /Unresolved conflict/);
  assert.equal(await fs.readFile(path.join(mcp.configDir, 'opencode.jsonc'), 'utf8'), originalText);
  assert.deepEqual(await fs.readdir(mcp.configDir), ['opencode.jsonc']);

  const dual = await fixture();
  await writeConfig(dual, 'opencode.jsonc', '{}\n');
  await writeConfig(dual, 'opencode.json', '{}\n');
  await assert.rejects(run(dual, { yes: true }), /Consolidating.*requires explicit interactive confirmation/);
  assert.deepEqual((await fs.readdir(dual.configDir)).sort(), ['opencode.json', 'opencode.jsonc']);
});

test('T19 rolls back prior writes after an injected ordinary failure', async () => {
  const target = await fixture();
  await assert.rejects(
    run(target, {
      yes: true,
      hooks: {
        afterOperation: ({ index }) => {
          if (index === 1) throw new Error('injected');
        },
      },
    }),
    /previous changes were rolled back/
  );
  assert.equal(await exists(path.join(target.configDir, 'AGENTS.md')), false);
  assert.equal(await exists(path.join(target.configDir, 'agents/AutanaSoft.md')), false);
  assert.equal(await exists(path.join(target.configDir, '.autanasoft-install.json')), false);
  const backupRoot = path.join(target.configDir, '.autanasoft-backups');
  assert.equal((await fs.readdir(backupRoot)).length, 1);
  const backupRun = path.join(backupRoot, (await fs.readdir(backupRoot))[0]);
  const journal = JSON.parse(await fs.readFile(path.join(backupRun, 'journal.json'), 'utf8'));
  assert.equal(journal.state, 'rolled-back');
  assert.equal(journal.operations[0].state, 'rolled-back');
});

test('T20 rollback does not overwrite a concurrent write and reports manual recovery', async () => {
  const target = await fixture();
  const agentsPath = path.join(target.configDir, 'AGENTS.md');
  await assert.rejects(
    run(target, {
      yes: true,
      hooks: {
        beforeOperation: async ({ index }) => {
          if (index === 1) {
            await fs.writeFile(agentsPath, 'concurrent writer');
            throw new Error('injected concurrent interruption');
          }
        },
      },
    }),
    /manual recovery/
  );
  assert.equal(await fs.readFile(agentsPath, 'utf8'), 'concurrent writer');
  const backupRoot = path.join(target.configDir, '.autanasoft-backups');
  const backupRun = path.join(backupRoot, (await fs.readdir(backupRoot))[0]);
  const journal = JSON.parse(await fs.readFile(path.join(backupRun, 'journal.json'), 'utf8'));
  assert.equal(journal.state, 'manual-recovery-needed');
  assert.deepEqual(journal.recoveryPaths, ['AGENTS.md']);
  assert.equal(journal.operations[0].plannedHash.length, 64);
});

test('T21 rejects symbolic links in the destination and its ancestors', async () => {
  const target = await fixture();
  await fs.mkdir(target.configDir, { recursive: true });
  const outside = path.join(target.root, 'outside');
  await fs.mkdir(outside);
  await fs.symlink(outside, path.join(target.configDir, 'agents'));
  await assert.rejects(run(target, { yes: true }), /symbolic link/);
  assert.deepEqual(await fs.readdir(outside), []);

  const linked = await fixture();
  const realParent = path.join(linked.root, 'real-parent');
  await fs.mkdir(realParent);
  const alias = path.join(linked.root, 'alias');
  await fs.symlink(realParent, alias);
  linked.configDir = path.join(alias, 'config');
  await assert.rejects(run(linked, { yes: true }), /symbolic link/);
  assert.equal(await exists(path.join(realParent, 'config')), false);
});

test('T22 rejects invalid JSON, a non-object root, and duplicate keys without writing', async () => {
  for (const [index, text, expected] of [
    [0, '{"broken": }', /Invalid configuration/],
    [1, '[1, 2]', /root.*JSON object/],
    [2, '{"duplicate":1,"duplicate":2}', /Duplicate key/],
  ]) {
    const target = await fixture();
    await writeConfig(target, 'opencode.jsonc', text);
    await assert.rejects(run(target, { yes: true }), expected, `case ${index}`);
    assert.deepEqual(await fs.readdir(target.configDir), ['opencode.jsonc']);
  }
});

test('T23 rejects a tampered manifest and paths outside the allowlist', async () => {
  const invalidManifests = [
    { schemaVersion: 1, files: { '../../escape': 'a'.repeat(64) }, configuration: {} },
    { schemaVersion: 999, files: {}, configuration: {} },
    { schemaVersion: 1, files: {}, configuration: {}, extra: true },
  ];
  for (const value of invalidManifests) {
    const target = await fixture();
    await fs.mkdir(target.configDir, { recursive: true });
    await fs.writeFile(path.join(target.configDir, '.autanasoft-install.json'), JSON.stringify(value));
    await assert.rejects(run(target, { yes: true }), /Invalid manifest/);
    assert.equal(await exists(path.join(target.root, 'escape')), false);
    assert.deepEqual(await fs.readdir(target.configDir), ['.autanasoft-install.json']);
  }
});

test('T24 the preview does not reveal configuration credentials', async () => {
  const target = await fixture();
  await writeConfig(target, 'opencode.jsonc', {
    custom: { apiKey: 'top-secret-value' },
    mcp: { servers: { context7: { type: 'local', command: ['private'], token: 'another-secret' } } },
  });
  await run(target, { dryRun: true });
  const previewText = target.messages.join('');
  assert.doesNotMatch(previewText, /top-secret-value|another-secret|private/);
  assert.match(previewText, /conflict mcp\.servers\.context7/);
});

test('T25 resolves HOME/XDG without OpenCode and uses the same destination for check and install', async () => {
  const homeTarget = await fixture();
  assert.equal(await exists(path.join(homeTarget.binDir, 'opencode')), false);
  const homePreview = await run(homeTarget, {
    configDir: undefined,
    dryRun: true,
    env: fakeEnv(homeTarget),
  });
  assert.equal(homePreview.configDir, path.join(homeTarget.home, '.config', 'opencode'));
  assert.match(homeTarget.messages.join(''), /Destination source: HOME\/\.config\/opencode/);
  assert.equal(await exists(homePreview.configDir), false);

  const xdgTarget = await fixture();
  const xdgConfigHome = path.join(xdgTarget.root, 'xdg-config');
  const xdgEnv = fakeEnv(xdgTarget, { XDG_CONFIG_HOME: xdgConfigHome });
  const checkResult = await run(xdgTarget, { configDir: undefined, dryRun: true, env: xdgEnv });
  const expectedXdgDestination = path.join(xdgConfigHome, 'opencode');
  assert.equal(checkResult.configDir, expectedXdgDestination);
  assert.match(xdgTarget.messages.join(''), /Destination source: XDG_CONFIG_HOME\/opencode/);
  assert.equal(await exists(xdgConfigHome), false);
  await run(xdgTarget, { configDir: undefined, yes: true, env: xdgEnv });
  assert.equal(await exists(path.join(expectedXdgDestination, 'AGENTS.md')), true);
  assert.equal(await exists(xdgTarget.configDir), false);
});

test('T40 applies destination precedence, treats OPENCODE_CONFIG as a file, and allows empty variables', async () => {
  const directoryTarget = await fixture();
  const configuredDirectory = path.join(directoryTarget.root, 'configured-opencode');
  const xdgConfigHome = path.join(directoryTarget.root, 'xdg-config');
  const directoryResult = await run(directoryTarget, {
    configDir: undefined,
    dryRun: true,
    env: fakeEnv(directoryTarget, {
      OPENCODE_CONFIG_DIR: configuredDirectory,
      XDG_CONFIG_HOME: xdgConfigHome,
    }),
  });
  assert.equal(directoryResult.configDir, configuredDirectory);
  assert.match(directoryTarget.messages.join(''), /Destination source: OPENCODE_CONFIG_DIR/);
  assert.equal(await exists(configuredDirectory), false);
  assert.equal(await exists(xdgConfigHome), false);

  const emptyTarget = await fixture();
  const emptyResult = await run(emptyTarget, {
    configDir: undefined,
    dryRun: true,
    env: fakeEnv(emptyTarget, { OPENCODE_CONFIG_DIR: '', XDG_CONFIG_HOME: '' }),
  });
  assert.equal(emptyResult.configDir, path.join(emptyTarget.home, '.config', 'opencode'));

  const explicitTarget = await fixture();
  const explicitDirectory = path.join(explicitTarget.root, 'explicit-opencode');
  const opencodeConfigPath = path.join(explicitTarget.root, 'private-custom-config.jsonc');
  await fs.writeFile(opencodeConfigPath, 'private fixture value');
  const explicitResult = await run(explicitTarget, {
    configDir: explicitDirectory,
    dryRun: true,
    env: fakeEnv(explicitTarget, {
      OPENCODE_CONFIG_DIR: 'relative-dir',
      XDG_CONFIG_HOME: 'relative-xdg',
      OPENCODE_CONFIG: opencodeConfigPath,
    }),
  });
  assert.equal(explicitResult.configDir, explicitDirectory);
  assert.match(explicitTarget.messages.join(''), /Destination source: --config-dir/);
  assert.match(explicitTarget.messages.join(''), /OPENCODE_CONFIG points to a file/);
  assert.doesNotMatch(explicitTarget.messages.join(''), /private-custom-config|private fixture value/);
  assert.equal(await fs.readFile(opencodeConfigPath, 'utf8'), 'private fixture value');
  assert.equal(await exists(explicitDirectory), false);

  const relativeTarget = await fixture();
  const relativeResult = await run(relativeTarget, {
    configDir: 'relative-opencode',
    cwd: relativeTarget.root,
    dryRun: true,
    env: fakeEnv(relativeTarget),
  });
  assert.equal(relativeResult.configDir, path.join(relativeTarget.root, 'relative-opencode'));

  const fileOverrideTarget = await fixture();
  const fileOverridePath = path.join(fileOverrideTarget.root, 'custom-file.jsonc');
  const fileOverrideContents = 'not parsed by the installer';
  await fs.writeFile(fileOverridePath, fileOverrideContents);
  const fileOverrideResult = await run(fileOverrideTarget, {
    configDir: undefined,
    dryRun: true,
    env: fakeEnv(fileOverrideTarget, { OPENCODE_CONFIG: fileOverridePath }),
  });
  assert.equal(fileOverrideResult.configDir, path.join(fileOverrideTarget.home, '.config', 'opencode'));
  assert.match(fileOverrideTarget.messages.join(''), /Destination source: HOME\/\.config\/opencode/);
  assert.match(fileOverrideTarget.messages.join(''), /OPENCODE_CONFIG points to a file/);
  assert.doesNotMatch(fileOverrideTarget.messages.join(''), /custom-file\.jsonc/);
  assert.equal(await fs.readFile(fileOverridePath, 'utf8'), fileOverrideContents);
  assert.equal(await exists(fileOverrideResult.configDir), false);
});

test('T41 rejects relative paths in the selected environment variable before writing', async () => {
  for (const selectedVariable of ['OPENCODE_CONFIG_DIR', 'XDG_CONFIG_HOME']) {
    const target = await fixture();
    const lowerPriorityXdg = path.join(target.root, 'lower-priority-xdg');
    const environment =
      selectedVariable === 'OPENCODE_CONFIG_DIR'
        ? { OPENCODE_CONFIG_DIR: 'relative-dir', XDG_CONFIG_HOME: lowerPriorityXdg }
        : { XDG_CONFIG_HOME: 'relative-xdg' };
    await assert.rejects(
      run(target, { configDir: undefined, yes: true, env: fakeEnv(target, environment) }),
      new RegExp(`${selectedVariable} must be an absolute path`)
    );
    assert.equal(await exists(target.configDir), false);
    assert.equal(await exists(path.join(target.home, '.config', 'opencode')), false);
    assert.equal(await exists(lowerPriorityXdg), false);
  }
});

test('T26 limits all writes to the explicit temporary destination', async () => {
  const target = await fixture();
  await run(target, { yes: true });
  assert.equal(await exists(path.join(target.configDir, 'AGENTS.md')), true);
  assert.equal(await exists(path.join(target.home, '.config/opencode')), false);
  assert.equal(await exists(path.join(target.repositoryRoot, 'AGENTS.md')), false);
});

test('T27 deduplicates/adapts its own instruction and always installs six templates', async () => {
  const target = await fixture();
  const engram = await fakeExecutable(target, 'engram');
  const destinationInstruction = path.join(target.configDir, 'instructions', 'engram.md');
  await writeConfig(target, 'opencode.jsonc', {
    mcp: { servers: { engram: { type: 'local', command: [engram.executable, 'mcp', '--tools=agent'] } } },
    instructions: ['workspace.md', './instructions/engram.md', destinationInstruction, './instructions/engram.md'],
  });
  await run(target, { yes: true, env: fakeEnv(target) });
  const config = await readConfig(target);
  assert.deepEqual(config.instructions, ['workspace.md', destinationInstruction]);
  assert.equal(await exists(destinationInstruction), true);
  for (const template of requiredResources.filter((resource) => resource.startsWith('templates/'))) {
    assert.equal(await exists(path.join(target.configDir, template)), true, template);
  }
});

test('T28 configures only detected local executables; missing ones do not remove existing servers', async () => {
  const both = await fixture();
  const codegraph = await fakeExecutable(both, 'codegraph');
  const engram = await fakeExecutable(both, 'engram');
  await run(both, { yes: true, env: fakeEnv(both) });
  let config = await readConfig(both);
  assert.equal(config.mcp.servers.codegraph.command[0], 'codegraph');
  assert.equal(config.mcp.servers.engram.command[0], engram.executable);
  assert.equal(await exists(codegraph.marker), false);
  assert.equal(await exists(engram.marker), false);

  const one = await fixture();
  const onlyCodegraph = await fakeExecutable(one, 'codegraph');
  await writeConfig(one, 'opencode.jsonc', { mcp: { servers: { engram: { command: ['existing'] } } } });
  await run(one, { yes: true, env: fakeEnv(one) });
  config = await readConfig(one);
  assert.deepEqual(config.mcp.servers.engram, { command: ['existing'] });
  assert.equal(config.mcp.servers.codegraph.command[0], 'codegraph');
  assert.equal(await exists(onlyCodegraph.marker), false);

  const neither = await fixture();
  await writeConfig(neither, 'opencode.jsonc', { mcp: { servers: { codegraph: { command: ['keep'] } } } });
  await run(neither, { yes: true });
  assert.deepEqual((await readConfig(neither)).mcp.servers.codegraph, { command: ['keep'] });
  assert.match(neither.messages.join(''), /Codegraph: not detected/);
});

test('T29 does not enable disabled Engram even when its executable is present', async () => {
  const target = await fixture();
  await fakeExecutable(target, 'engram');
  const disabled = { enabled: false, command: ['existing-engram'] };
  await writeConfig(target, 'opencode.jsonc', { mcp: { servers: { engram: disabled } } });
  await run(target, { yes: true, env: fakeEnv(target) });
  const config = await readConfig(target);
  assert.deepEqual(config.mcp.servers.engram, disabled);
  assert.equal(config.instructions, undefined);
  assert.equal(await exists(path.join(target.configDir, 'instructions/engram.md')), false);
});

test('T30 validates duplicate and unknown arguments and invalid combinations', () => {
  assert.deepEqual(parseArgs(['--config-dir', '/tmp/example', '--dry-run']), {
    configDir: '/tmp/example',
    dryRun: true,
    yes: false,
    help: false,
  });
  assert.throws(() => parseArgs(['--config-dir']), /Missing value/);
  assert.throws(() => parseArgs(['--dry-run', '--dry-run']), /Duplicate option/);
  assert.throws(() => parseArgs(['--unknown']), /Unknown option/);
  assert.throws(() => parseArgs(['--help', '--yes']), /cannot be combined/);
});

test('T31 takes JSON in dual-file conflicts and keeps text and managed manifest consistent', async () => {
  const target = await fixture();
  await writeConfig(target, 'opencode.jsonc', {
    custom: { selected: 'jsonc' },
    mcp: { servers: { context7: { type: 'remote', url: 'https://jsonc.example/mcp' } } },
  });
  const context7 = { type: 'remote', url: 'https://mcp.context7.com/mcp' };
  await writeConfig(target, 'opencode.json', {
    custom: { selected: 'json' },
    mcp: { servers: { context7 } },
  });
  const ask = async (_question, choices) => {
    if (choices.includes('yes')) return 'yes';
    if (choices.includes('take-json')) return 'take-json';
    return choices[0];
  };

  await run(target, { ask });

  const finalText = await fs.readFile(path.join(target.configDir, 'opencode.jsonc'), 'utf8');
  const finalValue = parse(finalText);
  assert.equal(finalValue.custom.selected, 'json');
  assert.deepEqual(finalValue.mcp.servers.context7, context7);
  const manifest = JSON.parse(await fs.readFile(path.join(target.configDir, '.autanasoft-install.json'), 'utf8'));
  assert.equal(
    manifest.configuration.context7,
    createHash('sha256').update(JSON.stringify(context7), 'utf8').digest('hex')
  );
});

test('T32 consolidates any MCP server as a unit for either choice', async () => {
  for (const choice of ['keep-jsonc', 'take-json']) {
    const target = await fixture();
    const jsoncServer = {
      command: ['jsonc-command'],
      token: 'jsonc-only-credential',
      jsoncOnly: true,
    };
    const jsonServer = {
      command: ['json-command'],
      credential: 'json-only-credential',
      jsonOnly: true,
    };
    const stableServer = { command: ['same-command'], token: 'same-token' };
    await writeConfig(target, 'opencode.jsonc', {
      mcp: {
        servers: {
          other: jsoncServer,
          stable: stableServer,
          jsoncOnlyServer: { command: ['jsonc-exclusive'] },
        },
      },
    });
    await writeConfig(target, 'opencode.json', {
      mcp: {
        servers: {
          other: jsonServer,
          stable: stableServer,
          jsonOnlyServer: { command: ['json-exclusive'] },
        },
      },
    });
    const ask = async (_question, choices) => {
      if (choices.includes('yes')) return 'yes';
      if (choices.includes('keep-jsonc') || choices.includes('take-json')) return choice;
      return choices[0];
    };

    await run(target, { ask });

    const servers = (await readConfig(target)).mcp.servers;
    assert.deepEqual(servers.other, choice === 'keep-jsonc' ? jsoncServer : jsonServer);
    assert.deepEqual(servers.stable, stableServer);
    assert.deepEqual(servers.jsoncOnlyServer, { command: ['jsonc-exclusive'] });
    assert.deepEqual(servers.jsonOnlyServer, { command: ['json-exclusive'] });
  }
});

test('T33 consolidates equivalent files and backs up both originals in the journal', async () => {
  const target = await fixture();
  await run(target, { yes: true });
  const jsoncPath = path.join(target.configDir, 'opencode.jsonc');
  const jsonPath = path.join(target.configDir, 'opencode.json');
  const jsoncBytes = await fs.readFile(jsoncPath);
  const jsonValue = parse(jsoncBytes.toString('utf8'));
  const jsonBytes = Buffer.from(`${JSON.stringify(jsonValue, null, 2)}\n`);
  await fs.writeFile(jsonPath, jsonBytes);
  const ask = async (_question, choices) => (choices.includes('yes') ? 'yes' : choices[0]);

  const result = await run(target, { ask });

  const journal = JSON.parse(await fs.readFile(path.join(result.backupDirectory, 'journal.json'), 'utf8'));
  for (const [configName, original] of [
    ['opencode.jsonc', jsoncBytes],
    ['opencode.json', jsonBytes],
  ]) {
    const operation = journal.operations.find(({ path: relativePath }) => relativePath === configName);
    assert.ok(operation, `${configName} appears in the journal`);
    assert.ok(operation.backup, `${configName} has an identified backup`);
    assert.deepEqual(await fs.readFile(path.join(result.backupDirectory, operation.backup)), original);
  }
});

test('T34 preserves the first position when normalizing and deduplicating instruction paths', async () => {
  for (const relativeFirst of [true, false]) {
    const target = await fixture();
    const engram = await fakeExecutable(target, 'engram');
    const instructionPath = path.join(target.configDir, 'instructions', 'engram.md');
    const entries = relativeFirst
      ? ['./instructions/engram.md', instructionPath, 'workspace.md', './instructions/engram.md', instructionPath]
      : [instructionPath, './instructions/engram.md', 'workspace.md', './instructions/engram.md', instructionPath];
    await writeConfig(target, 'opencode.jsonc', {
      mcp: { servers: { engram: { type: 'local', command: [engram.executable, 'mcp', '--tools=agent'] } } },
      instructions: entries,
    });

    await run(target, { yes: true, env: fakeEnv(target) });

    assert.deepEqual((await readConfig(target)).instructions, [instructionPath, 'workspace.md']);
  }
});

test('T35 requires final confirmation, cancels without writes, and skips the prompt for a no-op', async () => {
  const noTty = await fixture();
  await assert.rejects(run(noTty), /Final interactive confirmation is required/);
  assert.equal(await exists(noTty.configDir), false);

  for (const answer of ['no', 'cancel']) {
    const target = await fixture();
    const ask = async (_question, choices) => {
      assert.deepEqual(choices, ['yes', 'no', 'cancel']);
      return answer;
    };
    await assert.rejects(run(target, { ask }), /Installation canceled/);
    assert.equal(await exists(target.configDir), false);
  }

  const unchanged = await fixture();
  await run(unchanged, { yes: true });
  const prompts = [];
  const result = await run(unchanged, {
    ask: async (question) => {
      prompts.push(question);
      return 'yes';
    },
  });
  assert.deepEqual(result.changed, []);
  assert.deepEqual(prompts, []);

  const resolvedResource = await fixture();
  await fs.mkdir(resolvedResource.configDir, { recursive: true });
  await fs.writeFile(path.join(resolvedResource.configDir, 'AGENTS.md'), 'user-owned agent instructions\n');
  const previewAsk = async (question, choices) => {
    if (question.includes('AGENTS.md') && choices.includes('keep')) return 'keep';
    if (choices.includes('yes')) return 'yes';
    return choices[0];
  };
  await run(resolvedResource, { ask: previewAsk });
  const finalPreview = resolvedResource.messages.join('').split('Full plan ready to apply:').at(-1);
  assert.match(finalPreview, /keep AGENTS\.md \(kept by explicit choice\)/);
  assert.doesNotMatch(finalPreview, /conflict AGENTS\.md/);
});

test('T36 respects disabled:true for Engram and preserves disabled Codegraph/Context7 servers', async () => {
  const engramTarget = await fixture();
  await fakeExecutable(engramTarget, 'engram');
  const disabledEngram = { disabled: true, command: ['existing-engram'], custom: 'keep' };
  await writeConfig(engramTarget, 'opencode.jsonc', {
    mcp: { servers: { engram: disabledEngram } },
    instructions: ['workspace.md'],
  });
  await run(engramTarget, { yes: true, env: fakeEnv(engramTarget) });
  const engramConfig = await readConfig(engramTarget);
  assert.deepEqual(engramConfig.mcp.servers.engram, disabledEngram);
  assert.deepEqual(engramConfig.instructions, ['workspace.md']);
  assert.equal(await exists(path.join(engramTarget.configDir, 'instructions/engram.md')), false);
  const engramManifest = JSON.parse(
    await fs.readFile(path.join(engramTarget.configDir, '.autanasoft-install.json'), 'utf8')
  );
  assert.equal(engramManifest.files['instructions/engram.md'], undefined);
  assert.match(engramTarget.messages.join(''), /Existing Engram is disabled/);

  const mcpTarget = await fixture();
  await fakeExecutable(mcpTarget, 'codegraph');
  const disabledContext7 = { disabled: true, type: 'remote', url: 'https://custom.example/mcp' };
  const disabledCodegraph = { disabled: true, command: ['existing-codegraph'], token: 'keep' };
  await writeConfig(mcpTarget, 'opencode.jsonc', {
    mcp: { servers: { context7: disabledContext7, codegraph: disabledCodegraph } },
  });
  const ask = async (question, choices) => {
    if (question.includes('mcp.servers.') && choices.includes('keep')) return 'keep';
    if (choices.includes('yes')) return 'yes';
    return choices[0];
  };
  await run(mcpTarget, { env: fakeEnv(mcpTarget), ask });
  const mcpConfig = await readConfig(mcpTarget);
  assert.deepEqual(mcpConfig.mcp.servers.context7, disabledContext7);
  assert.deepEqual(mcpConfig.mcp.servers.codegraph, disabledCodegraph);
});

test('T37 JSONC edits detect four-space indentation and tabs, and preserve CRLF', async () => {
  const cases = [
    {
      name: 'spaces',
      text: '{\n    // keep comment\n    "custom": {\n        "nested": true\n    }\n}\n',
      inserted: /\n    "mcp": \{\n        "servers": \{/,
    },
    {
      name: 'tabs',
      text: '{\r\n\t// keep comment\r\n\t"custom": {\r\n\t\t"nested": true\r\n\t}\r\n}\r\n',
      inserted: /\r\n\t"mcp": \{\r\n\t\t"servers": \{/,
    },
  ];
  for (const style of cases) {
    const target = await fixture();
    await writeConfig(target, 'opencode.jsonc', style.text);

    await run(target, { yes: true });

    const output = await fs.readFile(path.join(target.configDir, 'opencode.jsonc'), 'utf8');
    assert.match(output, style.inserted, style.name);
    assert.match(output, /\/\/ keep comment/);
    assert.deepEqual(parse(output).custom, { nested: true });
    if (style.name === 'tabs') assert.match(output, /\r\n/);
  }
});

test('T38 rollback does not follow an ancestor symlink and preserves the backup for manual recovery', async () => {
  const target = await fixture();
  await run(target, { yes: true });
  const agentPath = path.join(target.configDir, 'agents', 'AutanaSoft.md');
  const originalBytes = await fs.readFile(agentPath);
  const sourceAgentPath = path.join(target.repositoryRoot, 'src', 'agents', 'AutanaSoft.md');
  await fs.appendFile(sourceAgentPath, '\nRollback symlink regression fixture.\n');
  const expectedExternalBytes = await fs.readFile(sourceAgentPath);
  const movedAgentsPath = path.join(target.root, 'moved-agents');

  await assert.rejects(
    run(target, {
      yes: true,
      hooks: {
        afterOperation: async ({ target: operationTarget }) => {
          if (operationTarget !== agentPath) return;
          await fs.rename(path.join(target.configDir, 'agents'), movedAgentsPath);
          await fs.symlink(movedAgentsPath, path.join(target.configDir, 'agents'));
          throw new Error('injected failure after replacing managed agent directory');
        },
      },
    }),
    /manual recovery/
  );

  assert.deepEqual(await fs.readFile(path.join(movedAgentsPath, 'AutanaSoft.md')), expectedExternalBytes);
  assert.equal((await fs.lstat(path.join(target.configDir, 'agents'))).isSymbolicLink(), true);
  const backupRoot = path.join(target.configDir, '.autanasoft-backups');
  const backupRuns = await fs.readdir(backupRoot);
  let recoveryRun;
  let journal;
  for (const backupName of backupRuns) {
    const candidate = path.join(backupRoot, backupName);
    const candidateJournal = JSON.parse(await fs.readFile(path.join(candidate, 'journal.json'), 'utf8'));
    if (candidateJournal.state === 'manual-recovery-needed') {
      recoveryRun = candidate;
      journal = candidateJournal;
      break;
    }
  }
  assert.ok(recoveryRun, 'the journal for this run preserves the manual recovery state');
  const agentOperation = journal.operations.find(({ path: relativePath }) => relativePath === 'agents/AutanaSoft.md');
  assert.equal(journal.state, 'manual-recovery-needed');
  assert.equal(agentOperation.state, 'manual-recovery-needed');
  assert.deepEqual(journal.recoveryPaths, ['agents/AutanaSoft.md']);
  assert.deepEqual(await fs.readFile(path.join(recoveryRun, agentOperation.backup)), originalBytes);
});

test('T39 detects duplicate empty keys in configuration and manifest', async () => {
  for (const text of ['{"":1,"":2}\n', '{"custom":{"":1,"":2}}\n']) {
    const target = await fixture();
    await writeConfig(target, 'opencode.jsonc', text);
    await assert.rejects(run(target, { yes: true }), /Duplicate key "" in opencode\.jsonc/);
    assert.deepEqual(await fs.readdir(target.configDir), ['opencode.jsonc']);
  }

  const uniqueEmptyKey = await fixture();
  await writeConfig(uniqueEmptyKey, 'opencode.jsonc', '{"custom":{"":1}}\n');
  await run(uniqueEmptyKey, { yes: true });
  assert.equal((await readConfig(uniqueEmptyKey)).custom[''], 1);

  const manifestTarget = await fixture();
  await fs.mkdir(manifestTarget.configDir, { recursive: true });
  const invalidManifest =
    '{"schemaVersion":1,"files":{},"configuration":{"":"' + 'a'.repeat(64) + '","":"' + 'b'.repeat(64) + '"}}\n';
  await fs.writeFile(path.join(manifestTarget.configDir, '.autanasoft-install.json'), invalidManifest);
  await assert.rejects(run(manifestTarget, { yes: true }), /Invalid manifest/);
  assert.deepEqual(await fs.readdir(manifestTarget.configDir), ['.autanasoft-install.json']);
});

async function answerPrompt(answer, choices) {
  const input = new PassThrough();
  const output = new PassThrough();
  let display = '';
  output.setEncoding('utf8');
  output.on('data', (chunk) => {
    display += chunk;
  });
  try {
    const pending = terminalAsk('Option test', choices, { input, output });
    input.write(`${answer}\n`);
    return { choice: await pending, display };
  } finally {
    input.destroy();
    output.destroy();
  }
}

test('T42 the terminal adapter accepts initials and full choices case-insensitively', async () => {
  for (const [choices, answers] of [
    [
      ['yes', 'no', 'cancel'],
      [
        ['Y', 'yes'],
        ['y', 'yes'],
        [' YES ', 'yes'],
        ['N', 'no'],
        ['nO', 'no'],
        ['C', 'cancel'],
        ['CANCEL', 'cancel'],
      ],
    ],
    [
      ['yes', 'no'],
      [
        ['Y', 'yes'],
        ['N', 'no'],
      ],
    ],
    [
      ['keep', 'replace', 'cancel'],
      [
        ['K', 'keep'],
        ['r', 'replace'],
        ['REPLACE', 'replace'],
        ['C', 'cancel'],
      ],
    ],
    [
      ['keep-jsonc', 'take-json', 'cancel'],
      [
        ['K', 'keep-jsonc'],
        ['T', 'take-json'],
        ['TAKE-JSON', 'take-json'],
        ['c', 'cancel'],
      ],
    ],
  ]) {
    for (const [answer, expected] of answers) {
      assert.equal((await answerPrompt(answer, choices)).choice, expected);
    }
  }
  const { display } = await answerPrompt('Y', ['yes', 'no', 'cancel']);
  assert.match(display, /\[Y\(es\)\/N\(o\)\/C\(ancel\)\]/);
  assert.equal((await answerPrompt('K', ['keep', 'keep-jsonc', 'cancel'])).choice, 'k');
  assert.equal((await answerPrompt('unknown', ['yes', 'no', 'cancel'])).choice, 'unknown');
  assert.equal((await answerPrompt('', ['yes', 'no', 'cancel'])).choice, '');
});

test('T43 abbreviated responses respect confirmation and cancel before writing', async () => {
  for (const answer of ['N', 'C', 'X', '']) {
    const target = await fixture();
    await assert.rejects(
      run(target, {
        ask: async (_question, choices) => (await answerPrompt(answer, choices)).choice,
      }),
      /canceled/
    );
    assert.equal(await exists(target.configDir), false);
  }
  const target = await fixture();
  await run(target, { ask: async (_question, choices) => (await answerPrompt('Y', choices)).choice });
  assert.equal(await exists(path.join(target.configDir, 'AGENTS.md')), true);
});

test('T44 preserves the source Codegraph command when the versioned executable target changes', async () => {
  const target = await fixture();
  const versionOne = await fakeExecutable(target, 'codegraph', path.join(target.root, 'versions', '1'));
  const versionTwo = await fakeExecutable(target, 'codegraph', path.join(target.root, 'versions', '2'));
  const stableCommand = path.join(target.binDir, 'codegraph');
  await fs.symlink(versionOne.executable, stableCommand);
  const sourceConfig = parse(await fs.readFile(path.join(target.repositoryRoot, 'src', 'opencode.jsonc'), 'utf8'));
  await writeConfig(target, 'opencode.jsonc', { mcp: { servers: { codegraph: sourceConfig.mcp.servers.codegraph } } });
  await run(target, { yes: true, env: fakeEnv(target) });
  const configPath = path.join(target.configDir, 'opencode.jsonc');
  const before = await fs.readFile(configPath);
  assert.deepEqual((await readConfig(target)).mcp.servers.codegraph, sourceConfig.mcp.servers.codegraph);
  await fs.unlink(stableCommand);
  await fs.symlink(versionTwo.executable, stableCommand);
  const repeated = await run(target, { yes: true, env: fakeEnv(target) });
  assert.equal(repeated.changed.length, 0);
  assert.deepEqual(await fs.readFile(configPath), before);
  assert.equal(await exists(versionOne.marker), false);
  assert.equal(await exists(versionTwo.marker), false);
});
