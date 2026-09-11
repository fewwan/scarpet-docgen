import {parseScript, resolveExpression} from 'scarpet-parser';

/**
 * Clean up a doc comment (`///`) for display as markdown.
 *
 * Unlike regular comments, doc comments contain markdown so the line structure
 * and indentation are preserved instead of being collapsed into a single line.
 *
 * @param {string} comment
 * @returns {string}
 */
function cleanupDocComment(comment) {
  const lines = comment.split('\n');
  let clean = '';
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (line.endsWith('\r')) line = line.slice(0, -1);
    // strip the /// prefix and a single following space from each line
    if (line.startsWith('///')) line = line.slice(3);
    else if (line.startsWith('//')) line = line.slice(2);
    if (line.startsWith(' ')) line = line.slice(1);
    clean += line;
    if (i !== lines.length - 1) clean += '\n';
  }
  return clean.trim();
}

/**
 * Extract the script-level documentation header from a file's source text.
 *
 * The header is the first `///` doc comment block that is preceded only by
 * blank lines and comments, and is NOT followed by a function declaration.
 *
 * @param {string} sourceText
 * @returns {string | undefined}
 */
export function getFileHeaderDocComment(sourceText) {
  const lines = sourceText.split('\n');
  let i = 0;
  // Skip leading blank lines and non-doc comments.
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (
      trimmed === '' ||
      (trimmed.startsWith('//') && !trimmed.startsWith('///'))
    ) {
      i++;
      continue;
    }
    break;
  }
  // Not a doc comment: no header.
  if (i >= lines.length || !lines[i].trim().startsWith('///')) {
    return undefined;
  }
  // Collect the doc comment block.
  const docLines = [];
  while (i < lines.length && lines[i].trim().startsWith('///')) {
    docLines.push(lines[i]);
    i++;
  }
  // Skip blank lines after the doc comment.
  while (i < lines.length && lines[i].trim() === '') i++;
  // If a function declaration follows, this doc comment belongs to that
  // function, not to the file.
  if (i < lines.length) {
    const nextLine = lines[i].trim();
    if (/^\w+\s*\([^)]*\)\s*->/.test(nextLine)) {
      return undefined;
    }
  }
  return cleanupDocComment(docLines.join('\n'));
}

/**
 * Get the signature or syntax hint for the given function declaration.
 *
 * @param {import('scarpet-parser').FunctionDeclaration} declaration
 * @returns {string | undefined}
 */
function getFunctionSyntax(declaration) {
  let syntax = '';
  const signature = resolveExpression(declaration.signature);
  if (signature?.kind !== 'FunctionExpression') return undefined;
  syntax += signature.name.value;
  syntax += '(';
  /** @type {string[]} */
  const params = [];
  /** @type {string | undefined} */
  let rest = undefined;
  for (const p of signature.params) {
    const param = resolveExpression(p);
    if (param === undefined) continue;
    if (param.kind === 'Variable') {
      params.push(param.name);
    } else if (
      param.kind === 'UnaryExpression' &&
      param.operator === '...' &&
      param.value !== undefined &&
      param.value.kind === 'Variable'
    ) {
      rest = param.value.name;
    }
    // ignore outer or invalid parameters
  }
  syntax += params.join(', ');
  if (rest !== undefined)
    syntax += (params.length !== 0 ? ', ...' : '...') + rest;
  syntax += ')';
  return syntax;
}

/** @typedef {import('scarpet-parser').Node} Node */

/**
 * Collect the top-level statements of a script.
 *
 * The AST root is a binary expression chain linked with the `;` operator, so
 * the statements are all non-`;` nodes reachable from the left/right of it.
 *
 * @param {Node | undefined | null} node
 * @param {Node[]} [out]
 * @returns {Node[]}
 */
function getTopLevelStatements(node, out = []) {
  if (!node || typeof node.kind !== 'string') return out;
  if (node.kind === 'BinaryExpression' && node.operator === ';') {
    getTopLevelStatements(node.lvalue, out);
    getTopLevelStatements(node.rvalue, out);
  } else {
    out.push(node);
  }
  return out;
}

/**
 * A single documented symbol extracted from a script.
 *
 * @typedef {object} DocumentedSymbol
 * @property {string} name Symbol name.
 * @property {string} syntax Signature for functions, plain name otherwise.
 * @property {string} doc Cleaned doc comment.
 */

/**
 * Grouped documentation extracted from a script file.
 *
 * @typedef {object} ScriptDocumentation
 * @property {string | undefined} fileHeader Script-level doc comment, if any.
 * @property {DocumentedSymbol[]} constants Global constants (`global_X`).
 * @property {DocumentedSymbol[]} globals Mutable globals (`global_x`).
 * @property {DocumentedSymbol[]} publicFunctions Functions without a `_`
 *   prefix.
 * @property {DocumentedSymbol[]} protectedFunctions Functions with a single `_`
 *   prefix.
 * @property {DocumentedSymbol[]} privateFunctions Functions with a `__` prefix.
 */

/**
 * Analyze a Scarpet script and extract its documented symbols.
 *
 * Only symbols with a doc comment (`///`) are included.
 *
 * @param {string} sourceText
 * @returns {ScriptDocumentation}
 */
export function analyzeScript(sourceText) {
  /** @type {DocumentedSymbol[]} */
  const constants = [];
  /** @type {DocumentedSymbol[]} */
  const globals = [];
  /** @type {DocumentedSymbol[]} */
  const publicFunctions = [];
  /** @type {DocumentedSymbol[]} */
  const protectedFunctions = [];
  /** @type {DocumentedSymbol[]} */
  const privateFunctions = [];

  const root = parseScript(sourceText, {diagnostics: []});
  for (const statement of getTopLevelStatements(root)) {
    if (statement.kind === 'FunctionDeclaration') {
      const syntax = getFunctionSyntax(statement);
      if (syntax === undefined) continue;
      const name = syntax.slice(0, syntax.indexOf('('));
      const doc = statement.docComment;
      if (!doc) continue;
      const symbol = {name, syntax, doc: cleanupDocComment(doc)};
      if (name.startsWith('__')) privateFunctions.push(symbol);
      else if (name.startsWith('_')) protectedFunctions.push(symbol);
      else publicFunctions.push(symbol);
    } else if (
      statement.kind === 'BinaryExpression' &&
      statement.operator === '=' &&
      statement.lvalue !== null &&
      statement.lvalue !== undefined &&
      statement.lvalue.kind === 'Variable'
    ) {
      const name = statement.lvalue.name;
      if (!name.startsWith('global_')) continue;
      const doc = statement.docComment;
      if (!doc) continue;
      const symbol = {name, syntax: name, doc: cleanupDocComment(doc)};
      const suffix = name.slice('global_'.length);
      if (/^[A-Z0-9_]+$/.test(suffix)) constants.push(symbol);
      else globals.push(symbol);
    }
  }

  return {
    fileHeader: getFileHeaderDocComment(sourceText),
    constants,
    globals,
    publicFunctions,
    protectedFunctions,
    privateFunctions,
  };
}
