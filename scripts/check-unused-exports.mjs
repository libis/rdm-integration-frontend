import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const projectRoot = process.cwd();
const srcRoot = path.join(projectRoot, 'src');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!full.endsWith('.ts')) continue;
    if (full.endsWith('.d.ts')) continue;
    out.push(full);
  }
  return out;
}

function getDeclarationNames(nameNode) {
  if (!nameNode) return [];
  if (ts.isIdentifier(nameNode)) return [nameNode.text];
  if (ts.isObjectBindingPattern(nameNode) || ts.isArrayBindingPattern(nameNode)) {
    const names = [];
    for (const el of nameNode.elements) {
      if (ts.isOmittedExpression(el)) continue;
      names.push(...getDeclarationNames(el.name));
    }
    return names;
  }
  return [];
}

function resolveModule(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.mts`,
    path.join(base, 'index.ts'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return path.normalize(c);
  }
  return null;
}

const files = walk(srcRoot).map((f) => path.normalize(f));
const fileSet = new Set(files);

const exportsByFile = new Map();
const usedNamesByFile = new Map();
const wildcardUsedFiles = new Set();

function addExport(file, name) {
  if (!exportsByFile.has(file)) exportsByFile.set(file, new Set());
  exportsByFile.get(file).add(name);
}

function addUsed(file, name) {
  if (!usedNamesByFile.has(file)) usedNamesByFile.set(file, new Set());
  usedNamesByFile.get(file).add(name);
}

for (const file of files) {
  const sourceText = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true);

  for (const stmt of sf.statements) {
    if (
      ts.isFunctionDeclaration(stmt) ||
      ts.isClassDeclaration(stmt) ||
      ts.isInterfaceDeclaration(stmt) ||
      ts.isTypeAliasDeclaration(stmt) ||
      ts.isEnumDeclaration(stmt)
    ) {
      const isExported = stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      if (isExported && stmt.name) addExport(file, stmt.name.text);
      continue;
    }

    if (ts.isVariableStatement(stmt)) {
      const isExported = stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      if (isExported) {
        for (const decl of stmt.declarationList.declarations) {
          for (const n of getDeclarationNames(decl.name)) addExport(file, n);
        }
      }
      continue;
    }

    if (ts.isExportAssignment(stmt)) {
      addExport(file, 'default');
      continue;
    }

    if (ts.isExportDeclaration(stmt)) {
      if (stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier)) {
        const target = resolveModule(file, stmt.moduleSpecifier.text);
        if (target && fileSet.has(target)) {
          if (stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
            for (const el of stmt.exportClause.elements) {
              const importedName = (el.propertyName ?? el.name).text;
              addUsed(target, importedName);
            }
          } else {
            wildcardUsedFiles.add(target);
          }
        }
      } else if (stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
        for (const el of stmt.exportClause.elements) {
          const localName = (el.propertyName ?? el.name).text;
          addExport(file, localName);
        }
      }
      continue;
    }

    if (!ts.isImportDeclaration(stmt)) continue;
    if (!stmt.moduleSpecifier || !ts.isStringLiteral(stmt.moduleSpecifier)) continue;
    const target = resolveModule(file, stmt.moduleSpecifier.text);
    if (!target || !fileSet.has(target)) continue;
    const clause = stmt.importClause;
    if (!clause) continue;
    if (clause.name) addUsed(target, 'default');
    if (!clause.namedBindings) continue;
    if (ts.isNamespaceImport(clause.namedBindings)) {
      wildcardUsedFiles.add(target);
      continue;
    }
    for (const el of clause.namedBindings.elements) {
      const importedName = (el.propertyName ?? el.name).text;
      addUsed(target, importedName);
    }
  }
}

const ignoredFiles = new Set([
  path.normalize(path.join(srcRoot, 'main.ts')),
  path.normalize(path.join(srcRoot, 'test.ts')),
  path.normalize(path.join(srcRoot, 'environments', 'environment.ts')),
  path.normalize(path.join(srcRoot, 'environments', 'environment.prod.ts')),
  path.normalize(path.join(srcRoot, 'environments', 'environment.development.ts')),
]);

const unused = [];
for (const [file, exportedNames] of exportsByFile.entries()) {
  if (ignoredFiles.has(file)) continue;
  const used = usedNamesByFile.get(file) ?? new Set();
  const wildcardUsed = wildcardUsedFiles.has(file);
  for (const name of exportedNames) {
    if (!wildcardUsed && !used.has(name)) {
      unused.push({ file, name });
    }
  }
}

unused.sort((a, b) => (a.file === b.file ? a.name.localeCompare(b.name) : a.file.localeCompare(b.file)));

if (unused.length === 0) {
  console.log('No unused exports found.');
  process.exit(0);
}

console.error('Unused exports detected:');
for (const item of unused) {
  console.error(`- ${path.relative(projectRoot, item.file)} :: ${item.name}`);
}
process.exit(1);
