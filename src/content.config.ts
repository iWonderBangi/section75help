import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const baseSchema = z.object({
  title: z.string(),
  description: z.string(),
  publishedAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  category: z.string(),
  disclaimer: z.literal(true),
});

const guide = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/guide' }),
  schema: baseSchema,
});

const trigger = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/trigger' }),
  schema: baseSchema.extend({
    companyName: z.string(),
    administrationDate: z.coerce.date().optional(),
  }),
});

const category = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/category' }),
  schema: baseSchema,
});

export const collections = { guide, trigger, category };
