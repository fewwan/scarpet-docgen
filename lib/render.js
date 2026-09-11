/**
 * Render the markdown documentation for a single script file.
 *
 * @param {string} filename Original filename (e.g. `utils.scl`).
 * @param {import('./analyze.js').ScriptDocumentation} doc
 * @returns {string | undefined} Rendered markdown, or `undefined` if there is
 *   nothing to document.
 */
export function renderScript(filename, doc) {
  const {
    fileHeader,
    constants,
    globals,
    publicFunctions,
    protectedFunctions,
    privateFunctions,
  } = doc;
  const groups = [
    constants,
    globals,
    publicFunctions,
    protectedFunctions,
    privateFunctions,
  ];
  if (!fileHeader && groups.every((symbols) => symbols.length === 0))
    return undefined;
  let md = `# ${filename}\n\n`;
  if (fileHeader) md += fileHeader + '\n\n';
  for (const symbols of groups) {
    for (const {syntax, doc} of symbols) {
      md += `## ${syntax}\n\n${doc}\n\n`;
    }
  }
  return md.trimEnd() + '\n';
}

/**
 * Render an index.md for a directory.
 *
 * @param {{name: string; isDir: boolean}[]} entries
 * @returns {string}
 */
export function renderIndex(entries) {
  let md = '# Documentation Index\n\n';
  for (const {name, isDir} of entries) {
    const link = isDir ? `${name}/index.md` : `${name}.md`;
    md += `- [${name}](${link})\n`;
  }
  return md;
}
