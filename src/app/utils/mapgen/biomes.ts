/*
 * Biome assignment module
 * Determines biome types based on elevation, moisture, and temperature
 */

import { type VoronoiMesh, BiomeType } from "./types";

/**
 * Assign biomes to triangles based on elevation, moisture, and temperature
 */
export function assignBiomes(
  mesh: VoronoiMesh,
  elevation_t: Float32Array,
  moisture_t: Float32Array,
  temperature_t: Float32Array,
  seaLevel: number
): number[] {
  console.log("Assigning biomes based on elevation, moisture, and temperature");

  const { numTriangles } = mesh;
  const biomes_t = new Array(numTriangles).fill(BiomeType.OCEAN);

  // Track biome distribution for debugging
  const biomeDistribution: Record<number, number> = {};
  Object.values(BiomeType).forEach((biome) => {
    if (typeof biome === "number") biomeDistribution[biome] = 0;
  });

  try {
    for (let t = 0; t < numTriangles; t++) {
      const elevation = elevation_t[t];
      const moisture = moisture_t[t];
      const temperature = temperature_t[t];

      // Skip boundary triangles
      if (mesh.is_boundary_t[t]) {
        biomes_t[t] = BiomeType.OCEAN;
        continue;
      }

      // Water biomes
      if (elevation < seaLevel) {
        const depthRatio = (seaLevel - elevation) / seaLevel;

        if (depthRatio < 0.1) {
          biomes_t[t] = BiomeType.SHALLOW_WATER;
        } else if (depthRatio < 0.3) {
          biomes_t[t] = BiomeType.SHALLOW_OCEAN;
        } else if (depthRatio < 0.7) {
          biomes_t[t] = BiomeType.OCEAN;
        } else {
          biomes_t[t] = BiomeType.DEEP_OCEAN;
        }
      }
      // Land biomes - based on elevation tiers, temperature, and moisture
      else {
        // Elevation tiers
        const elevationAboveSea = elevation - seaLevel;

        // Mountain biomes
        if (elevationAboveSea > 0.7) {
          if (temperature < 0.2) {
            biomes_t[t] = BiomeType.SNOW;
          } else if (temperature < 0.4) {
            biomes_t[t] = BiomeType.TUNDRA;
          } else {
            biomes_t[t] = BiomeType.MOUNTAIN;
          }
        }
        // Hill biomes
        else if (elevationAboveSea > 0.4) {
          if (temperature < 0.2) {
            biomes_t[t] = BiomeType.TUNDRA;
          } else if (temperature < 0.5) {
            if (moisture < 0.4) {
              biomes_t[t] = BiomeType.SHRUBLAND;
            } else {
              biomes_t[t] = BiomeType.TAIGA;
            }
          } else {
            if (moisture < 0.4) {
              biomes_t[t] = BiomeType.TEMPERATE_DESERT;
            } else if (moisture < 0.7) {
              biomes_t[t] = BiomeType.TEMPERATE_DECIDUOUS_FOREST;
            } else {
              biomes_t[t] = BiomeType.TEMPERATE_RAIN_FOREST;
            }
          }
        }
        // Lowland biomes
        else {
          // Cold regions (tundra, taiga)
          if (temperature < 0.2) {
            if (moisture < 0.4) {
              biomes_t[t] = BiomeType.TUNDRA;
            } else {
              biomes_t[t] = BiomeType.TAIGA;
            }
          }
          // Temperate regions
          else if (temperature < 0.6) {
            if (moisture < 0.3) {
              biomes_t[t] = BiomeType.TEMPERATE_DESERT;
            } else if (moisture < 0.5) {
              biomes_t[t] = BiomeType.GRASSLAND;
            } else if (moisture < 0.7) {
              biomes_t[t] = BiomeType.TEMPERATE_DECIDUOUS_FOREST;
            } else {
              biomes_t[t] = BiomeType.TEMPERATE_RAIN_FOREST;
            }
          }
          // Tropical regions
          else {
            if (moisture < 0.3) {
              biomes_t[t] = BiomeType.SUBTROPICAL_DESERT;
            } else if (moisture < 0.5) {
              biomes_t[t] = BiomeType.GRASSLAND;
            } else if (moisture < 0.7) {
              biomes_t[t] = BiomeType.TROPICAL_SEASONAL_FOREST;
            } else {
              biomes_t[t] = BiomeType.TROPICAL_RAIN_FOREST;
            }
          }

          // Beach biomes for coastal areas
          const isCoastal = hasNeighborBelow(mesh, t, elevation_t, seaLevel);
          if (isCoastal && elevationAboveSea < 0.05) {
            biomes_t[t] = temperature > 0.7 ? BiomeType.BEACH : BiomeType.BEACH;
          }
        }
      }

      // Track distribution
      biomeDistribution[biomes_t[t]] =
        (biomeDistribution[biomes_t[t]] || 0) + 1;
    }

    // Log biome distribution
    console.log("Biome distribution:");
    Object.entries(biomeDistribution).forEach(([biome, count]) => {
      const percentage = ((count / numTriangles) * 100).toFixed(1);
      console.log(`${getBiomeName(Number(biome))}: ${percentage}%`);
    });

    return biomes_t;
  } catch (error) {
    console.error("Error in biome assignment:", error);
    return new Array(numTriangles).fill(BiomeType.OCEAN);
  }
}

