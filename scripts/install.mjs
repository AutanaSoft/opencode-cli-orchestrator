#!/usr/bin/env node
import { createHash, randomBytes } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import readline from 'node:readline/promises';
import { applyEdits, getNodeValue, modify, parseTree } from 'jsonc-parser';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIR, '..');
const MANIFEST_NAME = '.autanasoft-install.json';
const BACKUP_ROOT_NAME = '.autanasoft-backups';
const RESOURCE_PATHS = [
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
  'instructions/engram.md',
];
const MANAGED_CONFIG_KEYS = {
  schema: ['$schema'],
  default_agent: ['default_agent'],
  context7: ['mcp', 'servers', 'context7'],
  codegraph: ['mcp', 'servers', 'codegraph'],
  engram: ['mcp', 'servers', 'engram'],
  engram_instruction: ['instructions', 'engram'],
};
const CONFIG_KEY_ALLOWLIST = new Set(Object.keys(MANAGED_CONFIG_KEYS));
const FILE_PATH_ALLOWLIST = new Set(RESOURCE_PATHS);
const HASH_PATTERN = /^[a-f0-9]{64}$/;

class InstallerError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'InstallerError';
  }
}

function fail(message) {
  throw new InstallerError(message);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function setOwn(target, key, value) {
  Object.defineProperty(target, key, { configurable: true, enumerable: true, writable: true, value });
}

function isEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((item, index) => isEqual(item, right[index]))
    );
  }
  if (!isObject(left) || !isObject(right)) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key, index) => key === rightKeys[index] && isEqual(left[key], right[key]))
  );
}

function getAtPath(value, segments) {
  let current = value;
  for (const segment of segments) {
    if (current === null || typeof current !== 'object' || !Object.hasOwn(current, segment)) return { exists: false };
    current = current[segment];
  }
  return { exists: true, value: current };
}

function valueAtConfigKey(config, key, instructionPath) {
  if (key === 'engram_instruction') {
    const items = config.instructions;
    if (!Array.isArray(items)) return { exists: false };
    const value = items.find((item) => item === instructionPath || item === './instructions/engram.md');
    return value === undefined ? { exists: false } : { exists: true, value };
  }
  return getAtPath(config, MANAGED_CONFIG_KEYS[key]);
}

function hashValue(value) {
  return sha256(Buffer.from(JSON.stringify(value), 'utf8'));
}

function parseDocument(text, displayPath) {
  const errors = [];
  const tree = parseTree(text, errors, { allowTrailingComma: true });
  if (errors.length > 0 || !tree) {
    const first = errors[0];
    const prefix = first ? text.slice(0, first.offset) : '';
    const line = prefix.split('\n').length;
    const column = prefix.length - prefix.lastIndexOf('\n');
    fail(`Invalid configuration in ${displayPath} (line ${line}, column ${column}); content was skipped.`);
  }
  if (tree.type !== 'object') fail(`The root of ${displayPath} must be a JSON object.`);

  const duplicate = findDuplicateProperty(tree);
  if (duplicate !== undefined) fail(`Duplicate key "${duplicate}" in ${displayPath}; no files were modified.`);
  return { value: getNodeValue(tree), tree };
}

function findDuplicateProperty(node) {
  if (node.type === 'object') {
    const seen = new Set();
    for (const property of node.children ?? []) {
      const key = property.children?.[0]?.value;
      if (seen.has(key)) return key;
      seen.add(key);
      const duplicate = findDuplicateProperty(property.children?.[1]);
      if (duplicate !== undefined) return duplicate;
    }
  } else if (node.type === 'array') {
    for (const child of node.children ?? []) {
      const duplicate = findDuplicateProperty(child);
      if (duplicate !== undefined) return duplicate;
    }
  }
  return undefined;
}

function assertManifest(value) {
  if (
    !isObject(value) ||
    Object.keys(value).some((key) => !['schemaVersion', 'files', 'configuration'].includes(key)) ||
    value.schemaVersion !== 1 ||
    !isObject(value.files) ||
    !isObject(value.configuration)
  ) {
    fail(`Invalid manifest in ${MANIFEST_NAME}; its paths and values were not trusted.`);
  }
  for (const [filePath, hash] of Object.entries(value.files)) {
    if (!FILE_PATH_ALLOWLIST.has(filePath) || !HASH_PATTERN.test(hash)) {
      fail(`Invalid manifest in ${MANIFEST_NAME}; it contains a disallowed path or hash.`);
    }
  }
  for (const [key, hash] of Object.entries(value.configuration)) {
    if (!CONFIG_KEY_ALLOWLIST.has(key) || !HASH_PATTERN.test(hash)) {
      fail(`Invalid manifest in ${MANIFEST_NAME}; it contains a disallowed key or hash.`);
    }
  }
  return value;
}

async function lstatOrMissing(target) {
  try {
    return await fs.lstat(target);
  } catch (error) {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  }
}

async function assertNoSymlinkAncestors(target, { targetMayBeFile = true } = {}) {
  const absolute = path.resolve(target);
  const parsed = path.parse(absolute);
  const segments = absolute.slice(parsed.root.length).split(path.sep).filter(Boolean);
  let current = parsed.root;
  for (let index = 0; index < segments.length; index += 1) {
    current = path.join(current, segments[index]);
    const stat = await lstatOrMissing(current);
    if (!stat) continue;
    if (stat.isSymbolicLink()) fail(`Rejected a symbolic link in the destination path: ${current}`);
    const isLast = index === segments.length - 1;
    if ((!isLast || !targetMayBeFile) && !stat.isDirectory())
      fail(`A component of the destination path is not a directory: ${current}`);
  }
}

async function captureFingerprint(target) {
  await assertNoSymlinkAncestors(target);
  const stat = await lstatOrMissing(target);
  if (!stat) return { exists: false };
  if (stat.isSymbolicLink()) fail(`Rejected symbolic link ${target}.`);
  if (!stat.isFile()) fail(`Expected a regular file at ${target}.`);
  const bytes = await fs.readFile(target);
  return { exists: true, hash: sha256(bytes), mode: stat.mode & 0o777, bytes };
}

function fingerprintEqual(left, right) {
  if (left.exists !== right.exists) return false;
  if (!left.exists) return true;
  return left.hash === right.hash && left.mode === right.mode;
}

async function assertFingerprint(target, expected) {
  const current = await captureFingerprint(target);
  if (!fingerprintEqual(current, expected))
    fail(`File changed during installation: ${target}; canceled to avoid overwriting it.`);
}

async function readSourceResources(repositoryRoot) {
  const resources = new Map();
  for (const relativePath of RESOURCE_PATHS) {
    const sourcePath = path.join(repositoryRoot, 'src', relativePath);
    const stat = await fs.lstat(sourcePath);
    if (!stat.isFile() || stat.isSymbolicLink()) fail(`Source resource is not a regular file: src/${relativePath}`);
    const bytes = await fs.readFile(sourcePath);
    resources.set(relativePath, { bytes, hash: sha256(bytes) });
  }
  return resources;
}

