export function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seededNumber(seed: string): number {
  const hash = hashSeed(seed);
  return (hash % 10000) / 10000;
}

export function seededPick<T>(items: T[], seed: string): T {
  if (items.length === 0) {
    throw new Error("seededPick needs at least one item");
  }

  const index = Math.floor(seededNumber(seed) * items.length) % items.length;
  return items[index];
}

export function seededMany<T>(items: T[], seed: string, count: number): T[] {
  const pool = [...items];
  const selected: T[] = [];

  for (let index = 0; index < count && pool.length > 0; index += 1) {
    const pickIndex = Math.floor(seededNumber(`${seed}:${index}`) * pool.length) % pool.length;
    selected.push(pool.splice(pickIndex, 1)[0]);
  }

  return selected;
}

export function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}
