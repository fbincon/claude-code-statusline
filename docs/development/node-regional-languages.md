<a id="node-runtime-and-regional-language-follow-up"></a>

# Node runtime and regional language support

**English** | [简体中文](node-regional-languages.zh-CN.md)

The product supports stable Node `^22.0.0 || ^24.0.0` and the ordered language selectors `en`, `zh-CN`, `zh-TW`, `zh-HK`, `ja`, `ko`, `es`, `fr`, `de`, `pt-BR`, `ru` and `id`, including complete Taiwan and Hong Kong packs. Original migration and release evidence is in the [delivery record](history/deliveries/node-regional-languages.md#node-runtime-and-regional-language-follow-up).

## Runtime contract

The product accepts stable Node `^22.0.0 || ^24.0.0`. Development, resource generation and reproducible builds retain Node 24.21.0/npm 11.19.0. `packages/core/src/node-runtime.ts` is shared by package generation, verification, diagnostics and runtime receipt checks. No other Node series or additional OS/architecture is declared supported.

The current acceptance matrix covers eight installations, 32 Node cases and sixteen fixed hosts; [testing and acceptance](testing.md#current-typescript-checks) owns the current counts. The 32-case matrix tests each installed target with 22.0.0, latest 22.x, 24.0.0 and latest 24.x against the identical package. Each receipt records the source commit, package SHA-256, actual Node version/hash, product tests and isolated offline installation. Release readiness rejects missing, duplicate, wrong-runtime or failed evidence. Bootstrap with the fixed toolchain, then run `npm run test:runtime` under the selected Node without rebuilding. Module-import tracing uses asynchronous loader hooks with an explicit flush handshake, including on Node 22.0.0.

Windows Node 24.0.0/libuv 1.50 also reports a zero device ID in path stats while descriptor stats retain the actual volume serial; the [isolated Windows diagnostic](https://github.com/fbincon/claude-code-statusline/actions/runs/39117485659) reproduces this on both Windows targets. Recovery obtains the Windows volume and file index from a native no-follow handle, checks that the index still matches the preceding path snapshot, and compares that identity with the opened descriptor. BigInt IDs avoid rounding; Windows serials use 32 bits and POSIX device IDs retain all bits. Regular-file/reparse/permission guards remain, and regressions reject different files and path replacement. The native structure follows [Microsoft's documented layout](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/ns-fileapi-by_handle_file_information).

## Regional language contract

Selectors contain `en`, `zh-CN`, `zh-TW`, `zh-HK`, `ja`, `ko`, `es`, `fr`, `de`, `pt-BR`, `ru` and `id`, in that order. `zh-Hant` is an input-only compatibility alias for Taiwan. Reads normalize without rewriting; explicit saves and exports emit canonical codes. Unknown inputs remain invalid. Taiwan and Hong Kong have complete independent packs, regional terminology, shared generation, multilingual search and independent UI/output selection. [Translation conventions](i18n.md).

The frozen migration capture adapts historical protocol-11 requests in memory. Comparison permits only the known protocol fields, exact unsupported-version text and two language-choice lists to change; unrelated behavior and the three original CLI wording exemptions remain checked.

The full [delivery record](history/deliveries/node-regional-languages.md#node-runtime-and-regional-language-follow-up) is in the development history. The links below open its moved sections.

- <a id="validation-and-delivery"></a>[Validation and delivery](history/deliveries/node-regional-languages.md#validation-and-delivery)
- <a id="immutable-release-identity"></a>[Immutable release identity](history/deliveries/node-regional-languages.md#immutable-release-identity)
- <a id="ci-and-publication"></a>[CI and publication](history/deliveries/node-regional-languages.md#ci-and-publication)
- <a id="public-channels-and-captures"></a>[Public channels and captures](history/deliveries/node-regional-languages.md#public-channels-and-captures)
