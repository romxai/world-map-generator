/*
 * Terrain Generation Module
 * Creates realistic elevation models with continents, mountains, and landforms
 */

import { createSeededNoise2D, createRNG } from "./random";
import { type VoronoiMesh, type MapConfig, type NoiseData } from "./types";
import FlatQueue from "flatqueue";

/**
 * Precalculate noise at different scales for the entire map
 */
export function precalculateNoise(config: MapConfig): NoiseData {
  console.log("Precalculating noise for terrain generation");
  const { seed } = config;

  // Create our noise functions
  const noise2D = createSeededNoise2D(seed);
  const continentNoise = createSeededNoise2D(seed + "-continent");
  const ridgeNoise = createSeededNoise2D(seed + "-ridges");
  const moistureNoise = createSeededNoise2D(seed + "-moisture");
  const roughnessNoise = createSeededNoise2D(seed + "-roughness");

  // Create arrays for our noise data
  const elevation = new Float32Array(1024); // Will be sampled as needed
  const moisture = new Float32Array(1024);
  const waterNoise = new Float32Array(1024);
  const roughness = new Float32Array(1024);

  // Pre-calculate some noise values at different frequencies
  for (let i = 0; i < 1024; i++) {
    const nx = i / 1024;

    // Elevation noise - multi-octave
    elevation[i] =
      noise2D(nx * 1, 0.5) * 0.4 +
      noise2D(nx * 2, 0.5) * 0.2 +
      noise2D(nx * 4, 0.5) * 0.1 +
      noise2D(nx * 8, 0.5) * 0.05;

    // Moisture noise for climate
    moisture[i] =
      moistureNoise(nx * 1, 0.5) * 0.5 +
      moistureNoise(nx * 2, 0.5) * 0.3 +
      moistureNoise(nx * 4, 0.5) * 0.2;

    // Water noise for oceans and lakes
    waterNoise[i] =
      continentNoise(nx * 0.5, 0.5) * 0.6 +
      continentNoise(nx * 1, 0.5) * 0.3 +
      continentNoise(nx * 2, 0.5) * 0.1;

    // Roughness noise for terrain details
    roughness[i] =
      roughnessNoise(nx * 2, 0.5) * 0.5 +
      roughnessNoise(nx * 4, 0.5) * 0.3 +
      roughnessNoise(nx * 8, 0.5) * 0.2;
  }

  console.log("Noise precalculation complete");
  return {
    elevation,
    moisture,
    waterNoise,
    roughness,
  };
}

/**
 * Calculate distance from each triangle to nearest mountain peak
 * using breadth-first search
 */
export function calculateMountainDistance(
  mesh: VoronoiMesh,
  config: MapConfig
): {
  distances: Float32Array;
  peaks: number[];
} {
  console.log("Calculating mountain distance");
  const { numTriangles } = mesh;
  const distances = new Float32Array(numTriangles).fill(Infinity);
  const visited = new Uint8Array(numTriangles).fill(0);

  // Find triangles associated with mountain points
  // This would normally come from the point generation module
  const mountainTriangles: number[] = [];

  // Use noise to identify potential mountain peaks
  const mountainNoise = createSeededNoise2D(config.seed + "-mountains");
  const rng = createRNG(config.seed + "-mountain-selection");

  // Mountain peak selection
  for (let t = 0; t < numTriangles; t++) {
    if (mesh.is_boundary_t[t]) continue;

    const x = mesh.x_of_t(t);
    const y = mesh.y_of_t(t);

    // Normalize coordinates
    const nx = x / mesh.width;
    const ny = y / mesh.height;

    // Use noise to make mountain ranges
    const noiseValue =
      (mountainNoise(nx * 2, ny * 2) * 0.5 + 0.5) *
      (mountainNoise(nx * 4, ny * 4) * 0.5 + 0.5);

    // Mountains tend to form in clusters
    if (noiseValue > 0.7 && rng() < config.mountainFrequency * 0.1) {
      mountainTriangles.push(t);
    }
  }

  console.log(`Selected ${mountainTriangles.length} mountain peaks`);

  // Use a priority queue to find shortest paths
  const queue = new FlatQueue();

  // Start with mountain triangles at distance 0
  for (const t of mountainTriangles) {
    distances[t] = 0;
    queue.push(t, 0);
  }

  // Breadth-first search to find distances
  while (queue.length > 0) {
    const currentT = queue.pop();

    if (visited[currentT]) continue;
    visited[currentT] = 1;

    // Check all neighbors
    for (const neighbor of mesh.neighbors[currentT]) {
      if (neighbor === -1 || visited[neighbor]) continue;

      // Calculate distance between triangle centers
      const p1 = mesh.t_center(currentT);
      const p2 = mesh.t_center(neighbor);
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const edgeLength = Math.sqrt(dx * dx + dy * dy);

      // Add randomness to distance based on mountain jaggedness
      const noise = (Math.random() - 0.5) * config.jaggedness * 0.2;
      const distWithNoise = edgeLength * (1 + noise);

      // Calculate new distance
      const newDist = distances[currentT] + distWithNoise;

      // Update if this path is shorter
      if (newDist < distances[neighbor]) {
        distances[neighbor] = newDist;
        queue.push(neighbor, newDist);
      }
    }
  }

  // Normalize distances to 0-1 range
  let maxDist = 0;
  for (let t = 0; t < numTriangles; t++) {
    if (distances[t] < Infinity) {
      maxDist = Math.max(maxDist, distances[t]);
    }
  }

  if (maxDist > 0) {
    for (let t = 0; t < numTriangles; t++) {
      if (distances[t] < Infinity) {
        distances[t] /= maxDist;
      } else {
        distances[t] = 1.0; // Default for unreachable triangles
      }
    }
  }

  console.log(
    `Mountain distance calculation complete, max distance: ${maxDist.toFixed(
      2
    )}`
  );
  return {
    distances,
    peaks: mountainTriangles,
  };
}