async function detectExecutable(command, environment, home) {
  const candidates = [];
  const pathValue = environment.PATH ?? '';
  for (const directory of pathValue.split(path.delimiter).filter(Boolean))
    candidates.push(path.resolve(directory, command));
  if (command === 'engram') candidates.push(path.join(home, '.local', 'bin', 'engram'));

  let uncertain = false;
  const visited = new Set();
  for (const candidate of candidates) {
    if (visited.has(candidate)) continue;
    visited.add(candidate);
    try {
      await fs.access(candidate, fsConstants.X_OK);
      const stat = await fs.stat(candidate);
      if (!stat.isFile()) continue;
      const resolved = await fs.realpath(candidate);
      return { status: 'detected', path: resolved, compatibility: 'unknown', operation: 'not checked' };
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') uncertain = true;
    }
  }
  return {
    status: uncertain ? 'unknown' : 'not detected',
    compatibility: 'unknown',
    operation: 'not checked',
  };
}

async function readManifest(manifestPath, fingerprints) {
  const fingerprint = await captureFingerprint(manifestPath);
  fingerprints.set(manifestPath, fingerprint);
  if (!fingerprint.exists) return { schemaVersion: 1, files: {}, configuration: {} };
  const text = fingerprint.bytes.toString('utf8');
  const errors = [];
  const tree = parseTree(text, errors, { disallowComments: true, allowTrailingComma: false });
  if (!tree || errors.length > 0 || tree.type !== 'object' || findDuplicateProperty(tree) !== undefined) {
    fail(`Invalid manifest in ${MANIFEST_NAME}; expected valid JSON.`);
  }
  const parsed = getNodeValue(tree);
  return assertManifest(parsed);
}

async function readConfigState(configDir, fingerprints) {
  const jsonPath = path.join(configDir, 'opencode.json');
  const jsoncPath = path.join(configDir, 'opencode.jsonc');
  const jsonFingerprint = await captureFingerprint(jsonPath);
  const jsoncFingerprint = await captureFingerprint(jsoncPath);
  fingerprints.set(jsonPath, jsonFingerprint);
  fingerprints.set(jsoncPath, jsoncFingerprint);
  const state = {
    jsonPath,
    jsoncPath,
    json: jsonFingerprint.exists ? parseDocument(jsonFingerprint.bytes.toString('utf8'), 'opencode.json') : undefined,
    jsonc: jsoncFingerprint.exists
      ? parseDocument(jsoncFingerprint.bytes.toString('utf8'), 'opencode.jsonc')
      : undefined,
    dual: jsonFingerprint.exists && jsoncFingerprint.exists,
  };
  if (!state.json && !state.jsonc) {
    state.selectedPath = jsoncPath;
    state.text = '{\n}\n';
    state.value = {};
  } else if (state.jsonc) {
    state.selectedPath = jsoncPath;
    state.text = jsoncFingerprint.bytes.toString('utf8');
    state.value = state.jsonc.value;
  } else {
    state.selectedPath = jsonPath;
    state.text = jsonFingerprint.bytes.toString('utf8');
    state.value = state.json.value;
  }
  return state;
}

function deepCopy(value) {
  if (Array.isArray(value)) return value.map(deepCopy);
  if (isObject(value)) {
    const result = {};
    for (const [key, item] of Object.entries(value)) setOwn(result, key, deepCopy(item));
    return result;
  }
  return value;
}

function mergeDocuments(jsoncValue, jsonValue) {
  const conflicts = [];
  function merge(base, incoming, segments) {
    if (isEqual(base, incoming)) return deepCopy(base);
    if (isObject(base) && isObject(incoming)) {
      const result = deepCopy(base);
      for (const [key, incomingValue] of Object.entries(incoming)) {
        if (!Object.hasOwn(base, key)) setOwn(result, key, deepCopy(incomingValue));
        else if (segments.length === 2 && segments[0] === 'mcp' && segments[1] === 'servers') {
          if (!isEqual(base[key], incomingValue)) {
            conflicts.push({
              path: [...segments, key],
              base: deepCopy(base[key]),
              incoming: deepCopy(incomingValue),
            });
          }
        } else setOwn(result, key, merge(base[key], incomingValue, [...segments, key]));
      }
      return result;
    }
    conflicts.push({ path: segments, base: deepCopy(base), incoming: deepCopy(incoming) });
    return deepCopy(base);
  }
  return { value: merge(jsoncValue, jsonValue, []), conflicts };
}

function setValueAtPath(target, segments, value) {
  let current = target;
  for (const segment of segments.slice(0, -1)) {
    if (!Object.hasOwn(current, segment) || !isObject(current[segment])) setOwn(current, segment, {});
    current = current[segment];
  }
  setOwn(current, segments.at(-1), deepCopy(value));
}

function greatestCommonDivisor(left, right) {
  return right === 0 ? left : greatestCommonDivisor(right, left % right);
}

