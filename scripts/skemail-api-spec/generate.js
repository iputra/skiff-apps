/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * Generates the API spec that skemail-web needs from a backend.
 *
 * 1. Walks the import graph starting from skemail-web/src (following relative imports and
 *    named imports from the shared skiff-front-* libs) to find the source files the app ships.
 * 2. Finds which GraphQL operations from libs/skiff-front-graphql/graphql those files use
 *    (via the generated `useXQuery` / `useXMutation` / `XDocument` identifiers).
 * 3. Computes the minimal subset of libs/skiff-graphql/src/completeSchema.graphql those
 *    operations touch, and validates every used operation against that subset.
 *
 * Usage: node scripts/skemail-api-spec/generate.js
 * Outputs to docs/skemail-web-api/.
 */
const fs = require('fs');
const path = require('path');

const {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLUnionType,
  Kind,
  TypeInfo,
  buildASTSchema,
  buildSchema,
  getNamedType,
  isInputObjectType,
  parse,
  print,
  validate,
  visit,
  visitWithTypeInfo
} = require('graphql');

const ROOT = path.resolve(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'docs/skemail-web-api');
const SCHEMA_PATH = path.join(ROOT, 'libs/skiff-graphql/src/completeSchema.graphql');
const OPERATIONS_DIR = path.join(ROOT, 'libs/skiff-front-graphql/graphql');
const APP_SRC = path.join(ROOT, 'skemail-web/src');
const LIBS = {
  'skiff-front-utils': path.join(ROOT, 'libs/skiff-front-utils/src'),
  'skiff-front-graphql': path.join(ROOT, 'libs/skiff-front-graphql/src'),
  'skiff-front-search': path.join(ROOT, 'libs/skiff-front-search/src')
};
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const ROOT_TYPES = ['Query', 'Mutation', 'Subscription'];

const rel = (p) => path.relative(ROOT, p);

function walk(dir, filter) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : walk(full, filter);
    return filter(full) ? [full] : [];
  });
}

const isSource = (f) =>
  SOURCE_EXTENSIONS.includes(path.extname(f)) && !/\.(test|spec|stories)\.[jt]sx?$/.test(f) && !f.endsWith('.d.ts');

function resolveFile(base) {
  const candidates = [
    base,
    ...SOURCE_EXTENSIONS.map((ext) => base + ext),
    ...SOURCE_EXTENSIONS.map((ext) => path.join(base, 'index' + ext))
  ];
  return candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
}

// ---------------------------------------------------------------------------
// 1. Import graph
// ---------------------------------------------------------------------------

const IMPORT_RE = /(?:import|export)\s+(type\s+)?([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
const SIDE_EFFECT_IMPORT_RE = /import\s+['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT_RE = /import\(\s*['"]([^'"]+)['"]\s*\)/g;

function parseNamedImports(clause) {
  const match = clause.match(/\{([\s\S]*)\}/);
  if (!match) return [];
  return match[1]
    .split(',')
    .map((s) =>
      s
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)[0]
        .trim()
    )
    .filter(Boolean);
}

// Map exported symbol name -> defining file, for each shared lib.
const symbolIndex = {};
for (const [lib, dir] of Object.entries(LIBS)) {
  const index = new Map();
  const files = walk(dir, isSource);
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    const declRe =
      /export\s+(?:default\s+)?(?:declare\s+)?(?:async\s+)?(?:abstract\s+)?(?:function\*?|const|let|var|class|enum|interface|type)\s+([A-Za-z0-9_$]+)/g;
    let m;
    while ((m = declRe.exec(src))) if (!index.has(m[1])) index.set(m[1], file);
    // `export { default as Foo } from './Foo'` and `export { Foo }`
    const reExportRe = /export\s+\{([\s\S]*?)\}(?:\s+from\s+['"]([^'"]+)['"])?/g;
    while ((m = reExportRe.exec(src))) {
      const target = m[2] && m[2].startsWith('.') ? resolveFile(path.resolve(path.dirname(file), m[2])) : file;
      for (const part of m[1].split(',')) {
        const [orig, alias] = part
          .trim()
          .replace(/^type\s+/, '')
          .split(/\s+as\s+/)
          .map((s) => s && s.trim());
        const name = alias || orig;
        if (name && target && !index.has(name)) index.set(name, target);
        if (name && target && orig === 'default' && target !== file) index.set(name, target);
      }
    }
  }
  symbolIndex[lib] = index;
}

