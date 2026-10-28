import { executionWorker } from './execution.js';
const [directory,id]=process.argv.slice(2);
await executionWorker(directory!,id!);
