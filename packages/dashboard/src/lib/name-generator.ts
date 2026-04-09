/**
 * Generate human-readable names from IDs, similar to Claude's plan file naming.
 * Same ID always produces the same name (deterministic).
 */

const ADJECTIVES = [
  'amber', 'azure', 'bold', 'bright', 'calm', 'clear', 'coral', 'crisp',
  'dawn', 'deep', 'dusk', 'eager', 'fair', 'fleet', 'fresh', 'gentle',
  'golden', 'grand', 'green', 'hazy', 'hidden', 'hushed', 'ivory', 'keen',
  'light', 'lively', 'lunar', 'marble', 'mellow', 'misty', 'noble', 'opal',
  'pale', 'pearl', 'plum', 'polar', 'prime', 'quiet', 'rapid', 'rare',
  'regal', 'ruby', 'rustic', 'sage', 'scarlet', 'serene', 'sharp', 'silent',
  'silver', 'sleek', 'slim', 'smooth', 'snowy', 'solar', 'sonic', 'steady',
  'stellar', 'stone', 'storm', 'subtle', 'summit', 'swift', 'tidal', 'urban',
  'velvet', 'vivid', 'warm', 'wild', 'winding', 'winter', 'wise', 'zen',
];

const NOUNS = [
  'arch', 'atlas', 'aurora', 'basin', 'beacon', 'bloom', 'bridge', 'brook',
  'canyon', 'cedar', 'cipher', 'cliff', 'cloud', 'coast', 'comet', 'coral',
  'crest', 'crystal', 'delta', 'drift', 'dune', 'echo', 'ember', 'falcon',
  'fern', 'fjord', 'flame', 'flint', 'forge', 'frost', 'garden', 'glacier',
  'grove', 'harbor', 'hawk', 'haven', 'helix', 'heron', 'hollow', 'horizon',
  'island', 'jade', 'lagoon', 'lark', 'lotus', 'maple', 'marsh', 'meadow',
  'mesa', 'mist', 'nexus', 'north', 'oak', 'oasis', 'orbit', 'orchid',
  'pass', 'peak', 'pine', 'pixel', 'plain', 'pond', 'prism', 'pulse',
  'quartz', 'rain', 'reef', 'ridge', 'river', 'sage', 'shore', 'sierra',
  'spark', 'spring', 'star', 'stone', 'stream', 'summit', 'tide', 'trail',
  'vale', 'vista', 'wave', 'willow', 'wind', 'zenith',
];

const VERBS = [
  'bloom', 'bound', 'climb', 'coast', 'craft', 'cross', 'dance', 'dash',
  'drift', 'drive', 'float', 'flow', 'forge', 'glide', 'glow', 'hike',
  'hover', 'leap', 'march', 'orbit', 'pace', 'quest', 'reach', 'ride',
  'roam', 'sail', 'scout', 'seek', 'shift', 'shine', 'soar', 'spark',
  'spin', 'sprint', 'steer', 'stir', 'surge', 'sweep', 'swing', 'trace',
  'trail', 'trek', 'vault', 'wade', 'wander', 'weave', 'whirl', 'zoom',
];

/**
 * Simple hash function for a string → number.
 * Uses FNV-1a hash for good distribution.
 */
function hashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash;
}

/**
 * Generate a human-readable name from an ID string.
 * Pattern: adjective-noun-verb (e.g., "golden-harbor-drift")
 * Same ID always produces the same name.
 */
export function generateName(id: string): string {
  const hash = hashString(id);
  const adj = ADJECTIVES[hash % ADJECTIVES.length]!;
  const noun = NOUNS[(hash >>> 8) % NOUNS.length]!;
  const verb = VERBS[(hash >>> 16) % VERBS.length]!;
  return `${adj}-${noun}-${verb}`;
}

/**
 * Cache of generated names to avoid recomputing.
 */
const nameCache = new Map<string, string>();

/**
 * Get a cached human-readable name for an ID.
 */
export function getDisplayName(id: string): string {
  let name = nameCache.get(id);
  if (!name) {
    name = generateName(id);
    nameCache.set(id, name);
  }
  return name;
}