const reachable = new Set();
const unresolvedSymbols = new Set();
const queue = walk(APP_SRC, isSource);
while (queue.length) {
  const file = queue.pop();
  if (reachable.has(file)) continue;
  reachable.add(file);
  const src = fs.readFileSync(file, 'utf8');
  const specifiers = [];
  let m;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(src))) specifiers.push({ spec: m[3], clause: m[2] });
  SIDE_EFFECT_IMPORT_RE.lastIndex = 0;
  while ((m = SIDE_EFFECT_IMPORT_RE.exec(src))) specifiers.push({ spec: m[1], clause: '' });
  DYNAMIC_IMPORT_RE.lastIndex = 0;
  while ((m = DYNAMIC_IMPORT_RE.exec(src))) specifiers.push({ spec: m[1], clause: '' });

  for (const { spec, clause } of specifiers) {
    if (spec.startsWith('.')) {
      const target = resolveFile(path.resolve(path.dirname(file), spec));
      if (target && isSource(target)) queue.push(target);
      continue;
    }
    const lib = Object.keys(LIBS).find((l) => spec === l || spec.startsWith(l + '/'));
    if (!lib) continue;
    for (const name of parseNamedImports(clause)) {
      const target = symbolIndex[lib].get(name);
      if (target) queue.push(target);
      else unresolvedSymbols.add(`${lib}:${name}`);
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Operations and their usage
// ---------------------------------------------------------------------------

const schemaSDL = fs.readFileSync(SCHEMA_PATH, 'utf8');
const fullSchema = buildASTSchema(parse(schemaSDL), { assumeValidSDL: true });

const opFiles = walk(OPERATIONS_DIR, (f) => f.endsWith('.graphql')).sort();
const operations = new Map(); // name -> { kind, def, file }
const fragments = new Map(); // name -> { def, file }

// Client-only fields (`@client`) are computed by Apollo type policies, never sent to the server.
const stripClientFields = (node) =>
  visit(node, {
    Field: (field) => (field.directives?.some((d) => d.name.value === 'client') ? null : undefined)
  });

for (const file of opFiles) {
  const doc = parse(fs.readFileSync(file, 'utf8'));
  for (const def of doc.definitions) {
    const clean = stripClientFields(def);
    if (def.kind === Kind.OPERATION_DEFINITION) {
      // Some operations are defined in more than one file; keep every distinct definition.
      const existing = operations.get(def.name.value);
      if (existing) {
        if (!existing.defs.some((d) => print(d) === print(clean))) existing.defs.push(clean);
      } else {
        operations.set(def.name.value, { kind: def.operation, def: clean, defs: [clean], file });
      }
    } else if (def.kind === Kind.FRAGMENT_DEFINITION) {
      fragments.set(def.name.value, { def: clean, file });
    }
  }
}

const capitalize = (s) => s[0].toUpperCase() + s.slice(1);
// Same word splitting as change-case's pascalCase, which graphql-codegen uses for names.
const pascalCase = (s) =>
  s
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join('');
// Codegen output declares every hook/document, so it never counts as a usage.
const reachableSources = [...reachable]
  .filter((file) => !file.includes(`${path.sep}generated${path.sep}`))
  .map((file) => ({ file, src: fs.readFileSync(file, 'utf8') }));

for (const [name, op] of operations) {
  const suffix = capitalize(op.kind);
  // Codegen pascal-cases operation names: `query getThreadFromID` -> useGetThreadFromIdQuery / GetThreadFromIdDocument.
  const base = pascalCase(name);
  const ids = [`use${base}${suffix}`, `use${base}Lazy${suffix}`, `use${base}Suspense${suffix}`, `${base}Document`];
  const re = new RegExp(`\\b(${ids.join('|')})\\b`);
  op.usedIn = reachableSources.filter(({ src }) => re.test(src)).map(({ file }) => rel(file));
}

const usedOps = [...operations.entries()].filter(([, op]) => op.usedIn.length > 0);
const unusedOps = [...operations.entries()].filter(([, op]) => op.usedIn.length === 0);

function collectFragmentSpreads(node, acc = new Set()) {
  visit(node, {
    FragmentSpread(spread) {
      const name = spread.name.value;
      if (acc.has(name)) return;
      acc.add(name);
      const frag = fragments.get(name);
      if (!frag) throw new Error(`Unknown fragment ${name}`);
      collectFragmentSpreads(frag.def, acc);
    }
  });
  return acc;
}

const docFor = (opDef) => ({
  kind: Kind.DOCUMENT,
  definitions: [opDef, ...[...collectFragmentSpreads(opDef)].map((f) => fragments.get(f).def)]
});

// ---------------------------------------------------------------------------
// 3. Minimal schema subset
// ---------------------------------------------------------------------------

const usedFields = new Map(); // typeName -> Set(fieldName)
const usedTypes = new Set();

function addType(type) {
  const named = getNamedType(type);
  if (!named || usedTypes.has(named.name)) return;
  usedTypes.add(named.name);
  if (isInputObjectType(named)) {
    for (const field of Object.values(named.getFields())) addType(field.type);
  }
}
function addField(parent, fieldName) {
  if (!usedFields.has(parent.name)) usedFields.set(parent.name, new Set());
  usedFields.get(parent.name).add(fieldName);
  usedTypes.add(parent.name);
}

const errors = [];
for (const [name, op] of usedOps)
  for (const def of op.defs) {
    const doc = docFor(def);
    const validationErrors = validate(fullSchema, doc);
    if (validationErrors.length) errors.push(`${name}: ${validationErrors.map((e) => e.message).join('; ')}`);

    const typeInfo = new TypeInfo(fullSchema);
    visit(
      doc,
      visitWithTypeInfo(typeInfo, {
        VariableDefinition() {
          addType(typeInfo.getInputType());
        },
        Field(node) {
          const parent = typeInfo.getParentType();
          const fieldDef = typeInfo.getFieldDef();
          if (!parent || !fieldDef || node.name.value === '__typename') return;
          addField(parent, node.name.value);
          addType(fieldDef.type);
          for (const arg of fieldDef.args) addType(arg.type);
        },
        InlineFragment() {
          addType(typeInfo.getType());
        },
        FragmentDefinition() {
          addType(typeInfo.getType());
        }
      })
    );
  }

// Interfaces pull in the fields of their implementations that were selected.
for (const typeName of [...usedTypes]) {
  const type = fullSchema.getType(typeName);
  if (type instanceof GraphQLObjectType) {
    for (const iface of type.getInterfaces()) {
      if (usedTypes.has(iface.name)) {
        for (const f of usedFields.get(iface.name) || []) addField(type, f);
      }
    }
  }
}

const describe = (desc, indent = '') =>
  desc
    ? `${indent}"""\n${desc
        .split('\n')
        .map((l) => indent + l)
        .join('\n')}\n${indent}"""\n`
    : '';
const printArgs = (args) =>
  args.length
    ? `(${args
        .map((a) => `${a.name}: ${a.type}${a.defaultValue !== undefined ? ` = ${JSON.stringify(a.defaultValue)}` : ''}`)
        .join(', ')})`
    : '';
const deprecated = (f) => (f.deprecationReason ? ` @deprecated(reason: ${JSON.stringify(f.deprecationReason)})` : '');

const typeOrder = (name) => {
  const i = ROOT_TYPES.indexOf(name);
  return i === -1 ? `9${name}` : `${i}`;
};

const sdlParts = [];
for (const name of [...usedTypes].sort((a, b) => typeOrder(a).localeCompare(typeOrder(b)))) {
  const type = fullSchema.getType(name);
  if (!type || name.startsWith('__')) continue;
  if (['String', 'Int', 'Float', 'Boolean', 'ID'].includes(name)) continue;
  let out = describe(type.description);
  if (type instanceof GraphQLScalarType) {
    out += `scalar ${name}`;
  } else if (type instanceof GraphQLEnumType) {
    out += `enum ${name} {\n${type
      .getValues()
      .map((v) => `${describe(v.description, '  ')}  ${v.name}${deprecated(v)}`)
      .join('\n')}\n}`;
  } else if (type instanceof GraphQLInputObjectType) {
    out += `input ${name} {\n${Object.values(type.getFields())
      .map(
        (f) =>
          `${describe(f.description, '  ')}  ${f.name}: ${f.type}${
            f.defaultValue !== undefined ? ` = ${JSON.stringify(f.defaultValue)}` : ''
          }`
      )
      .join('\n')}\n}`;
  } else if (type instanceof GraphQLUnionType) {
    const members = type.getTypes().filter((t) => usedTypes.has(t.name));
    if (!members.length) continue;
    out += `union ${name} = ${members.map((t) => t.name).join(' | ')}`;
  } else if (type instanceof GraphQLObjectType || type instanceof GraphQLInterfaceType) {
    const fields = usedFields.get(name);
    if (!fields || !fields.size) continue;
    const ifaces =
      type instanceof GraphQLObjectType ? type.getInterfaces().filter((i) => usedFields.get(i.name)?.size) : [];
    const keyword = type instanceof GraphQLObjectType ? 'type' : 'interface';
    out += `${keyword} ${name}${ifaces.length ? ` implements ${ifaces.map((i) => i.name).join(' & ')}` : ''} {\n`;
    out += Object.values(type.getFields())
      .filter((f) => fields.has(f.name))
      .map((f) => `${describe(f.description, '  ')}  ${f.name}${printArgs(f.args)}: ${f.type}${deprecated(f)}`)
      .join('\n');
    out += '\n}';
  }
  sdlParts.push(out);
}

const header = `# GENERATED by scripts/skemail-api-spec/generate.js — do not edit by hand.
#
# Minimal GraphQL schema a backend must implement for skemail-web: only the root fields,
# object fields, arguments and types that skemail-web's operations actually use.
# Derived from libs/skiff-graphql/src/completeSchema.graphql.
`;
const subsetSDL = `${header}\n${sdlParts.join('\n\n')}\n`;

// Self-check: every used operation must validate against the subset.
const subsetSchema = buildSchema(subsetSDL);
for (const [name, op] of usedOps) {
  for (const def of op.defs) {
    const validationErrors = validate(subsetSchema, docFor(def));
    if (validationErrors.length) errors.push(`[subset] ${name}: ${validationErrors.map((e) => e.message).join('; ')}`);
  }
}

// ---------------------------------------------------------------------------
// 4. Write outputs
// ---------------------------------------------------------------------------

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'schema.graphql'), subsetSDL);

