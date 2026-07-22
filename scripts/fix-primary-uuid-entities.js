/**
 * Codemod: replace @PrimaryGeneratedColumn('uuid') with app-side UUID generation.
 * Postgres tables use varchar(36) PKs with no DEFAULT; TypeORM omits id on insert.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', 'build', '.git', 'coverage']);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

function ensureImport(src, named, fromModule) {
  const importRe = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*['"]${fromModule.replace('/', '\\/')}['"]\\s*;?`);
  const m = src.match(importRe);
  if (m) {
    const names = m[1].split(',').map((s) => s.trim()).filter(Boolean);
    if (names.includes(named)) return src;
    names.push(named);
    names.sort((a, b) => a.localeCompare(b));
    return src.replace(importRe, `import { ${names.join(', ')} } from '${fromModule}';`);
  }
  // Insert after existing imports or at top
  const cryptoImport = fromModule === 'crypto'
    ? `import { ${named} } from 'crypto';\n`
    : `import { ${named} } from '${fromModule}';\n`;
  if (fromModule === 'crypto') {
    if (/from\s+['"]crypto['"]/.test(src)) return src;
    return cryptoImport + src;
  }
  return src;
}

function removeNamedImport(src, named, fromModule) {
  const importRe = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*['"]${fromModule.replace('/', '\\/')}['"]\\s*;?\\n?`);
  const m = src.match(importRe);
  if (!m) return src;
  const names = m[1].split(',').map((s) => s.trim()).filter((n) => n && n !== named);
  if (!names.length) return src.replace(importRe, '');
  return src.replace(importRe, `import { ${names.join(', ')} } from '${fromModule}';\n`);
}

function transform(src, file) {
  if (!/@PrimaryGeneratedColumn\(\s*['"]uuid['"]\s*\)/.test(src)) return null;
  // Already fixed pattern
  if (/do not use @PrimaryGeneratedColumn\('uuid'\)/.test(src) && /@BeforeInsert\(\)[\s\S]*?ensureId/.test(src)) {
    return null;
  }

  let next = src;

  // Replace decorator + id field (two common layouts)
  const patterns = [
    /@PrimaryGeneratedColumn\(\s*['"]uuid['"]\s*\)\s*\n\s*id!\s*:\s*string\s*;/g,
    /@PrimaryGeneratedColumn\(\s*['"]uuid['"]\s*\)\s+id!\s*:\s*string\s*;/g,
  ];

  let replaced = false;
  const replacement = `@PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;`;

  for (const re of patterns) {
    if (re.test(next)) {
      next = next.replace(re, replacement);
      replaced = true;
    }
  }
  if (!replaced) return null;

  // Add ensureId if missing
  if (!/@BeforeInsert\(\)[\s\S]{0,80}ensureId\s*\(/.test(next)) {
    next = next.replace(
      /(@PrimaryColumn\(\{ type: 'varchar', length: 36 \}\)\s*\n\s*id!: string;)/,
      `$1

  @BeforeInsert()
  ensureId() {
    if (!this.id) this.id = randomUUID();
  }`,
    );
  }

  // Imports
  next = ensureImport(next, 'randomUUID', 'crypto');
  next = ensureImport(next, 'BeforeInsert', 'typeorm');
  next = ensureImport(next, 'PrimaryColumn', 'typeorm');
  if (!/@PrimaryGeneratedColumn/.test(next)) {
    next = removeNamedImport(next, 'PrimaryGeneratedColumn', 'typeorm');
  }

  // Deduplicate randomUUID import if we added twice
  const cryptoImports = next.match(/import\s*\{[^}]*randomUUID[^}]*\}\s*from\s*['"]crypto['"]\s*;?/g) || [];
  if (cryptoImports.length > 1) {
    let seen = false;
    next = next.replace(/import\s*\{[^}]*randomUUID[^}]*\}\s*from\s*['"]crypto['"]\s*;?\n?/g, (block) => {
      if (seen) return '';
      seen = true;
      return block.endsWith('\n') ? block : block + '\n';
    });
  }

  return next === src ? null : next;
}

const files = walk(ROOT);
let changed = 0;
const changedFiles = [];

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const next = transform(src, file);
  if (!next) continue;
  fs.writeFileSync(file, next);
  changed += 1;
  changedFiles.push(path.relative(ROOT, file).replace(/\\/g, '/'));
}

console.log(`Updated ${changed} files`);
changedFiles.forEach((f) => console.log(f));
