import { parentPort, workerData } from 'node:worker_threads';
import { scanDirectory } from './scanner.ts';
const flag = new Int32Array(workerData.flag);
scanDirectory(workerData.path, {
  cancelled: () => Atomics.load(flag, 0) === 1,
  progress: data => parentPort!.postMessage({ type: 'progress', data })
}).then(data => parentPort!.postMessage({ type: 'done', data }))
  .catch(error => parentPort!.postMessage({ type: 'error', message: error.message }));
