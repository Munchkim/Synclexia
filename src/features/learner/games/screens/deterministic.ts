export function deterministicPick<T>(pool: T[], roundIndex: number, count: number): T[] {
  if (!pool.length || count <= 0) return [];
  const start = ((roundIndex - 1) * count) % pool.length;
  const out: T[] = [];
  for (let i = 0; i < count; i++) out.push(pool[(start + i) % pool.length]);
  return out;
}

export function hashToIndex(key: string, mod: number) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % Math.max(1, mod);
}

export function placeCorrect(choices: string[], correct: string, key: string) {
  const n = choices.length;
  const pos = hashToIndex(key, n);
  const others = choices.filter(c => c !== correct);
  const arranged = new Array<string>(n);
  arranged[pos] = correct;
  let j = 0;
  for (let i = 0; i < n; i++) if (!arranged[i]) arranged[i] = others[j++];
  return { arranged, pos };
}