/**
 * Helper function to check if a triangle has any neighbors below sea level
 */
function hasNeighborBelow(
  mesh: VoronoiMesh,
  t: number,
  elevation_t: Float32Array,
  seaLevel: number
): boolean {
  for (const neighbor of mesh.neighbors[t]) {
    if (neighbor !== -1 && elevation_t[neighbor] < seaLevel) {
      return true;
    }
  }
  return false;
}

/**
 * Rasterize biome data to grid
 */
export function rasterizeBiomes(
  mesh: VoronoiMesh,
  biomes_t: number[],
  width: number,
  height: number
): number[][] {
  console.log(`Rasterizing biomes to ${width}x${height} grid`);

  const biomeGrid: number[][] = Array(height)
    .fill(0)
    .map(() => Array(width).fill(0));

  // Spatial hash for faster lookup
  const cellSize = 20;
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

  // For each pixel, find the closest triangle
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

      biomeGrid[y][x] = biomes_t[closestT];
    }
  }

  return biomeGrid;
}

/**
 * Get the name of a biome from its code
 */
export function getBiomeName(biomeCode: number): string {
  switch (biomeCode) {
    case BiomeType.OCEAN:
      return "Ocean";
    case BiomeType.DEEP_OCEAN:
      return "Deep Ocean";
    case BiomeType.SHALLOW_OCEAN:
      return "Shallow Ocean";
    case BiomeType.SHALLOW_WATER:
      return "Shallow Water";
    case BiomeType.BEACH:
      return "Beach";
    case BiomeType.SCORCHED:
      return "Scorched";
    case BiomeType.BARE:
      return "Bare";
    case BiomeType.TUNDRA:
      return "Tundra";
    case BiomeType.SNOW:
      return "Snow";
    case BiomeType.TEMPERATE_DESERT:
      return "Temperate Desert";
    case BiomeType.SUBTROPICAL_DESERT:
      return "Subtropical Desert";
    case BiomeType.GRASSLAND:
      return "Grassland";
    case BiomeType.SHRUBLAND:
      return "Shrubland";
    case BiomeType.TAIGA:
      return "Taiga";
    case BiomeType.TEMPERATE_DECIDUOUS_FOREST:
      return "Temperate Deciduous Forest";
    case BiomeType.TEMPERATE_RAIN_FOREST:
      return "Temperate Rain Forest";
    case BiomeType.TROPICAL_SEASONAL_FOREST:
      return "Tropical Seasonal Forest";
    case BiomeType.TROPICAL_RAIN_FOREST:
      return "Tropical Rain Forest";
    case BiomeType.MOUNTAIN:
      return "Mountain";
    default:
      return "Unknown";
  }
}

/**
 * Convert a biome grid of codes to a grid of names
 */
export function convertBiomeCodesToNames(biomeGrid: number[][]): string[][] {
  return biomeGrid.map((row) => row.map(getBiomeName));
}
