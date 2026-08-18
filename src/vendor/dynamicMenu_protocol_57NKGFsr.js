function getTreeOptions(tree, path, level) {
  let node = tree;
  for (let i = 0; i < level; i++) {
    if (!node || Array.isArray(node)) return [];
    node = node[path[i]];
  }
  if (!node) return [];
  return Array.isArray(node) ? node : Object.keys(node);
}
function completeTreePath(tree, partialPath = []) {
  const requested = Array.isArray(partialPath) ? partialPath : [];
  const result = [];
  let node = tree;
  let level = 0;
  while (node) {
    const options = Array.isArray(node) ? node : Object.keys(node);
    if (!options.length) break;
    const requestedOption = requested[level];
    const option = options.includes(requestedOption) ? requestedOption : options[0];
    result.push(option);
    if (Array.isArray(node)) break;
    node = node[option];
    level++;
  }
  return result;
}
function treePathsEqual(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => value === b[index]);
}
function moveTreePath(tree, path, level, direction) {
  const completePath = completeTreePath(tree, path);
  const options = getTreeOptions(tree, completePath, level);
  const currentIndex = options.indexOf(completePath[level]);
  if (currentIndex < 0) return null;
  const offset = direction === "left" ? -1 : 1;
  const nextIndex = currentIndex + offset;
  if (nextIndex < 0 || nextIndex >= options.length) return null;
  return completeTreePath(tree, [...completePath.slice(0, level), options[nextIndex]]);
}
const PROTOCOL_VERSION = "1.0";
function parseProtocol(v) {
  if (v === void 0 || v === null || v === "") return null;
  const raw = String(v);
  const [major, minor = "0"] = raw.split(".");
  return { major, minor, raw };
}
function checkProtocol(theirVersion) {
  const mine = parseProtocol(PROTOCOL_VERSION);
  const theirs = parseProtocol(theirVersion);
  if (!theirs) {
    return {
      level: "unknown",
      message: `[DynamicMenu↔CanvasRenderer] incoming state has no protocol version; expected ${PROTOCOL_VERSION}. Assuming legacy/compatible, but the producer is likely older than this CanvasRenderer build.`
    };
  }
  if (theirs.major !== mine.major) {
    return {
      level: "major",
      message: `[DynamicMenu↔CanvasRenderer] incompatible protocol versions: DynamicMenu state=${theirs.raw}, CanvasRenderer=${PROTOCOL_VERSION}. The major version differs — the snapshot/event shape is not compatible. Use builds of DynamicMenu and CanvasRenderer that share the same major version.`
    };
  }
  if (theirs.raw !== mine.raw) {
    return {
      level: "minor",
      message: `[DynamicMenu↔CanvasRenderer] protocol minor mismatch: DynamicMenu state=${theirs.raw}, CanvasRenderer=${PROTOCOL_VERSION}. Backward-compatible, but you should align both builds.`
    };
  }
  return { level: "ok", message: "" };
}
export {
  PROTOCOL_VERSION as P,
  checkProtocol as a,
  completeTreePath as c,
  moveTreePath as m,
  treePathsEqual as t
};
//# sourceMappingURL=dynamicMenu_protocol_57NKGFsr.js.map
