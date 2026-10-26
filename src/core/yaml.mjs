import matter from 'gray-matter';

function pripremiZaYaml(vrijednost) {
  if (vrijednost instanceof Date) return vrijednost.toISOString().slice(0, 10);
  if (Array.isArray(vrijednost)) return vrijednost.map(pripremiZaYaml);
  if (vrijednost && typeof vrijednost === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(vrijednost)) {
      if (v === undefined || v === null || v === '') continue;
      out[k] = pripremiZaYaml(v);
    }
    return out;
  }
  return vrijednost;
}

export function serijaliziraj(podaci, tijelo) {
  return matter.stringify(`\n${String(tijelo ?? '').trim()}\n`, pripremiZaYaml(podaci), {
    lineWidth: -1,   // bez prelamanja — prelomljeni hrvatski naslovi se teško čitaju u diffu
    noRefs: true,
  });
}