// operations.graphql: every used operation + the fragments it needs, as sent on the wire.
const fragmentsUsed = new Set();
const opsText = usedOps.flatMap(([name, op]) =>
  op.defs.map((def, i) => {
    collectFragmentSpreads(def).forEach((f) => fragmentsUsed.add(f));
    return (
      (i > 0 ? `# Alternative definition of ${name} (also in libs/skiff-front-graphql/graphql)\n` : '') + print(def)
    );
  })
);
fs.writeFileSync(
  path.join(OUT_DIR, 'operations.graphql'),
  `# GENERATED by scripts/skemail-api-spec/generate.js — do not edit by hand.\n#\n` +
    `# Every operation skemail-web sends to the backend (client-only @client fields removed).\n\n` +
    [...opsText, ...[...fragmentsUsed].sort().map((f) => print(fragments.get(f).def))].join('\n\n') +
    '\n'
);

const rootFieldsOf = (def) => def.selectionSet.selections.filter((s) => s.kind === Kind.FIELD).map((s) => s.name.value);
const varsOf = (def) =>
  (def.variableDefinitions || []).map((v) => `\`${v.variable.name.value}: ${print(v.type)}\``).join(', ') || '—';
const domainOf = (file) => path.relative(OPERATIONS_DIR, file).replace(/\.graphql$/, '');

