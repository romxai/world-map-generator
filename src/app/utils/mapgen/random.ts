/*
 * Random number generation utilities
 * Based on reference implementation from RedBlobGames
 */

import { createNoise2D } from "simplex-noise";

/**
 * Generate a deterministic numeric hash from a string
 */
export function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0; // Convert to 32-bit integer
  }
  return hash;
}

/**
 * Create a deterministic random number generator from a seed
 */
export function createRNG(seed: string): () => number {
  let state = hashSeed(seed);

  return function () {
    // Xorshift algorithm - simple but effective for non-cryptographic use
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;

    // Convert to float in [0, 1) range
    return ((state >>> 0) % 2147483647) / 2147483647;
  };
}

/**
 * Create a seeded simplex noise generator
 * This is a wrapper around createNoise2D that provides our own RNG
 */
export function createSeededNoise2D(
  seed: string
): (x: number, y: number) => number {
  const rng = createRNG(seed);

  // We need a custom random function for the noise
  const customRandom = () => rng();

  // Create the noise function with our custom random
  const noise2D = createNoise2D(customRandom);

  // Return the noise function
  return noise2D;
}
