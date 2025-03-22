import { createNoise2D, createNoise3D } from "simplex-noise";

export interface MapConfig {
  seed: string;
  width: number;
  height: number;
  seaLevel: number;
  mountainHeight: number;
  roughness: number;
  rivers: number;
  biomeDensity: number;
  continentSize: number;
  islandFrequency: number;
}

export interface MapData {
  elevation: number[][];
  moisture: number[][];
  temperature: number[][];
  biomes: string[][];
  rivers: { x: number; y: number }[];
}

export enum BiomeType {
  OCEAN = "OCEAN",
  DEEP_OCEAN = "DEEP_OCEAN",
  BEACH = "BEACH",
  DESERT = "DESERT",
  SAVANNA = "SAVANNA",
  GRASSLAND = "GRASSLAND",
  FOREST = "FOREST",
  RAINFOREST = "RAINFOREST",
  TAIGA = "TAIGA",
  TUNDRA = "TUNDRA",
  SNOW = "SNOW",
  MOUNTAIN = "MOUNTAIN",
  HIGH_MOUNTAIN = "HIGH_MOUNTAIN",
}

export const BiomeColors: Record<BiomeType, string> = {
  [BiomeType.OCEAN]: "#0077be",
  [BiomeType.DEEP_OCEAN]: "#005a8c",
  [BiomeType.BEACH]: "#f5deb3",
  [BiomeType.DESERT]: "#e4d96f",
  [BiomeType.SAVANNA]: "#d3bc5f",
  [BiomeType.GRASSLAND]: "#7ccd7c",
  [BiomeType.FOREST]: "#228b22",
  [BiomeType.RAINFOREST]: "#0b6623",
  [BiomeType.TAIGA]: "#5d8b61",
  [BiomeType.TUNDRA]: "#a8b0ac",
  [BiomeType.SNOW]: "#fffafa",
  [BiomeType.MOUNTAIN]: "#8b7d7b",
  [BiomeType.HIGH_MOUNTAIN]: "#ffffff",
};

// Helper to get a deterministic seed value
const hashSeed = (seed: string): number => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return hash;
};