/**
 * Generate continent mask using noise and distance fields
 */
export function generateContinentMask(
  mesh: VoronoiMesh,
  config: MapConfig,
  noiseData: NoiseData
): Float32Array {
  console.log("Generating continent mask");
  const { width, height } = mesh;
  const { numTriangles } = mesh;
  const { seed, islandFrequency, oceanRatio } = config;

  const noise2D = createSeededNoise2D(seed + "-continents");
  const rng = createRNG(seed + "-continentpos");

  const mask = new Float32Array(numTriangles);

  // Create continent centers (1-3 based on map size)
  const numContinents = Math.max(
    1,
    Math.min(3, Math.floor(Math.sqrt(width * height) / 300))
  );
  const continents: Array<{ x: number; y: number; size: number }> = [];

  for (let i = 0; i < numContinents; i++) {
    // Place continents somewhat away from edges
    const margin = 0.15;
    const x = margin + rng() * (1 - margin * 2);
    const y = margin + rng() * (1 - margin * 2);

    // Varying continent sizes
    const size = 0.5 + rng() * 0.5;

    continents.push({ x, y, size });
  }

  // Add some smaller islands
  const numIslands = Math.floor(islandFrequency * 10);
  for (let i = 0; i < numIslands; i++) {
    const x = rng();
    const y = rng();
    const size = 0.1 + rng() * 0.2; // Islands are smaller

    continents.push({ x, y, size });
  }

  // Create the continent mask
  for (let t = 0; t < numTriangles; t++) {
    // Skip boundary triangles
    if (mesh.is_boundary_t[t]) {
      mask[t] = 0;
      continue;
    }

    // Get the triangle center
    const p = mesh.t_center(t);

    // Normalized coordinates
    const nx = p.x / width;
    const ny = p.y / height;

    // Distance to nearest continent/island center
    let minDist = Infinity;
    for (const { x: cx, y: cy, size } of continents) {
      // Elliptical distance with randomized stretching
      const stretch = 1 + 0.5 * noise2D(cx, cy);
      const dx = (nx - cx) * stretch;
      const dy = (ny - cy) / stretch;

      const dist = Math.sqrt(dx * dx + dy * dy) / size;
      minDist = Math.min(minDist, dist);
    }

    // Continent edge noise (makes coastlines irregular)
    const edgeNoise =
      noise2D(nx * 2, ny * 2) * 0.04 +
      noise2D(nx * 4, ny * 4) * 0.02 +
      noise2D(nx * 8, ny * 8) * 0.01;

    // Continent falloff function (1 at center, 0 outside)
    let value = 1 - minDist + edgeNoise;

    // Sharpen the transition with an exponential falloff
    value = Math.pow(Math.max(0, value), 1.5);

    // Apply ocean ratio - higher values mean more ocean
    value = value > oceanRatio ? value : 0;

    // Store the continent mask value
    mask[t] = value;
  }

  console.log(
    `Generated continent mask with ${numContinents} continents and ${numIslands} islands`
  );
  return mask;
}

/**
 * Generate elevation for each triangle using noise, mountain distance, and continent mask
 */
