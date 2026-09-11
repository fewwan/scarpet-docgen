import {
  readdir,
  stat,
  mkdir,
  writeFile,
  realpath,
  readFile,
} from 'node:fs/promises';
import {join, basename, extname} from 'node:path';
import {analyzeScript} from './analyze.js';
import {renderScript, renderIndex} from './render.js';

const MAX_DEPTH = 12;
const SCRIPT_RE = /\.(sc|scl)$/;

/**
 * A directory node discovered during the input tree scan.
 *
 * @typedef {object} DirNode
 * @property {string} name Directory entry name.
 * @property {string} abs Absolute directory path.
 * @property {DirNode[]} dirs Child directories (sorted during emission).
 * @property {{name: string; stem: string; abs: string}[]} files Scripts (sorted
 *   during emission).
 * @property {boolean} emitted Whether docs have been generated in this dir.
 */

/**
 * Create a new DirNode.
 *
 * @param {string} name
 * @param {string} abs
 * @returns {DirNode}
 */
function makeDirNode(name, abs) {
  return {name, abs, dirs: [], files: [], emitted: false};
}

/**
 * Recursively collect the input file tree into `node`.
 *
 * @param {string} dir Absolute directory path.
 * @param {DirNode} node Target node.
 * @param {string} outReal Realpath of the output directory (skipped during
 *   scan).
 * @param {Set<string>} visited Realpath set to avoid symlink cycles.
 * @param {number} depth
 * @returns {Promise<boolean>} `true` if at least one script was found.
 */
async function collectDir(dir, node, outReal, visited, depth) {
  if (depth > MAX_DEPTH) return false;
  let dirReal;
  try {
    dirReal = await realpath(dir);
  } catch {
    return false;
  }
  if (visited.has(dirReal)) return false;
  visited.add(dirReal);
  if (dirReal === outReal) return false;

  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    return false;
  }

  let hasScripts = false;
  const childDirs = /** @type {Map<string, DirNode>} */ (new Map());

  for (const name of entries) {
    if (name.startsWith('.')) continue;
    const childPath = join(dir, name);
    let s;
    try {
      s = await stat(childPath);
    } catch {
      continue;
    }

    if (s.isDirectory()) {
      let childNode = childDirs.get(name);
      if (childNode === undefined) {
        childNode = makeDirNode(name, childPath);
        childDirs.set(name, childNode);
      }
      if (await collectDir(childPath, childNode, outReal, visited, depth + 1)) {
        hasScripts = true;
      }
    } else if (s.isFile() && SCRIPT_RE.test(name)) {
      const stem = basename(name, extname(name));
      node.files.push({name, stem, abs: childPath});
      hasScripts = true;
    }
  }

  // Merge discovered child dirs that contained scripts.
  for (const childNode of childDirs.values()) {
    if (childNode.dirs.length > 0 || childNode.files.length > 0) {
      node.dirs.push(childNode);
    }
  }

  return hasScripts;
}

/**
 * Emit documentation for `node` into `outDir`.
 *
 * @param {DirNode} node
 * @param {string} outDir
 * @param {string[]} generated Names of source scripts that produced docs.
 * @returns {Promise<boolean>} `true` if any files were written.
 */
async function emitDir(node, outDir, generated) {
  const indexEntries = /** @type {{name: string; isDir: boolean}[]} */ ([]);

  // Emit child directories first (recurse).
  node.dirs.sort((a, b) => a.name.localeCompare(b.name));
  for (const child of node.dirs) {
    const childOut = join(outDir, child.name);
    if (await emitDir(child, childOut, generated)) {
      indexEntries.push({name: child.name, isDir: true});
    }
  }

  // Emit script files.
  node.files.sort((a, b) => a.stem.localeCompare(b.stem));
  for (const file of node.files) {
    let text;
    try {
      text = await readFile(file.abs, 'utf8');
    } catch {
      continue;
    }
    const doc = analyzeScript(text);
    const md = renderScript(file.stem + extname(file.name), doc);
    if (md !== undefined) {
      const mdPath = join(outDir, file.stem + '.md');
      await mkdir(outDir, {recursive: true});
      await writeFile(mdPath, md, 'utf8');
      indexEntries.push({name: file.stem, isDir: false});
      node.emitted = true;
      generated.push(file.name);
    }
  }

  // Emit index.md if there is anything to list.
  if (indexEntries.length > 0) {
    await mkdir(outDir, {recursive: true});
    const indexMd = renderIndex(indexEntries);
    await writeFile(join(outDir, 'index.md'), indexMd, 'utf8');
    node.emitted = true;
  }

  return indexEntries.length > 0;
}

/**
 * Generate documentation for every Scarpet script in `inputDir`.
 *
 * @param {string} inputDir Absolute input directory path.
 * @param {string} outDir Absolute output directory path.
 * @returns {Promise<{outDir: string; files: string[]}>} The output directory
 *   and the source script filenames that produced documentation.
 */
export async function generate(inputDir, outDir) {
  let outReal;
  try {
    outReal = await realpath(outDir);
  } catch {
    // Output does not exist yet, use resolved path.
    outReal = outDir;
  }

  const root = makeDirNode('', inputDir);
  const visited = new Set();
  await collectDir(inputDir, root, outReal, visited, 0);
  /** @type {string[]} */
  const generated = [];
  await emitDir(root, outDir, generated);
  return {outDir, files: generated};
}
