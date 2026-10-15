export { safeTarget } from './paths.js';
export { commit } from '../recovery/files.js';
export interface Change { name: string; path: string; raw: Buffer | null; desired: Buffer | null }
