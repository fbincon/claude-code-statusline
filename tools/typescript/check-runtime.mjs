if (process.versions.node !== '24.21.0') {
  throw new Error(`Development and acceptance require Node 24.21.0; got ${process.versions.node}. Use the locked runtime in tools/migration/ts-02/runtime-lock.json.`);
}