function formatOptions(text) {
  const indents = [...text.matchAll(/^(?<indent>[\t ]+)(?=["}\]])/gm)].map(({ groups }) => groups.indent);
  const tabIndent = indents.find((indent) => indent.includes('\t'));
  const widths = indents.filter((indent) => /^ +$/.test(indent)).map((indent) => indent.length);
  const tabSize = widths.reduce((size, width) => greatestCommonDivisor(size, width), 0) || 2;
  return {
    insertSpaces: !tabIndent,
    tabSize,
    eol: text.includes('\r\n') ? '\r\n' : '\n',
  };
}

function editJsonc(text, segments, value) {
  const edits = modify(text, segments, value, { formattingOptions: formatOptions(text) });
  return applyEdits(text, edits);
}

function syncJsonc(baseText, baseValue, mergedValue) {
  let output = baseText;
  function visit(base, merged, segments) {
    if (isEqual(base, merged)) return;
    if (segments.length === 3 && segments[0] === 'mcp' && segments[1] === 'servers') {
      output = editJsonc(output, segments, merged);
      return;
    }
    if (isObject(base) && isObject(merged)) {
      for (const [key, value] of Object.entries(merged)) {
        if (!Object.hasOwn(base, key)) output = editJsonc(output, [...segments, key], value);
        else visit(base[key], value, [...segments, key]);
      }
      return;
    }
    output = editJsonc(output, segments, merged);
  }
  visit(baseValue, mergedValue, []);
  parseDocument(output, 'consolidated configuration');
  return output;
}

function sourceDesiredConfig(resources, detection, acceptedPrimary, acceptedEngram) {
  const sourceText = resources.get('..source-config')?.bytes?.toString('utf8');
  if (!sourceText) return {};
  const sourceConfig = parseDocument(sourceText, 'src/opencode.jsonc').value;
  const desired = new Map();
  desired.set('schema', sourceConfig.$schema);
  if (acceptedPrimary) desired.set('default_agent', sourceConfig.default_agent);
  desired.set('context7', sourceConfig.mcp.servers.context7);
  if (detection.codegraph.status === 'detected') {
    desired.set('codegraph', sourceConfig.mcp.servers.codegraph);
  }
  if (detection.engram.status === 'detected' && acceptedEngram) {
    desired.set('engram', {
      ...sourceConfig.mcp.servers.engram,
      command: [detection.engram.path, 'mcp', '--tools=agent'],
    });
  }
  return desired;
}

function resourcePreviewLine(resource) {
  if (resource.action === 'write') return `  install ${resource.relativePath}`;
  if (resource.action === 'update') return `  update ${resource.relativePath} (${resource.reason})`;
  if (resource.action === 'noop') return `  unchanged ${resource.relativePath}`;
  if (resource.action === 'conflict') return `  conflict ${resource.relativePath} (${resource.reason})`;
  if (resource.action === 'skip') return `  skip ${resource.relativePath} (${resource.reason})`;
  return `  keep ${resource.relativePath} (${resource.reason})`;
}

async function planResources(configDir, resources, manifest, fingerprints, engramDetected, engramDisabled) {
  const plans = [];
  for (const relativePath of RESOURCE_PATHS) {
    if (relativePath === 'instructions/engram.md' && engramDisabled) {
      const target = path.join(configDir, relativePath);
      const fingerprint = await captureFingerprint(target);
      fingerprints.set(target, fingerprint);
      plans.push({
        relativePath,
        target,
        source: resources.get(relativePath),
        action: 'skip',
        reason: 'Existing Engram is disabled; the instruction is neither installed nor managed',
        fingerprint,
      });
      continue;
    }
    if (relativePath === 'instructions/engram.md' && !engramDetected) {
      const target = path.join(configDir, relativePath);
      const fingerprint = await captureFingerprint(target);
      fingerprints.set(target, fingerprint);
      const managedHash = manifest.files[relativePath];
      if (fingerprint.exists && managedHash && fingerprint.hash === managedHash) {
        plans.push({
          relativePath,
          target,
          source: resources.get(relativePath),
          action: 'preserve',
          reason: 'Engram not detected; the existing resource is not removed',
          fingerprint,
        });
      } else {
        plans.push({
          relativePath,
          target,
          source: resources.get(relativePath),
          action: 'skip',
          reason: 'Engram not detected',
          fingerprint,
        });
      }
      continue;
    }
    const target = path.join(configDir, relativePath);
    await assertNoSymlinkAncestors(target);
    const fingerprint = await captureFingerprint(target);
    fingerprints.set(target, fingerprint);
    const source = resources.get(relativePath);
    const ownedHash = manifest.files[relativePath];
    let item;
    if (!fingerprint.exists) item = { action: 'write', reason: 'does not exist', source, fingerprint };
    else if (fingerprint.hash === source.hash)
      item = { action: 'noop', reason: 'identical to the source resource', source, fingerprint };
    else if (ownedHash && fingerprint.hash === ownedHash)
      item = { action: 'update', reason: 'manifest matches', source, fingerprint };
    else
      item = {
        action: 'conflict',
        reason: ownedHash ? 'modified since installation' : 'pre-existing unmanaged file',
        source,
        fingerprint,
      };
    plans.push({ relativePath, target, ...item });
  }
  return plans;
}

function stableManifest(files, configuration) {
  const sortedFiles = Object.fromEntries(Object.entries(files).sort(([left], [right]) => left.localeCompare(right)));
  const sortedConfiguration = Object.fromEntries(
    Object.entries(configuration).sort(([left], [right]) => left.localeCompare(right))
  );
  return `${JSON.stringify({ schemaVersion: 1, files: sortedFiles, configuration: sortedConfiguration }, null, 2)}\n`;
}

function resolveConfigDirectory(configDir, home, cwd, environment) {
  if (configDir !== undefined) return { path: path.resolve(cwd, configDir), source: '--config-dir' };

  const environmentConfigDir = environment.OPENCODE_CONFIG_DIR;
  if (environmentConfigDir) {
    if (!path.isAbsolute(environmentConfigDir))
      fail('OPENCODE_CONFIG_DIR must be an absolute path; use --config-dir to specify another path.');
    return { path: path.resolve(environmentConfigDir), source: 'OPENCODE_CONFIG_DIR' };
  }

  const xdgConfigHome = environment.XDG_CONFIG_HOME;
  if (xdgConfigHome) {
    if (!path.isAbsolute(xdgConfigHome))
      fail('XDG_CONFIG_HOME must be an absolute path; use --config-dir to specify another path.');
    return { path: path.join(path.resolve(xdgConfigHome), 'opencode'), source: 'XDG_CONFIG_HOME/opencode' };
  }

  if (!path.isAbsolute(home)) fail('HOME must be an absolute path; specify a valid HOME.');
  return { path: path.join(home, '.config', 'opencode'), source: 'HOME/.config/opencode' };
}

function executableSummary(detection, name) {
  if (detection.status === 'detected')
    return `${name}: detected (${detection.path}); compatibility unknown; operability not checked.`;
  if (detection.status === 'unknown')
    return `${name}: detection uncertain; compatibility unknown; operability not checked.`;
  return `${name}: not detected; new configuration skipped; operability not checked.`;
}

function existingDependencyWarnings(config, detection, destination) {
  const warnings = [];
  for (const [name, command] of [
    ['codegraph', detection.codegraph],
    ['engram', detection.engram],
  ]) {
    const configured = getAtPath(config, ['mcp', 'servers', name]).exists;
    const instructionConfigured =
      name === 'engram' &&
      Array.isArray(config.instructions) &&
      config.instructions.some(
        (entry) => entry === './instructions/engram.md' || entry === path.join(destination, 'instructions', 'engram.md')
      );
    if ((configured || instructionConfigured) && command.status !== 'detected') {
      const detectionText =
        command.status === 'unknown' ? 'detection could not be confirmed' : 'executable was not detected';
      warnings.push(
        `  Warning: existing ${name} configuration is preserved; ${detectionText}, so its dependency may be missing.`
      );
    }
  }
  return warnings;
}

function preview(output, title, lines) {
  output(`${title}\n${lines.length ? lines.join('\n') : '  (no changes)'}\n`);
}

async function chooseConflict(conflict, ask, yes) {
  if (yes || !ask) fail(`Unresolved conflict at ${conflict.displayPath}; no files were written.`);
  const choice = await ask(conflict.question, conflict.choices);
  if (!conflict.choices.includes(choice)) fail(`Invalid choice for ${conflict.displayPath}; canceled without writing.`);
  if (choice === 'cancel')
    fail(`Installation canceled because of a conflict at ${conflict.displayPath}; no files were written.`);
  return choice;
}

async function resolveResourceConflicts(plans, ask, yes) {
  for (const item of plans.filter(({ action }) => action === 'conflict')) {
    const choice = await chooseConflict(
      {
        displayPath: item.target,
        question: `Resource conflict ${item.relativePath}`,
        choices: ['keep', 'replace', 'cancel'],
      },
      ask,
      yes
    );
    item.action = choice === 'keep' ? 'preserve' : 'update';
    item.reason = choice === 'keep' ? 'kept by explicit choice' : 'replacement confirmed';
  }
}

function activeAgentAccepted(resourcePlans) {
  const primary = resourcePlans.find(({ relativePath }) => relativePath === 'agents/AutanaSoft.md');
  return primary && ['write', 'update', 'noop'].includes(primary.action);
}

function activeEngramResourceAccepted(resourcePlans) {
  const instruction = resourcePlans.find(({ relativePath }) => relativePath === 'instructions/engram.md');
  return instruction && ['write', 'update', 'noop'].includes(instruction.action);
}

function isEngramDisabled(config) {
  const engram = getAtPath(config, MANAGED_CONFIG_KEYS.engram);
  return engram.exists && isObject(engram.value) && (engram.value.disabled === true || engram.value.enabled === false);
}

function configConflictOptions(conflict) {
  if (!conflict.replaceable || conflict.key === 'instructions') return ['keep', 'cancel'];
  if (conflict.key.startsWith('mcp.')) return ['keep', 'replace', 'cancel'];
  return ['keep', 'replace', 'cancel'];
}

function getPreviousConfigHash(manifest, key) {
  return manifest.configuration[key];
}

function addConfigConflict(conflicts, { key, displayPath, desired, current, pathSegments, reason }) {
  conflicts.push({ key, displayPath, desired, current, pathSegments, reason, choice: undefined, replaceable: true });
}

function applyManagedConfig({ initialValue, text, desired, manifest, instructionPath, dualConflicts = [] }) {
  let value = deepCopy(initialValue);
  let outputText = text;
  const conflicts = [];
  const ownership = new Set();

  for (const conflict of dualConflicts) {
    if (conflict.choice === 'take-json') setValueAtPath(value, conflict.path, conflict.incoming);
  }

  for (const [key, proposed] of desired) {
    if (key === 'engram_instruction') {
      const instructions = value.instructions;
      const proposedPath = proposed;
      if (instructions === undefined) {
        outputText = editJsonc(outputText, ['instructions'], [proposedPath]);
        value.instructions = [proposedPath];
        ownership.add(key);
        continue;
      }
      if (!Array.isArray(instructions)) {
        addConfigConflict(conflicts, {
          key: 'instructions',
          displayPath: 'instructions',
          desired: [proposedPath],
          current: instructions,
          pathSegments: ['instructions'],
          reason: 'property is not an array',
        });
        continue;
      }
      let ownIndexes = [];
      instructions.forEach((entry, index) => {
        if (entry === proposedPath || entry === './instructions/engram.md') ownIndexes.push(index);
      });
      if (ownIndexes.length === 0) {
        outputText = editJsonc(outputText, ['instructions', instructions.length], proposedPath);
        instructions.push(proposedPath);
      } else {
        const firstIndex = ownIndexes[0];
        if (instructions[firstIndex] !== proposedPath) {
          outputText = editJsonc(outputText, ['instructions', firstIndex], proposedPath);
          instructions[firstIndex] = proposedPath;
        }
        for (const index of ownIndexes.slice(1).reverse()) {
          outputText = editJsonc(outputText, ['instructions', index], undefined);
          instructions.splice(index, 1);
        }
      }
      ownership.add(key);
      continue;
    }

    const segments = MANAGED_CONFIG_KEYS[key];
    let parent = value;
    for (const segment of segments.slice(0, -1)) {
      if (parent[segment] === undefined) parent[segment] = {};
      if (!isObject(parent[segment])) {
        const conflictPath = [...segments.slice(0, segments.indexOf(segment)), segment];
        conflicts.push({
          key,
          displayPath: conflictPath.join('.'),
          desired: proposed,
          current: parent[segment],
          pathSegments: conflictPath,
          reason: 'existing structure is not an object',
          choice: undefined,
          replaceable: false,
        });
        parent = undefined;
        break;
      }
      parent = parent[segment];
    }
    if (!parent) continue;
    const leaf = segments.at(-1);
    const exists = Object.hasOwn(parent, leaf);
    const current = parent[leaf];
    if (!exists || isEqual(current, proposed)) {
      if (!exists) {
        outputText = editJsonc(outputText, segments, proposed);
        parent[leaf] = deepCopy(proposed);
      }
      ownership.add(key);
      continue;
    }
    if (getPreviousConfigHash(manifest, key) === hashValue(current)) {
      outputText = editJsonc(outputText, segments, proposed);
      parent[leaf] = deepCopy(proposed);
      ownership.add(key);
      continue;
    }
    addConfigConflict(conflicts, {
      key,
      displayPath: segments.join('.'),
      desired: proposed,
      current,
      pathSegments: segments,
      reason: 'different pre-existing value',
    });
  }

  return { value, text: outputText, conflicts, ownership };
}

function applyConfigConflictChoices(plan, decisions) {
  let { text, value } = plan;
  const ownership = new Set(plan.ownership);
  for (const conflict of plan.conflicts) {
    const choice = decisions.get(conflict.displayPath);
    if (choice === 'keep') {
      ownership.delete(conflict.key);
      continue;
    }
    if (choice === 'replace') {
      if (!conflict.replaceable)
        fail(`Cannot replace structure ${conflict.displayPath} without discarding unknown values.`);
      if (conflict.pathSegments[0] === 'instructions') {
        // A non-array instructions value cannot be safely merged with the managed path.
        fail('Cannot replace instructions without discarding unknown values; configuration was preserved.');
      }
      text = editJsonc(text, conflict.pathSegments, conflict.desired);
      setValueAtPath(value, conflict.pathSegments, conflict.desired);
      ownership.add(conflict.key);
      continue;
    }
    fail(`Unresolved conflict at ${conflict.displayPath}; no files were written.`);
  }
  parseDocument(text, 'planned configuration');
  return { text, value, ownership };
}

function getPathValue(config, key, instructionPath) {
  return valueAtConfigKey(config, key, instructionPath);
}

function buildConfigurationManifest(previous, finalConfig, ownership, desired, instructionPath) {
  const output = { ...previous };
  for (const [key] of desired) {
    if (!ownership.has(key)) {
      delete output[key];
      continue;
    }
    const actual = getPathValue(finalConfig, key, instructionPath);
    if (actual.exists) output[key] = hashValue(actual.value);
  }
  for (const key of Object.keys(output)) {
    if (desired.has(key)) continue;
    const actual = getPathValue(finalConfig, key, instructionPath);
    if (!actual.exists || hashValue(actual.value) !== output[key]) delete output[key];
  }
  for (const key of Object.keys(output)) {
    if (!CONFIG_KEY_ALLOWLIST.has(key)) delete output[key];
  }
  return output;
}

function buildFileManifest(previous, resourcePlans) {
  const output = { ...previous };
  for (const item of resourcePlans) {
    if (item.action === 'write' || item.action === 'update' || item.action === 'noop')
      output[item.relativePath] = item.source.hash;
    else if (
      item.action === 'preserve' &&
      item.fingerprint.exists &&
      previous[item.relativePath] === item.fingerprint.hash
    )
      output[item.relativePath] = previous[item.relativePath];
    else if (item.action === 'skip' || item.action === 'preserve') delete output[item.relativePath];
  }
  for (const filePath of Object.keys(output)) if (!FILE_PATH_ALLOWLIST.has(filePath)) delete output[filePath];
  return output;
}

async function ensureDirectory(directory, createdDirectories) {
  await assertNoSymlinkAncestors(directory, { targetMayBeFile: false });
  const stat = await lstatOrMissing(directory);
  if (stat) {
    if (!stat.isDirectory()) fail(`Expected a directory at ${directory}.`);
    return;
  }
  const parent = path.dirname(directory);
  await ensureDirectory(parent, createdDirectories);
  try {
    await fs.mkdir(directory, { mode: 0o755 });
    createdDirectories.push(directory);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const raced = await fs.lstat(directory);
    if (raced.isSymbolicLink() || !raced.isDirectory()) fail(`Directory changed during installation: ${directory}`);
  }
}

async function atomicWrite(target, bytes, mode, onRename) {
  const directory = path.dirname(target);
  const temporary = path.join(
    directory,
    `.${path.basename(target)}.autanasoft-${process.pid}-${randomBytes(8).toString('hex')}.tmp`
  );
  try {
    await assertNoSymlinkAncestors(target);
    const handle = await fs.open(temporary, 'wx', 0o600);
    try {
      await handle.chmod(0o600);
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await assertNoSymlinkAncestors(target);
    await fs.rename(temporary, target);
    await onRename?.();
    const renamed = await captureFingerprint(target);
    if (renamed.hash !== sha256(bytes)) fail(`File changed during atomic write: ${target}.`);
    await assertNoSymlinkAncestors(target);
    await fs.chmod(target, mode);
  } catch (error) {
    try {
      await assertNoSymlinkAncestors(temporary);
      await fs.rm(temporary, { force: true });
    } catch {}
    throw error;
  }
}

async function writePrivateFile(target, bytes) {
  const handle = await fs.open(target, 'wx', 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.chmod(0o600);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

function relativeSafePath(configDir, target) {
  const relative = path.relative(configDir, target);
  if (!relative || relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) {
    fail(`Rejected a path outside the destination: ${target}`);
  }
  return relative.split(path.sep).join('/');
}

async function assertRollbackPath(configDir, target) {
  relativeSafePath(configDir, target);
  await assertNoSymlinkAncestors(target);
}

async function applyOperations({ configDir, operations, fingerprints, hooks = {} }) {
  const changed = [];
  const createdDirectories = [];
  const expectedSnapshots = new Map(fingerprints);
  let backupDirectory;
  let mutationStarted = false;
  let journal;
  let journalPath;
  const backupRoot = path.join(configDir, BACKUP_ROOT_NAME);
  try {
    for (const [target, expected] of expectedSnapshots) await assertFingerprint(target, expected);
    await ensureDirectory(configDir, createdDirectories);
    const operationDirectories = [...new Set(operations.map(({ target }) => path.dirname(target)))];
    for (const directory of operationDirectories) await ensureDirectory(directory, createdDirectories);
    if (operations.length === 0) return { backupDirectory: undefined, changed: [] };

    await assertNoSymlinkAncestors(backupRoot, { targetMayBeFile: false });
    let backupRootStat = await lstatOrMissing(backupRoot);
    if (!backupRootStat) {
      await fs.mkdir(backupRoot, { mode: 0o700 });
      createdDirectories.push(backupRoot);
      backupRootStat = await fs.lstat(backupRoot);
    }
    if (!backupRootStat.isDirectory() || backupRootStat.isSymbolicLink())
      fail(`Unsafe backup directory: ${backupRoot}`);
    if (process.platform !== 'win32' && (backupRootStat.mode & 0o077) !== 0)
      fail(`Backup directory is not private (POSIX mode): ${backupRoot}`);
    const runName = `${new Date().toISOString().replaceAll(':', '-')}-${process.pid}-${randomBytes(5).toString('hex')}`;
    backupDirectory = path.join(backupRoot, runName);
    await fs.mkdir(backupDirectory, { mode: 0o700 });
    if (process.platform !== 'win32') await fs.chmod(backupDirectory, 0o700);

    journal = { schemaVersion: 1, state: 'prepared', operations: [] };
    let backupIndex = 0;
    for (const operation of operations) {
      const relativePath = relativeSafePath(configDir, operation.target);
      const original = fingerprints.get(operation.target) ?? { exists: false };
      let backupName;
      if (original.exists) {
        backupName = `${String(backupIndex).padStart(3, '0')}.bin`;
        await writePrivateFile(path.join(backupDirectory, backupName), original.bytes);
        backupIndex += 1;
      }
      journal.operations.push({
        path: relativePath,
        kind: operation.kind,
        backup: backupName,
        originalExists: original.exists,
        originalHash: original.hash ?? null,
        originalMode: original.mode,
        plannedHash: operation.kind === 'write' ? sha256(operation.bytes) : null,
        state: 'planned',
      });
    }
    journalPath = path.join(backupDirectory, 'journal.json');
    await writePrivateFile(journalPath, Buffer.from(`${JSON.stringify(journal, null, 2)}\n`));

    for (const [index, operation] of operations.entries()) {
      await hooks.beforeOperation?.({ index, kind: operation.kind, target: operation.target });
      for (const [target, expected] of expectedSnapshots) await assertFingerprint(target, expected);
      const original = expectedSnapshots.get(operation.target) ?? { exists: false };
      mutationStarted = true;
      if (operation.kind === 'write') {
        let changedEntry;
        await atomicWrite(operation.target, operation.bytes, operation.mode, async () => {
          const renamedSnapshot = {
            exists: true,
            hash: sha256(operation.bytes),
            mode: 0o600,
            bytes: Buffer.from(operation.bytes),
          };
          expectedSnapshots.set(operation.target, renamedSnapshot);
          changedEntry = { operation, expected: renamedSnapshot, journalOperation: journal.operations[index] };
          changed.push(changedEntry);
        });
        const current = await captureFingerprint(operation.target);
        expectedSnapshots.set(operation.target, current);
        changedEntry.expected = current;
        journal.operations[index].state = 'written';
      } else {
        await fs.unlink(operation.target);
        expectedSnapshots.set(operation.target, { exists: false });
        changed.push({ operation, expected: { exists: false }, journalOperation: journal.operations[index] });
        journal.operations[index].state = 'removed';
      }
      journal.state = 'applying';
      await atomicWrite(journalPath, Buffer.from(`${JSON.stringify(journal, null, 2)}\n`), 0o600);
      await hooks.afterOperation?.({ index, kind: operation.kind, target: operation.target });
    }
    journal.state = 'complete';
    await atomicWrite(journalPath, Buffer.from(`${JSON.stringify(journal, null, 2)}\n`), 0o600);
    return { backupDirectory, changed };
  } catch (error) {
    if (mutationStarted) {
      const recovery = [];
      for (const entry of changed.reverse()) {
        const { operation, expected } = entry;
        try {
          await assertRollbackPath(configDir, operation.target);
          const current = await captureFingerprint(operation.target);
          if (!fingerprintEqual(current, expected)) {
            recovery.push(operation.target);
            continue;
          }
          const original = fingerprints.get(operation.target) ?? { exists: false };
          if (original.exists) {
            await assertRollbackPath(configDir, operation.target);
            await atomicWrite(operation.target, original.bytes, original.mode);
          } else {
            await assertRollbackPath(configDir, operation.target);
            await fs.unlink(operation.target).catch((unlinkError) => {
              if (unlinkError.code !== 'ENOENT') throw unlinkError;
            });
          }
          entry.journalOperation.state = 'rolled-back';
        } catch {
          recovery.push(operation.target);
          entry.journalOperation.state = 'manual-recovery-needed';
        }
      }
      if (backupDirectory && journal && journalPath) {
        journal.state = recovery.length ? 'manual-recovery-needed' : 'rolled-back';
        journal.recoveryPaths = recovery.map((target) => relativeSafePath(configDir, target));
        try {
          relativeSafePath(configDir, journalPath);
          await assertNoSymlinkAncestors(journalPath);
          await atomicWrite(journalPath, Buffer.from(`${JSON.stringify(journal, null, 2)}\n`), 0o600);
        } catch {}
      }
      if (recovery.length) {
        throw new InstallerError(
          `Installation failed and could not be safely rolled back: ${recovery.join(', ')}. Backup for manual recovery: ${backupDirectory}`,
          { cause: error }
        );
      }
      throw new InstallerError(`An operation failed; previous changes were rolled back. Backups: ${backupDirectory}`, {
        cause: error,
      });
    }
    if (backupDirectory) {
      try {
        relativeSafePath(configDir, backupDirectory);
        await assertNoSymlinkAncestors(backupDirectory, { targetMayBeFile: false });
        await fs.rm(backupDirectory, { recursive: true, force: true });
      } catch {}
    }
    for (const directory of createdDirectories.reverse()) {
      try {
        await assertNoSymlinkAncestors(directory, { targetMayBeFile: false });
        await fs.rmdir(directory);
      } catch {}
    }
    throw error;
  }
}

function configPreviewLines(operations, conflicts, consolidation, detection) {
  const lines = operations.map(
    (operation) => `  ${operation.kind === 'delete' ? 'remove' : 'write'} ${operation.label}`
  );
  if (consolidation === 'confirmed')
    lines.push(
      '  consolidation confirmed: JSONC will be the base; JSON will be removed after the new JSONC is validated'
    );
  if (consolidation === 'required')
    lines.push(
      '  proposed consolidation: explicit confirmation required; JSONC will be the base and JSON removed after validation'
    );
  for (const conflict of conflicts) lines.push(`  conflict ${conflict.displayPath} (${conflict.reason})`);
  lines.push(`  ${executableSummary(detection.codegraph, 'Codegraph')}`);
  lines.push(`  ${executableSummary(detection.engram, 'Engram')}`);
  lines.push('  Context7: remote configured; connectivity and operability not checked.');
  return lines;
}

async function askForConflict(options, ask, yes) {
  const decisions = new Map();
  for (const conflict of options) {
    const choices = configConflictOptions(conflict);
    const choice = await chooseConflict(
      {
        displayPath: conflict.displayPath,
        question: `Configuration conflict ${conflict.displayPath}`,
        choices,
      },
      ask,
      yes
    );
    decisions.set(conflict.displayPath, choice);
    decisions.set(conflict.key, choice);
  }
  return decisions;
}

/**
 * Runs the installer without import-time effects. Tests may supply explicit paths, a prompt adapter, and operation hooks;
 * the CLI alone resolves the user's default destination and terminal interaction.
 */
export async function install(options = {}) {
  const environment = options.env ?? process.env;
  const home = options.home ?? environment.HOME ?? os.homedir();
  const cwd = options.cwd ?? process.cwd();
  const repositoryRoot = path.resolve(options.repositoryRoot ?? REPOSITORY_ROOT);
  const output = options.output ?? (() => {});
  const ask = options.ask;
  const dryRun = Boolean(options.dryRun);
  const yes = Boolean(options.yes);
  const configDirArgument = options.configDir;

  if (!path.isAbsolute(home)) fail('HOME must be an absolute path; specify a valid HOME.');
  const destination = resolveConfigDirectory(configDirArgument, home, cwd, environment);
  const configDir = destination.path;
  await assertNoSymlinkAncestors(configDir, { targetMayBeFile: false });
  const resources = await readSourceResources(repositoryRoot);
  resources.set('..source-config', { bytes: await fs.readFile(path.join(repositoryRoot, 'src', 'opencode.jsonc')) });
  const detection = {
    codegraph: await detectExecutable('codegraph', environment, home),
    engram: await detectExecutable('engram', environment, home),
  };
  const fingerprints = new Map();
  const manifestPath = path.join(configDir, MANIFEST_NAME);
  await assertNoSymlinkAncestors(manifestPath);
  const manifest = await readManifest(manifestPath, fingerprints);
  const configState = await readConfigState(configDir, fingerprints);
  configState.manifestText = fingerprints.get(manifestPath)?.exists
    ? fingerprints.get(manifestPath).bytes.toString('utf8')
    : '';
  configState.fingerprints = fingerprints;
  const engramDisabledBeforePlanning = [configState.jsonc?.value, configState.json?.value, configState.value].some(
    (config) => config && isEngramDisabled(config)
  );
  const resourcePlans = await planResources(
    configDir,
    resources,
    manifest,
    fingerprints,
    detection.engram.status === 'detected',
    engramDisabledBeforePlanning
  );

  preview(
    output,
    `Destination: ${configDir}\nDestination source: ${destination.source}\nResources:`,
    resourcePlans.map(resourcePreviewLine)
  );
  if (environment.OPENCODE_CONFIG)
    output(
      'Warning: OPENCODE_CONFIG points to a file, not the global directory; it is not used to resolve the destination, and its value is not printed.\n'
    );
  if (configState.dual)
    output('  Both opencode.json and opencode.jsonc were detected; consolidation requires explicit confirmation.\n');

  if (!dryRun) await resolveResourceConflicts(resourcePlans, ask, yes);

  let mergedValue = deepCopy(configState.value);
  let configText = configState.text;
  let dualConflicts = [];
  let consolidationConfirmed = false;
  if (configState.dual) {
    if (dryRun) {
      const merge = mergeDocuments(configState.jsonc.value, configState.json.value);
      mergedValue = merge.value;
      dualConflicts = merge.conflicts.map((conflict) => ({ ...conflict, choice: undefined }));
      dualConflicts.forEach((conflict) =>
        output(`  consolidation conflict ${conflict.path.join('.') || '<root>'}; choose JSONC or JSON.\n`)
      );
      configText = syncJsonc(configState.text, configState.jsonc.value, mergedValue);
    } else {
      if (yes || !ask)
        fail(
          'Consolidating opencode.json and opencode.jsonc requires explicit interactive confirmation; --yes does not confirm it.'
        );
      const confirmation = await ask('Consolidate opencode.json into opencode.jsonc using JSONC as the base?', [
        'yes',
        'no',
      ]);
      if (confirmation !== 'yes') fail('Consolidation not confirmed; no files were written.');
      consolidationConfirmed = true;
      const merge = mergeDocuments(configState.jsonc.value, configState.json.value);
      dualConflicts = merge.conflicts;
      if (dualConflicts.length) {
        preview(
          output,
          'Consolidation conflicts (for each path, keep JSONC or take JSON):',
          dualConflicts.map(({ path: segments }) => `  ${segments.join('.')}`)
        );
        for (const conflict of dualConflicts) {
          conflict.choice = await chooseConflict(
            {
              displayPath: conflict.path.join('.') || '<root>',
              question: `Difference between JSONC and JSON at ${conflict.path.join('.') || '<root>'}`,
              choices: ['keep-jsonc', 'take-json', 'cancel'],
            },
            ask,
            false
          );
        }
      }
      mergedValue = deepCopy(merge.value);
      for (const conflict of dualConflicts)
        if (conflict.choice === 'take-json') setValueAtPath(mergedValue, conflict.path, conflict.incoming);
      configText = syncJsonc(configState.text, configState.jsonc.value, mergedValue);
    }
  }

  let primaryAccepted = activeAgentAccepted(resourcePlans);
  if (
    dryRun &&
    resourcePlans.some(({ relativePath, action }) => relativePath === 'agents/AutanaSoft.md' && action === 'conflict')
  )
    primaryAccepted = false;
  const instructionAccepted = activeEngramResourceAccepted(resourcePlans);
  const baseConfigForDesired = mergedValue;
  const sourceDesired = sourceDesiredConfig(
    resources,
    detection,
    primaryAccepted,
    instructionAccepted && detection.engram.status === 'detected'
  );
  let desiredEngram = sourceDesired.get('engram');
  const currentEngram = getAtPath(baseConfigForDesired, MANAGED_CONFIG_KEYS.engram);
  const engramDisabled = isEngramDisabled(baseConfigForDesired);
  const instructionsInvalid =
    baseConfigForDesired.instructions !== undefined && !Array.isArray(baseConfigForDesired.instructions);
  const mcpStructureInvalid =
    (baseConfigForDesired.mcp !== undefined && !isObject(baseConfigForDesired.mcp)) ||
    (isObject(baseConfigForDesired.mcp) &&
      baseConfigForDesired.mcp.servers !== undefined &&
      !isObject(baseConfigForDesired.mcp.servers));
  if (engramDisabled || instructionsInvalid || mcpStructureInvalid) {
    sourceDesired.delete('engram');
    desiredEngram = undefined;
  }
  const engramConflictPending = Boolean(
    desiredEngram &&
    currentEngram.exists &&
    !isEqual(currentEngram.value, desiredEngram) &&
    manifest.configuration.engram !== hashValue(currentEngram.value)
  );
  if (desiredEngram && instructionAccepted && !engramConflictPending) {
    sourceDesired.set('engram_instruction', path.join(configDir, 'instructions', 'engram.md'));
  }
  const dependencyWarnings = existingDependencyWarnings(baseConfigForDesired, detection, configDir);
  if (dependencyWarnings.length) output(`Existing MCP dependencies:\n${dependencyWarnings.join('\n')}\n`);
  if (engramDisabled)
    output('Existing Engram is disabled; it is preserved without installing or enabling its instruction.\n');
  if (instructionsInvalid)
    output('The instructions property is not an array; it is preserved and new Engram configuration is skipped.\n');
  if (mcpStructureInvalid)
    output('The existing mcp.servers structure is not an object; it is preserved and Engram is not configured.\n');

  const configPlan = applyManagedConfig({
    initialValue: baseConfigForDesired,
    text: configText,
    desired: sourceDesired,
    manifest,
    instructionPath: path.join(configDir, 'instructions', 'engram.md'),
    dualConflicts,
  });

  let engramConflictChoice;
  if (!dryRun && configPlan.conflicts.length) {
    preview(
      output,
      'Configuration:',
      configPreviewLines([], configPlan.conflicts, consolidationConfirmed ? 'confirmed' : 'none', detection)
    );
    const decisions = await askForConflict(configPlan.conflicts, ask, yes);
    engramConflictChoice = decisions.get('engram');
    const resolved = applyConfigConflictChoices(configPlan, decisions);
    configPlan.text = resolved.text;
    configPlan.value = resolved.value;
    configPlan.ownership = resolved.ownership;
    configPlan.conflicts = [];
  } else if (dryRun && configPlan.conflicts.length) {
    // Dry-run is descriptive only: it never chooses a side of a conflict.
  }

  if (
    !dryRun &&
    desiredEngram &&
    activeEngramResourceAccepted(resourcePlans) &&
    !sourceDesired.has('engram_instruction')
  ) {
    const acceptedValue = getAtPath(configPlan.value, MANAGED_CONFIG_KEYS.engram);
    const engramAccepted =
      acceptedValue.exists &&
      isEqual(acceptedValue.value, desiredEngram) &&
      (!engramConflictPending || engramConflictChoice === 'replace');
    if (engramAccepted) {
      const instructionPath = path.join(configDir, 'instructions', 'engram.md');
      const instructionDesired = new Map([['engram_instruction', instructionPath]]);
      const instructionPlan = applyManagedConfig({
        initialValue: configPlan.value,
        text: configPlan.text,
        desired: instructionDesired,
        manifest,
        instructionPath,
      });
      if (instructionPlan.conflicts.length) {
        preview(output, 'Engram instruction:', configPreviewLines([], instructionPlan.conflicts, false, detection));
        const decisions = await askForConflict(instructionPlan.conflicts, ask, yes);
        const resolved = applyConfigConflictChoices(instructionPlan, decisions);
        configPlan.text = resolved.text;
        configPlan.value = resolved.value;
        for (const key of resolved.ownership) configPlan.ownership.add(key);
        if (!resolved.ownership.has('engram_instruction')) configPlan.ownership.delete('engram_instruction');
      } else {
        configPlan.text = instructionPlan.text;
        configPlan.value = instructionPlan.value;
        for (const key of instructionPlan.ownership) configPlan.ownership.add(key);
      }
      sourceDesired.set('engram_instruction', instructionPath);
    }
  }

  const managedInstructionAccepted =
    sourceDesired.has('engram_instruction') && configPlan.ownership.has('engram_instruction');
  if (
    (engramDisabled || instructionsInvalid || mcpStructureInvalid || (desiredEngram && !managedInstructionAccepted)) &&
    detection.engram.status === 'detected'
  ) {
    const instructionResource = resourcePlans.find(({ relativePath }) => relativePath === 'instructions/engram.md');
    if (instructionResource && ['write', 'update', 'noop'].includes(instructionResource.action)) {
      instructionResource.action = instructionResource.fingerprint.exists ? 'preserve' : 'skip';
      instructionResource.reason = 'Engram was not enabled with its instruction; it is not installed or updated';
    }
    sourceDesired.delete('engram_instruction');
  }

  const selectedConfigPath = configState.dual ? configState.jsoncPath : configState.selectedPath;
  const finalConfig = configPlan.value;
  const finalConfigText = configPlan.text;
  const parsedFinalConfig = parseDocument(finalConfigText, path.basename(selectedConfigPath)).value;
  if (!isEqual(parsedFinalConfig, finalConfig))
    fail('Planned JSONC configuration does not match the value to be validated; no files were written.');
  const instructionPath = path.join(configDir, 'instructions', 'engram.md');
  const configurationManifest = buildConfigurationManifest(
    manifest.configuration,
    finalConfig,
    configPlan.ownership,
    sourceDesired,
    instructionPath
  );
  const fileManifest = buildFileManifest(manifest.files, resourcePlans);
  const manifestText = stableManifest(fileManifest, configurationManifest);
  const configChanged = finalConfigText !== configState.text;
  const operations = [];
  for (const item of resourcePlans) {
    if (item.action === 'write' || item.action === 'update') {
      operations.push({
        kind: 'write',
        target: item.target,
        bytes: item.source.bytes,
        mode: item.fingerprint.exists ? item.fingerprint.mode : 0o644,
        label: item.relativePath,
      });
    }
  }
  if (configChanged || (!configState.json && !configState.jsonc) || (configState.dual && consolidationConfirmed)) {
    const configFingerprint = fingerprints.get(selectedConfigPath) ?? { exists: false };
    operations.push({
      kind: 'write',
      target: selectedConfigPath,
      bytes: Buffer.from(finalConfigText),
      mode: configFingerprint.exists ? configFingerprint.mode : 0o600,
      label: path.basename(selectedConfigPath),
    });
  }
  if (configState.dual)
    operations.push({
      kind: 'delete',
      target: configState.jsonPath,
      label: 'remove opencode.json after validating JSONC',
    });
  if (manifestText !== configState.manifestText)
    operations.push({
      kind: 'write',
      target: manifestPath,
      bytes: Buffer.from(manifestText),
      mode: fingerprints.get(manifestPath)?.exists ? fingerprints.get(manifestPath).mode : 0o600,
      label: MANIFEST_NAME,
    });

  const unresolved = configPlan.conflicts.length > 0;
  const mergedUnresolved = dualConflicts.some(({ choice }) => !choice);
  const resourceUnresolved = dryRun && resourcePlans.some(({ action }) => action === 'conflict');
  const consolidationPreview = dryRun && configState.dual ? 'required' : consolidationConfirmed ? 'confirmed' : 'none';
  preview(output, dryRun ? 'Preview (no writes):' : 'Full plan ready to apply:', [
    ...resourcePlans.map(resourcePreviewLine),
    ...configPreviewLines(operations, configPlan.conflicts, consolidationPreview, detection),
  ]);
  if (mergedUnresolved) output('  Consolidation cannot be performed in dry-run: explicit decisions are missing.\n');
  if (resourceUnresolved) output('  Resource conflicts require an explicit decision.\n');

  if (dryRun)
    return {
      configDir,
      operations: operations.map(({ kind, label }) => ({ kind, label })),
      conflicts:
        configPlan.conflicts.length +
        dualConflicts.filter(({ choice }) => !choice).length +
        resourcePlans.filter(({ action }) => action === 'conflict').length,
    };
  if (unresolved || mergedUnresolved) fail('Unresolved conflicts remain; no files were written.');

  if (operations.length > 0 && !yes) {
    if (!ask)
      fail(
        'Final interactive confirmation is required before writing; use --yes to accept operations without conflicts.'
      );
    const confirmation = await ask('Apply the complete plan shown?', ['yes', 'no', 'cancel']);
    if (confirmation !== 'yes') fail('Installation canceled; no files were written.');
  }
  return applyOperations({ configDir, operations, fingerprints, hooks: options.hooks });
}

export function parseArgs(argumentsList) {
  const parsed = { configDir: undefined, dryRun: false, yes: false, help: false };
  const seen = new Set();
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === '--help' || argument === '-h') {
      if (seen.has('help')) fail('Duplicate option: --help.');
      seen.add('help');
      parsed.help = true;
      continue;
    }
    if (argument === '--dry-run' || argument === '--yes') {
      if (seen.has(argument)) fail(`Duplicate option: ${argument}.`);
      seen.add(argument);
      parsed[argument === '--dry-run' ? 'dryRun' : 'yes'] = true;
      continue;
    }
    if (argument === '--config-dir') {
      if (seen.has(argument)) fail('Duplicate option: --config-dir.');
      seen.add(argument);
      const value = argumentsList[index + 1];
      if (!value || value.startsWith('--')) fail('Missing value for --config-dir.');
      parsed.configDir = value;
      index += 1;
      continue;
    }
    fail(`Unknown option: ${argument}.`);
  }
  if (parsed.help && argumentsList.length > 1) fail('--help cannot be combined with other options.');
  return parsed;
}

function usage() {
  return [
    'Usage: node scripts/install.mjs [--config-dir <path>] [--dry-run] [--yes]',
    '  --config-dir  OpenCode V2 global destination (default: ~/.config/opencode)',
    '  --dry-run     Show the plan without creating files, directories, temporary files, or processes',
    '  --yes         Skip final confirmation for safe changes; never resolves conflicts or consolidates JSON/JSONC',
    '  --help        Show this help',
  ].join('\n');
}

/**
 * Prompts without filesystem effects. Full choices and unambiguous one-letter aliases are case-insensitive;
 * optional streams let tests exercise the same terminal adapter without a real TTY.
 */
export async function terminalAsk(question, choices, { input = process.stdin, output = process.stdout } = {}) {
  const interfaceInstance = readline.createInterface({ input, output });
  try {
    const labels = choices.map((choice) => {
      const first = choice[0].toLowerCase();
      const uniqueInitial = choices.filter((item) => item[0].toLowerCase() === first).length === 1;
      return uniqueInitial ? `${first.toUpperCase()}(${choice.slice(1)})` : choice;
    });
    const answer = (await interfaceInstance.question(`${question} [${labels.join('/')}]: `)).trim().toLowerCase();
    const exact = choices.find((choice) => choice.toLowerCase() === answer);
    if (exact) return exact;
    const matches = answer.length === 1 ? choices.filter((choice) => choice[0].toLowerCase() === answer) : [];
    return matches.length === 1 ? matches[0] : answer;
  } finally {
    interfaceInstance.close();
  }
}

function isCliEntry() {
  return process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
}

if (isCliEntry()) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      process.stdout.write(`${usage()}\n`);
    } else {
      const ask = process.stdin.isTTY && process.stdout.isTTY ? terminalAsk : undefined;
      const result = await install({ ...args, ask, output: (message) => process.stdout.write(message) });
      if (args.dryRun)
        process.stdout.write(`\nPreview complete; ${result.conflicts} conflict(s), no changes written to disk.\n`);
      else
        process.stdout.write(
          `\nInstallation complete. Backups: ${result.backupDirectory ?? 'not needed (no changes)'}\n`
        );
    }
  } catch (error) {
    const message =
      error instanceof InstallerError
        ? error.message
        : `I/O error (${error?.code ?? 'unknown'}); the operation could not be completed.`;
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
  }
}
