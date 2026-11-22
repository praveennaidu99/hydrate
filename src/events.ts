// Tiny event bus so screens refresh when data changes elsewhere (e.g. a notification button).
type Listener = () => void;
const listeners = new Set<Listener>();

export function onDataChanged(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitDataChanged() {
  listeners.forEach((fn) => fn());
}
