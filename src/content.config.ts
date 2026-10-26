// Astro 6+ traži TOČNO ovu putanju: src/content.config.ts
// (stari src/content/config.ts od v6 baca LegacyContentConfigError)
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

import { shemaRada } from './core/shema.mjs';

const radovi = defineCollection({
  // `loader` je od v6 OBAVEZAN — kolekcije bez njega više ne postoje.
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/radovi',
  }),
  // Funkcijski oblik sheme je i dalje podržan i jedini daje `image()`.
  // Slike MORAJU biti unutar src/ — da `image()` vidi datoteke izvan src/
  // nije potvrđeno u dokumentaciji, pa to ne riskiramo.
  schema: ({ image }) => shemaRada({ z, image }),
});

export const collections = { radovi };
