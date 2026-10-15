# Frozen Python implementation

**English** | [简体中文](README.zh-CN.md)

This archive preserves Python source, tests, build configuration, historical
comparison tools and former publication workflows. `manifest.json` records each
original path, SHA-256 and the immutable pre-archive commit. All 318 Python files
match the TS-05 responsibility snapshot. Normal generators never update them.

From the repository root, use `npm run archive:check` for byte integrity and
`npm run reference:verify -- --python /absolute/python-3.14.4 --report /absolute/new.json`
for independent historical execution. The latter needs wcwidth 0.9.1 and pyte
0.8.2, reconstructs original paths in a temporary checkout, and leaves the
installed product untouched. Do not execute archived tools in place: their
original relative paths deliberately remain unchanged.

Python wheel/PyPI publishing is historical; TS-05 produces private engineering
candidates. Public TS versions, tags and Releases belong to TS-06. D06's failed
measurements remain historical evidence; PERF-01 follows TS-06.
