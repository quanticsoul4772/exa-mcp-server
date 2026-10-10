// Regenerates docs/TOOL_REFERENCE.md from the built tool schemas.
// Usage: npm run build && node scripts/gen-tool-reference.mjs
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
process.env.EXA_API_KEY = process.env.EXA_API_KEY || 'doc-generation';
const { version } = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf-8'));
const { toolRegistry, toolAliases } = await import(pathToFileURL(join(repo, 'build/tools/index.js')).href);

function describeType(schema) {
  let s = schema;
  let optional = false;
  let defaultValue;
  for (;;) {
    const t = s._def.typeName;
    if (t === 'ZodOptional') { optional = true; s = s._def.innerType; continue; }
    if (t === 'ZodDefault') { optional = true; defaultValue = s._def.defaultValue(); s = s._def.innerType; continue; }
    break;
  }
  const t = s._def.typeName;
  const enumList = values => values.map(v => `\`${v}\``).join(' \\| ');
  let type;
  if (t === 'ZodString') type = 'string';
  else if (t === 'ZodNumber') type = 'number';
  else if (t === 'ZodBoolean') type = 'boolean';
  else if (t === 'ZodEnum') type = enumList(s._def.values);
  else if (t === 'ZodArray') {
    const inner = s._def.type._def.typeName;
    type = inner === 'ZodEnum' ? `array of ${enumList(s._def.type._def.values)}`
      : inner === 'ZodObject' ? 'array of objects' : `array of ${inner.replace('Zod', '').toLowerCase()}`;
  }
  else if (t === 'ZodRecord') type = 'object (JSON Schema)';
  else if (t === 'ZodUnion') type = s._def.options.map(o => o._def.typeName === 'ZodLiteral' ? `\`${o._def.value}\`` : o._def.typeName.replace('Zod', '').toLowerCase()).join(' \\| ');
  else type = t.replace('Zod', '').toLowerCase();
  return { type, optional, defaultValue, description: schema.description || s.description || '' };
}

const tools = Object.values(toolRegistry);
const lines = [
  '# Tool Reference',
  '',
  `Generated from the tool schemas in \`src/tools/\` (version ${version}) by \`scripts/gen-tool-reference.mjs\`. Every tool response ends with the estimated cost when Exa reports one.`,
  '',
  '## Contents',
  '',
  ...tools.map(t => `- [\`${t.name}\`](#${t.name})${t.enabled ? '' : ' (off by default)'}`),
  '- [Removed tool names](#removed-tool-names)',
  ''
];

for (const tool of tools) {
  const hints = Object.entries(tool.annotations).map(([k, v]) => `${k.replace('Hint', '')}: ${v}`).join(', ');
  lines.push(`## ${tool.name}`, '', `**${tool.title}**`, '', tool.description, '', `On by default: ${tool.enabled ? 'yes' : 'no'}. Hints: ${hints}.`, '');
  lines.push('| Parameter | Type | Required | Default | Description |', '|---|---|---|---|---|');
  for (const [name, field] of Object.entries(tool.schema.shape)) {
    const d = describeType(field);
    const def = d.defaultValue === undefined ? '' : `\`${JSON.stringify(d.defaultValue)}\``;
    lines.push(`| \`${name}\` | ${d.type} | ${d.optional ? 'no' : 'yes'} | ${def} | ${d.description.replace(/\|/g, '\\|')} |`);
  }
  lines.push('');
}

lines.push('## Removed tool names', '', 'These names were removed in 0.5.0. Passing them to `--tools` enables the replacement and logs a warning.', '', '| Removed | Replacement |', '|---|---|');
Object.entries(toolAliases).forEach(([from, to]) => lines.push(`| \`${from}\` | \`${to}\` |`));
lines.push('');
writeFileSync(join(repo, 'docs/TOOL_REFERENCE.md'), lines.join('\n'));
console.error(`wrote docs/TOOL_REFERENCE.md: ${tools.length} tools, version ${version}`);
process.exit(0);
