import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { repoRoot } from './common.js';
/** Compile original pure Mod libraries into an isolated test tree; never edit installed bindings. */
export function compileModLibraries(root: string): void {
    for (const name of ['statusline-native', 'statusline-runtime']) {
        const source = join(repoRoot, 'mods', name, 'lib'), target = join(root, name, 'lib');
        for (const path of readdirSync(source, { recursive: true }).map(String).filter(path => path.endsWith('.ts') && !path.endsWith('.d.ts'))) {
            const input = readFileSync(join(source, path), 'utf8');
            if (/from\s+['"]node:|require\s*\(/u.test(input))
                throw new Error('Pure Mod library acquired a Node dependency: ' + path);
            const output = ts.transpileModule(input, { fileName: path, compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ES2022, rewriteRelativeImportExtensions: true } });
            const destination = join(target, path.replace(/\.ts$/u, '.js'));
            mkdirSync(dirname(destination), { recursive: true });
            writeFileSync(destination, output.outputText);
        }
    }
    writeFileSync(join(root, 'package.json'), '{"type":"module"}\n');
}
export async function modLibraries(root: string) {
    compileModLibraries(root);
    return {
        native: await import(pathToFileURL(join(root, 'statusline-native/lib/backend.js')).href),
        runtime: await import(pathToFileURL(join(root, 'statusline-runtime/lib/queue.js')).href),
    };
}