// Generate map with the given configuration
export const generateMap = (config: MapConfig): MapData => {
  const {
    seed,
    width,
    height,
    seaLevel,
    mountainHeight,
    roughness,
    rivers,
    biomeDensity,
    continentSize,
    islandFrequency,
  } = config;

  // Initialize noise generators with the seed
  const seedValue = hashSeed(seed).toString();
  const noise2D = createNoise2D();
  const noise3D = createNoise3D();

  // Initialize arrays
  const elevation: number[][] = Array(height)
    .fill(0)
    .map(() => Array(width).fill(0));
  const moisture: number[][] = Array(height)
    .fill(0)
    .map(() => Array(width).fill(0));
  const temperature: number[][] = Array(height)
    .fill(0)
    .map(() => Array(width).fill(0));
  const biomes: string[][] = Array(height)
    .fill(0)
    .map(() => Array(width).fill(BiomeType.OCEAN));

  // Generate base terrain using multiple octaves of noise
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Normalize coordinates
      const nx = x / width - 0.5;
      const ny = y / height - 0.5;

      // Generate continental shapes using low-frequency noise
      let e = 0;
      let freq = continentSize;
      let amp = 1;

      // Add multiple octaves of noise for terrain detail
      for (let i = 0; i < 6; i++) {
        e +=
          amp *
          noise2D(
            nx * freq + parseInt(seedValue),
            ny * freq + parseInt(seedValue)
          );
        amp *= roughness;
        freq *= 2;
      }

      // Add some island formations
      if (islandFrequency > 0) {
        const islandNoise = noise2D(
          nx * islandFrequency + parseInt(seedValue) + 1000,
          ny * islandFrequency + parseInt(seedValue) + 1000
        );
        e += islandNoise * 0.4;
      }

      // Scale elevation
      e = (e + 1) / 2; // Normalize to [0,1]

      // Apply mountain height multiplier for dramatic peaks
      if (e > seaLevel + 0.1) {
        const mountainFactor =
          Math.pow((e - seaLevel - 0.1) / (1 - seaLevel - 0.1), 2) *
          mountainHeight;
        e += mountainFactor * 0.3;
      }

      // Store elevation
      elevation[y][x] = e;

      // Generate moisture map based on elevation and noise
      const m =
        (noise2D(
          nx * 3 + parseInt(seedValue) + 2000,
          ny * 3 + parseInt(seedValue) + 2000
        ) +
          1) /
        2;
      moisture[y][x] = m;

      // Generate temperature based on elevation and latitude (y position)
      const latitudeFactor = Math.abs(ny * 2); // Higher latitudes are colder
      const elevationFactor = e > seaLevel ? e - seaLevel : 0; // Higher elevations are colder
      const t = 1 - (latitudeFactor * 0.7 + elevationFactor * 0.3);
      temperature[y][x] = t;
    }
  }

  // Generate rivers
  const riverPoints: { x: number; y: number }[] = [];
  const numRivers = Math.floor((width * height * rivers) / 10000);

  for (let i = 0; i < numRivers; i++) {
    // Start rivers from high elevation points
    let x = Math.floor(Math.random() * width);
    let y = Math.floor(Math.random() * height);

    // Find a suitable starting point (above sea level)
    let attempts = 0;
    while (elevation[y][x] <= seaLevel && attempts < 100) {
      x = Math.floor(Math.random() * width);
      y = Math.floor(Math.random() * height);
      attempts++;
    }

    if (attempts < 100) {
      // Start flowing the river down the elevation gradient
      for (let step = 0; step < 1000; step++) {
        riverPoints.push({ x, y });

        // Increase moisture along rivers
        const moistureRadius = 3;
        for (
          let my = Math.max(0, y - moistureRadius);
          my < Math.min(height, y + moistureRadius);
          my++
        ) {
          for (
            let mx = Math.max(0, x - moistureRadius);
            mx < Math.min(width, x + moistureRadius);
            mx++
          ) {
            const dist = Math.sqrt(Math.pow(mx - x, 2) + Math.pow(my - y, 2));
            if (dist <= moistureRadius) {
              moisture[my][mx] = Math.min(
                1,
                moisture[my][mx] + (1 - dist / moistureRadius) * 0.2
              );
            }
          }
        }

        // Find the lowest neighbor
        let lowestElevation = elevation[y][x];
        let nextX = x;
        let nextY = y;

        for (
          let ny = Math.max(0, y - 1);
          ny <= Math.min(height - 1, y + 1);
          ny++
        ) {
          for (
            let nx = Math.max(0, x - 1);
            nx <= Math.min(width - 1, x + 1);
            nx++
          ) {
            if (nx === x && ny === y) continue;

            if (elevation[ny][nx] < lowestElevation) {
              lowestElevation = elevation[ny][nx];
              nextX = nx;
              nextY = ny;
            }
          }
        }

        // If we can't flow any lower or we reached the sea, stop
        if (
          (nextX === x && nextY === y) ||
          elevation[nextY][nextX] <= seaLevel
        ) {
          break;
        }

        x = nextX;
        y = nextY;
      }
    }
  }

  // Determine biomes based on elevation, moisture, and temperature
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const e = elevation[y][x];
      const m = moisture[y][x];
      const t = temperature[y][x];

      if (e < seaLevel - 0.15) {
        biomes[y][x] = BiomeType.DEEP_OCEAN;
      } else if (e < seaLevel) {
        biomes[y][x] = BiomeType.OCEAN;
      } else if (e < seaLevel + 0.015) {
        biomes[y][x] = BiomeType.BEACH;
      } else if (e > seaLevel + 0.45) {
        biomes[y][x] = BiomeType.HIGH_MOUNTAIN;
      } else if (e > seaLevel + 0.35) {
        biomes[y][x] = BiomeType.MOUNTAIN;
      } else if (t < 0.2) {
        biomes[y][x] = BiomeType.SNOW;
      } else if (t < 0.3) {
        biomes[y][x] = BiomeType.TUNDRA;
      } else if (t < 0.4) {
        biomes[y][x] = m > 0.6 ? BiomeType.TAIGA : BiomeType.TUNDRA;
      } else if (t < 0.6) {
        if (m < 0.3) {
          biomes[y][x] = BiomeType.GRASSLAND;
        } else if (m < 0.6) {
          biomes[y][x] = BiomeType.FOREST;
        } else {
          biomes[y][x] = BiomeType.RAINFOREST;
        }
      } else {
        if (m < 0.3) {
          biomes[y][x] = BiomeType.DESERT;
        } else if (m < 0.5) {
          biomes[y][x] = BiomeType.SAVANNA;
        } else if (m < 0.8) {
          biomes[y][x] = BiomeType.GRASSLAND;
        } else {
          biomes[y][x] = BiomeType.RAINFOREST;
        }
      }
    }
  }

  return {
    elevation,
    moisture,
    temperature,
    biomes,
    rivers: riverPoints,
  };
};