const byDomain = new Map();
for (const [name, op] of usedOps) {
  const domain = domainOf(op.file);
  if (!byDomain.has(domain)) byDomain.set(domain, []);
  byDomain.get(domain).push([name, op]);
}

let md = `<!-- GENERATED by scripts/skemail-api-spec/generate.js — do not edit by hand. -->\n\n`;
md += `# skemail-web operation catalog\n\n`;
md += `${usedOps.length} operations (${usedOps.filter(([, o]) => o.kind === 'query').length} queries, `;
md += `${usedOps.filter(([, o]) => o.kind === 'mutation').length} mutations) are sent by skemail-web. `;
md += `They are grouped by the \`.graphql\` file in \`libs/skiff-front-graphql/graphql/\` that defines them.\n\n`;
for (const [domain, ops] of [...byDomain.entries()].sort()) {
  md += `## ${domain}\n\n| Operation | Type | Root field(s) | Variables | Used in |\n|---|---|---|---|---|\n`;
  for (const [name, op] of ops.sort(([a], [b]) => a.localeCompare(b))) {
    const usedIn = op.usedIn.map(
      (f) => `\`${f.replace(/^skemail-web\/src\//, 'skemail-web/').replace(/^libs\//, '')}\``
    );
    const shown =
      usedIn.length > 3 ? `${usedIn.slice(0, 3).join('<br>')}<br>+${usedIn.length - 3} more` : usedIn.join('<br>');
    md += `| \`${name}\` | ${op.kind} | ${rootFieldsOf(op.def)
      .map((f) => `\`${f}\``)
      .join(', ')} | ${varsOf(op.def)} | ${shown} |\n`;
  }
  md += '\n';
}
md += `## Defined but not used by skemail-web\n\n`;
md += `These ${unusedOps.length} operations exist in \`libs/skiff-front-graphql\` but nothing reachable from skemail-web uses them `;
md += `(they serve Calendar, Pages/Drive or are dead code). A mail-only backend can skip them.\n\n`;
md += unusedOps
  .map(([n, o]) => `\`${n}\` (${o.kind})`)
  .sort()
  .join(', ');
md += '\n';
fs.writeFileSync(path.join(OUT_DIR, 'operations.md'), md);

const stats = {
  reachableFiles: reachable.size,
  operationsDefined: operations.size,
  operationsUsed: usedOps.length,
  queries: usedOps.filter(([, o]) => o.kind === 'query').length,
  mutations: usedOps.filter(([, o]) => o.kind === 'mutation').length,
  rootQueryFields: usedFields.get('Query')?.size ?? 0,
  rootMutationFields: usedFields.get('Mutation')?.size ?? 0,
  typesInSubset: sdlParts.length,
  typesInFullSchema: Object.keys(fullSchema.getTypeMap()).filter((n) => !n.startsWith('__')).length
};
fs.writeFileSync(path.join(OUT_DIR, 'stats.json'), JSON.stringify(stats, null, 2) + '\n');
console.log(stats);
if (process.env.DEBUG) console.log([...unresolvedSymbols].sort().join('\n'));
if (errors.length) {
  console.error(`\n${errors.length} validation error(s):\n${errors.join('\n')}`);
  process.exit(1);
}
