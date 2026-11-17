import { readFile, writeFile, mkdir } from 'node:fs/promises';
import openapiTS, { astToString } from 'openapi-typescript';
const source = new URL('../contracts/openapi.json', import.meta.url);
const spec = JSON.parse(await readFile(source, 'utf8'));
const types = astToString(await openapiTS(source));
// JSON Schema 2020-12 references; derived from the SAME OpenAPI components.
const definitions = JSON.parse(JSON.stringify(spec.components.schemas).replaceAll('#/components/schemas/', '#/$defs/'));
const schema = JSON.stringify({ $schema: 'https://json-schema.org/draft/2020-12/schema', $defs: definitions }, null, 2) + '\n';
const outputs = [['api.ts', types], ['schemas.json', schema]];
await mkdir(new URL('../src/api/generated/', import.meta.url), { recursive: true });
for (const [name, content] of outputs) {
 const target = new URL('../src/api/generated/' + name, import.meta.url);
 if (process.argv.includes('--check')) {
  if (await readFile(target, 'utf8') !== content) throw new Error('Generated contract drift: ' + name);
 } else await writeFile(target, content);
}