export function generateElevation(
  mesh: VoronoiMesh,
  continentMask: Float32Array,
  mountainDistance: Float32Array,
  noiseData: NoiseData,
  config: MapConfig
): Float32Array {
  console.log("Generating elevation model");
  const { numTriangles } = mesh;
  const { width, height } = mesh;
  const { mountainHeight, seaLevel } = config;

  const elevation_t = new Float32Array(numTriangles);

  // Min/max trackers for normalization
  let minElevation = Infinity;
  let maxElevation = -Infinity;

  for (let t = 0; t < numTriangles; t++) {
    // Skip boundary triangles
    if (mesh.is_boundary_t[t]) {
      elevation_t[t] = 0;
      continue;
    }

    // Get normalized coordinates
    const p = mesh.t_center(t);
    const nx = p.x / width;
    const ny = p.y / height;

    // Sample our noise at different frequencies
    const noiseIndex = Math.floor(nx * 1024) % 1024;
    const terrainNoise = noiseData.elevation[noiseIndex];
    const waterValue = noiseData.waterNoise[noiseIndex];
    const roughnessValue = noiseData.roughness[noiseIndex];

    // Calculate mountain contribution
    const mountainDist = mountainDistance[t];
    const mountainValue = 1 - mountainDist;

    // Mountains have higher elevation
    const mountainContribution = Math.pow(mountainValue, 2) * mountainHeight;

    // Combine continent mask, mountain influence, and noise
    let elevation =
      continentMask[t] * 0.6 + // Continent shape
      mountainContribution * 0.5 + // Mountain height
      terrainNoise * roughnessValue * 0.3; // Terrain details with varying roughness

    // Apply water factor (large-scale noise that determines oceans vs land)
    if (waterValue < 0.3) {
      // Deep ocean where water factor is very low
      elevation *= waterValue * 3;
    }

    // Track min/max for normalization
    minElevation = Math.min(minElevation, elevation);
    maxElevation = Math.max(maxElevation, elevation);

    elevation_t[t] = elevation;
  }

  // Normalize elevation to 0-1 range
  const range = maxElevation - minElevation;
  if (range > 0) {
    for (let t = 0; t < numTriangles; t++) {
      elevation_t[t] = (elevation_t[t] - minElevation) / range;
    }
  }

  console.log(
    `Elevation generation complete, range: ${minElevation.toFixed(
      2
    )} to ${maxElevation.toFixed(2)}`
  );

  return elevation_t;
}

/**
 * Rasterize triangle-based elevations to a 2D grid
 */
export function rasterizeElevation(
  mesh: VoronoiMesh,
  elevation_t: Float32Array,
  width: number,
  height: number
): number[][] {
  console.log(`Rasterizing elevation to ${width}x${height} grid`);
  const grid: number[][] = Array(height)
    .fill(0)
    .map(() => Array(width).fill(0));

  // Spatial lookup acceleration - divide the space into cells
  const cellSize = 20; // Size of each spatial hash cell
  const gridWidth = Math.ceil(width / cellSize);
  const gridHeight = Math.ceil(height / cellSize);

  // Create spatial hash
  const spatialHash: number[][][] = Array(gridHeight)
    .fill(0)
    .map(() =>
      Array(gridWidth)
        .fill(0)
        .map(() => [])
    );

  // Insert triangles into spatial hash
  for (let t = 0; t < mesh.numTriangles; t++) {
    const cx = Math.floor(mesh.x_of_t(t) / cellSize);
    const cy = Math.floor(mesh.y_of_t(t) / cellSize);

    if (cx >= 0 && cx < gridWidth && cy >= 0 && cy < gridHeight) {
      spatialHash[cy][cx].push(t);
    }
  }

  // For each pixel, find the closest triangle center
  for (let y = 0; y < height; y++) {
    const cy = Math.floor(y / cellSize);

    for (let x = 0; x < width; x++) {
      const cx = Math.floor(x / cellSize);

      let minDist = Infinity;
      let closestT = 0;

      // Search in current cell and neighboring cells
      for (
        let ny = Math.max(0, cy - 1);
        ny <= Math.min(gridHeight - 1, cy + 1);
        ny++
      ) {
        for (
          let nx = Math.max(0, cx - 1);
          nx <= Math.min(gridWidth - 1, cx + 1);
          nx++
        ) {
          // Check all triangles in this cell
          for (const t of spatialHash[ny][nx]) {
            const tx = mesh.x_of_t(t);
            const ty = mesh.y_of_t(t);
            const dx = tx - x;
            const dy = ty - y;
            const distSquared = dx * dx + dy * dy;

            if (distSquared < minDist) {
              minDist = distSquared;
              closestT = t;
            }
          }
        }
      }

      // Assign elevation from closest triangle
      grid[y][x] = elevation_t[closestT];
    }
  }

  return grid;
}
