/** Static production imports override a file's directory label, including const-enum/type inputs. */
import { posix } from 'node:path';
import ts from 'typescript';
import { productPath, tree } from './impact-content.ts';

const cache = new Map<string, ReadonlyMap<string, string>>();
export function productionOwners(revision: string): ReadonlyMap<string, string> {
    const cached = cache.get(revision); if (cached) return cached;
    const entries = tree(revision), owners = new Map<string, string>(), seen = new Set<string>();
    const code = (path: string) => /\.[cm]?[jt]sx?$/u.test(path);
    const pending = [...entries.keys()].filter(path => productPath(path) && code(path));
    while (pending.length) {
        const path = pending.pop()!; if (seen.has(path)) continue; seen.add(path);
        const source = ts.createSourceFile(path, entries.get(path)!.bytes().toString('utf8'), ts.ScriptTarget.ESNext, true);
        const names: string[] = [];
        const visit = (node: ts.Node) => {
            if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) names.push(node.moduleSpecifier.text);
            if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteralLike(node.argument.literal)) names.push(node.argument.literal.text);
            if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === 'require') && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) names.push(node.arguments[0].text);
            ts.forEachChild(node, visit);
        };
        visit(source);
        for (const name of names) {
            const workspace = name.match(/^@fbincon\/statusline-(core|platform|cli|tui)\/(.+)$/u);
            const relative = name.startsWith('.') ? posix.normalize(posix.join(posix.dirname(path), name)) : workspace ? `packages/${workspace[1]}/src/${workspace[2]}` : null;
            if (!relative) continue;
            const target = [relative.replace(/\.js$/u, '.ts'), relative.replace(/\.jsx$/u, '.tsx'), relative, relative + '.ts', relative + '/index.ts', relative + '.json'].find(candidate => entries.has(candidate));
            if (!target) continue;
            if (!productPath(target) && !owners.has(target)) owners.set(target, path);
            if (code(target)) pending.push(target);
        }
    }
    cache.set(revision, owners); return owners;
}
