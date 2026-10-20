// Narrow Next 16.2.7 queue correction. Transform build input only; never write
// node_modules (which can be shared). An upgrade MUST review/remove this patch.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Webpack executes loaders as CommonJS.
const { createHash } = require('node:crypto');
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Review the exact framework version before transforming build input.
const { version } = require('next/package.json');
if (version !== '16.2.7') throw new Error('Review/remove the 12.55C queue correction before changing Next versions.');
const reviewedHashes = new Set([
  '3143533797e0339ffc9f7d70772f3b6fd04e7268a7d396788b4641a47d482570',
  '34eee1e7ca47d2980794df475c2068e909b19adf19fbc41ebc712f5a507276d8',
]);

module.exports = function nextNavigationOwnership(source) {
  let result = source.toString().replaceAll('\r\n', '\n');
  if (!reviewedHashes.has(createHash('sha256').update(result).digest('hex'))) {
    throw new Error('Unreviewed Next navigation queue source. Review/remove the 12.55C ownership correction before building.');
  }
  const replaceOnce = (before, after) => {
    if (result.split(before).length !== 2) throw new Error('Next queue ownership correction does not match exactly once.');
    result = result.replace(before, after);
  };
  // A discarded completion cannot advance a DIFFERENT live queue node. It can
  // still request revalidation; flush that only if the queue is genuinely idle.
  replaceOnce('if (action.discarded) {', 'if (action.discarded || actionQueue.pending !== action) {');
  replaceOnce('            runRemainingActions(actionQueue, setState);\n            return;',
    '            if (actionQueue.pending === null) runRemainingActions(actionQueue, setState);\n            return;');
  // Rejected superseded work cannot advance the current navigation either.
  replaceOnce('            runRemainingActions(actionQueue, setState);\n            action.reject(err);',
    '            if (actionQueue.pending === action) runRemainingActions(actionQueue, setState);\n            action.reject(err);');
  // When a navigation replaces a queue with no waiting tail, it owns the tail.
  // Subsequent server actions must not be attached to the discarded old node.
  replaceOnce('        newAction.next = actionQueue.pending.next;',
    '        newAction.next = actionQueue.pending.next;\n        if (newAction.next === null) actionQueue.last = newAction;');
  // Preserve the discarded server-action revalidation contract when the final
  // current node empties the queue, without advancing a live node prematurely.
  replaceOnce('            });\n        }\n    } else {\n        // Check for refresh when pending is already null',
    '            });\n            return;\n        }\n    }\n    {\n        // Check for refresh when pending is already null');
  return result;
};
