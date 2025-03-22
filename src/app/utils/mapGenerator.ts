import { createNoise2D, createNoise3D } from "simplex-noise";
import Delaunator from "delaunator";

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
  windAngleDeg: number;
  raininess: number;
  rainShadow: number;
  evaporation: number;
  riverMinFlow: number;
  riverWidth: number;
  mountainJaggedness: number;
}

export interface MapData {
  elevation: number[][];
  moisture: number[][];
  temperature: number[][];
  biomes: string[][];
  rivers: { x: number; y: number; width: number }[];
  voronoiCells: VoronoiCell[];
  seed: string;
}

export interface VoronoiCell {
  x: number;
  y: number;
  elevation: number;
  moisture: number;
  temperature: number;
  biome: string;
  neighbors: number[];
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

// Random number generator with a seed
const createRNG = (seed: string) => {
  const seedValue = hashSeed(seed);

  return () => {
    // Simple xorshift algorithm
    let x = seedValue;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;

    // Normalize to [0, 1]
    return (x >>> 0) / 4294967296;
  };
};

// Generate points for Voronoi cells using Poisson disk sampling
const generatePoints = (
  width: number,
  height: number,
  spacing: number,
  rng: () => number
): { x: number; y: number }[] => {
  const points: { x: number; y: number }[] = [];

  // Add boundary points first to create coastlines
  const boundarySpacing = spacing * 1.5;
  const boundaryInset = spacing * 0.5;

  // Top and bottom boundaries
  for (let x = boundaryInset; x < width - boundaryInset; x += boundarySpacing) {
    points.push({ x, y: boundaryInset });
    points.push({ x, y: height - boundaryInset });
  }

  // Left and right boundaries
  for (
    let y = boundaryInset;
    y < height - boundaryInset;
    y += boundarySpacing
  ) {
    points.push({ x: boundaryInset, y });
    points.push({ x: width - boundaryInset, y });
  }

  // Interior points with jittered grid
  const cellSize = spacing * 0.7; // Smaller for more detailed Voronoi
  const jitterAmount = cellSize * 0.6; // Control randomness

  for (let y = cellSize; y < height - cellSize; y += cellSize) {
    for (let x = cellSize; x < width - cellSize; x += cellSize) {
      // Add jitter to the grid position
      const jitterX = (rng() - 0.5) * jitterAmount;
      const jitterY = (rng() - 0.5) * jitterAmount;

      const px = Math.min(width - 1, Math.max(0, x + jitterX));
      const py = Math.min(height - 1, Math.max(0, y + jitterY));

      points.push({ x: px, y: py });
    }
  }

  return points;
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
    windAngleDeg,
    raininess,
    rainShadow,
    evaporation,
    riverMinFlow,
    riverWidth,
    mountainJaggedness,
  } = config;

  // Create a reproducible random number generator
  const rng = createRNG(seed);

  // Initialize noise generators
  const noise2D = createNoise2D(() => rng());
  const noise3D = createNoise3D(() => rng());

  // Generate points for Voronoi diagram
  const spacing = Math.sqrt(
    (width * height) / ((width * height * biomeDensity) / 200)
  );
  const points = generatePoints(width, height, spacing, rng);

  // Use Delaunator for triangulation
  const delaunay = Delaunator.from(
    points.map((p) => [p.x, p.y] as [number, number]),
    (p: [number, number]) => p[0],
    (p: [number, number]) => p[1]
  );

  // Create Voronoi cells from the Delaunay triangulation
  const voronoiCells: VoronoiCell[] = points.map((p, i) => ({
    x: p.x,
    y: p.y,
    elevation: 0,
    moisture: 0,
    temperature: 0,
    biome: BiomeType.OCEAN,
    neighbors: [],
  }));

  // Find neighbors for each cell based on Delaunay triangulation
  const { triangles } = delaunay;
  for (let i = 0; i < triangles.length; i += 3) {
    const a = triangles[i];
    const b = triangles[i + 1];
    const c = triangles[i + 2];

    if (!voronoiCells[a].neighbors.includes(b))
      voronoiCells[a].neighbors.push(b);
    if (!voronoiCells[a].neighbors.includes(c))
      voronoiCells[a].neighbors.push(c);
    if (!voronoiCells[b].neighbors.includes(a))
      voronoiCells[b].neighbors.push(a);
    if (!voronoiCells[b].neighbors.includes(c))
      voronoiCells[b].neighbors.push(c);
    if (!voronoiCells[c].neighbors.includes(a))
      voronoiCells[c].neighbors.push(a);
    if (!voronoiCells[c].neighbors.includes(b))
      voronoiCells[c].neighbors.push(b);
  }

  // Generate mountain peaks - more strategic placement
  const numMountains = Math.floor((width * height) / 15000);
  const mountainPeaks: number[] = [];

  // First get some random peaks with spacing constraints
  for (let i = 0; i < numMountains * 2; i++) {
    // Choose a random point away from edges for mountains
    const idx =
      Math.floor(rng() * voronoiCells.length * 0.8) +
      Math.floor(voronoiCells.length * 0.1);
    const cell = voronoiCells[idx];

    // Check if it's far enough from existing peaks
    let tooClose = false;
    for (const peakIdx of mountainPeaks) {
      const peak = voronoiCells[peakIdx];
      const dx = cell.x - peak.x;
      const dy = cell.y - peak.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < spacing * 8) {
        tooClose = true;
        break;
      }
    }

    if (
      !tooClose &&
      !mountainPeaks.includes(idx) &&
      cell.x > width * 0.1 &&
      cell.x < width * 0.9 &&
      cell.y > height * 0.1 &&
      cell.y < height * 0.9
    ) {
      mountainPeaks.push(idx);

      // Stop when we have enough peaks
      if (mountainPeaks.length >= numMountains) break;
    }
  }

  // Calculate mountain distance field
  const mountainDistance = new Array(voronoiCells.length).fill(Infinity);
  for (const peakIdx of mountainPeaks) {
    mountainDistance[peakIdx] = 0;
  }

  // Breadth-first search to calculate distance from mountains
  const calculateMountainDistances = () => {
    const visited = new Set<number>();
    const queue: number[] = [...mountainPeaks];

    for (const peakIdx of mountainPeaks) {
      visited.add(peakIdx);
    }

    while (queue.length > 0) {
      const currentIdx = queue.shift()!;
      const current = voronoiCells[currentIdx];

      for (const neighborIdx of current.neighbors) {
        if (!visited.has(neighborIdx)) {
          const neighbor = voronoiCells[neighborIdx];
          const dx = neighbor.x - current.x;
          const dy = neighbor.y - current.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // Add some randomness to the distance field
          const randomFactor = 1 + mountainJaggedness * (rng() - rng());
          const newDistance =
            mountainDistance[currentIdx] + distance * randomFactor;

          if (newDistance < mountainDistance[neighborIdx]) {
            mountainDistance[neighborIdx] = newDistance;
          }

          visited.add(neighborIdx);
          queue.push(neighborIdx);
        }
      }
    }
  };

  calculateMountainDistances();

  // Generate a continent mask using noise
  const generateContinentMask = () => {
    const mask: number[][] = Array(height)
      .fill(0)
      .map(() => Array(width).fill(0));

    // Generate a large-scale noise for continents
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const nx = x / width - 0.5;
        const ny = y / height - 0.5;

        // Distance from center with noise
        const distFromCenter = Math.sqrt(nx * nx + ny * ny) * 2;
        const continentNoise =
          noise2D(nx * continentSize * 0.3, ny * continentSize * 0.3) * 0.5 +
          0.5;

        // Combine distance from center with noise for continental shapes
        mask[y][x] = Math.max(
          0,
          Math.min(1, 1 - (distFromCenter - continentNoise * 0.8))
        );
      }
    }

    // Add some island chains based on additional noise patterns
    if (islandFrequency > 0) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const nx = x / width - 0.5;
          const ny = y / height - 0.5;

          // Create archipelago patterns with higher frequency noise
          const islandNoise =
            noise2D(nx * islandFrequency, ny * islandFrequency) * 0.5 + 0.5;
          const islandValue =
            Math.pow(islandNoise, 3) * 0.3 * (islandFrequency / 10);

          mask[y][x] = Math.min(1, mask[y][x] + islandValue);
        }
      }
    }

    return mask;
  };

  const continentMask = generateContinentMask();

  // Generate elevation for each cell with continental influence
  for (let i = 0; i < voronoiCells.length; i++) {
    const cell = voronoiCells[i];
    const nx = cell.x / width - 0.5;
    const ny = cell.y / height - 0.5;

    // Sample the continent mask
    const maskX = Math.min(width - 1, Math.max(0, Math.floor(cell.x)));
    const maskY = Math.min(height - 1, Math.max(0, Math.floor(cell.y)));
    const continentValue = continentMask[maskY][maskX];

    // Base elevation from continental mask
    let e = continentValue * 0.8;

    // Add terrain details with multiple octaves of noise
    let freq = 3.0;
    let amp = 0.2;

    for (let j = 0; j < 4; j++) {
      e += amp * (noise2D(nx * freq, ny * freq) * 0.5 + 0.5);
      amp *= roughness;
      freq *= 2;
    }

    // Apply falloff at world edges
    const edgeFalloff = Math.min(
      1,
      Math.min(cell.x, width - cell.x) / (width * 0.1),
      Math.min(cell.y, height - cell.y) / (height * 0.1)
    );

    e *= edgeFalloff;

    // Apply mountain influence with exponential falloff
    if (mountainDistance[i] < Infinity) {
      // Calculate mountain influence based on distance
      const distRatio = Math.min(1, mountainDistance[i] / (spacing * 15));
      const mountainFactor = Math.pow(1 - distRatio, 2) * mountainHeight;

      // Add mountain height with a peak-like profile
      e += mountainFactor;
    }

    // Adjusting terrain to create more distinct landforms
    if (e > seaLevel + 0.05) {
      // Emphasize land above sea level
      e = seaLevel + (e - seaLevel) * (1 + (e - seaLevel) * 0.5);
    } else if (e < seaLevel - 0.05) {
      // Deepen oceans
      e = seaLevel - (seaLevel - e) * 1.2;
    }

    // Clamp to valid range
    e = Math.max(0, Math.min(1, e));

    cell.elevation = e;
  }

  // Generate temperature based on elevation and latitude
  for (let i = 0; i < voronoiCells.length; i++) {
    const cell = voronoiCells[i];

    // Temperature depends on latitude (distance from equator) and elevation
    const latitudeFactor = Math.abs((cell.y / height) * 2 - 1); // 0 at equator, 1 at poles
    const elevationFactor =
      cell.elevation > seaLevel ? cell.elevation - seaLevel : 0;

    // Higher latitude and elevation means lower temperature
    const t = 1 - (latitudeFactor * 0.65 + elevationFactor * 0.35);
    cell.temperature = Math.max(0, Math.min(1, t));
  }

  // Generate initial moisture and rainfall
  const windAngleRad = (windAngleDeg * Math.PI) / 180;
  const windVec = [Math.cos(windAngleRad), Math.sin(windAngleRad)];

  // Sort cells by wind direction for rainfall calculation
  const cellsOrderedByWind = [...voronoiCells.keys()].sort((a, b) => {
    // Project cell position onto wind direction vector
    const aProj =
      voronoiCells[a].x * windVec[0] + voronoiCells[a].y * windVec[1];
    const bProj =
      voronoiCells[b].x * windVec[0] + voronoiCells[b].y * windVec[1];
    return aProj - bProj;
  });

  // Initialize moisture
  for (let i = 0; i < voronoiCells.length; i++) {
    const cell = voronoiCells[i];

    // Ocean and coastal cells start with high moisture
    if (cell.elevation < seaLevel) {
      cell.moisture = 1.0;
    } else {
      cell.moisture = 0.1; // Small base value for all land
    }
  }

  // Calculate moisture and rainfall with improved rain shadow and wind patterns
  for (const cellIdx of cellsOrderedByWind) {
    const cell = voronoiCells[cellIdx];

    if (cell.elevation < seaLevel) {
      // Water evaporates from ocean
      cell.moisture = 1.0;
      continue;
    }

    // Find upwind neighbors that are in the direction opposite to the wind
    const upwindNeighbors = cell.neighbors.filter((neighborIdx) => {
      const neighbor = voronoiCells[neighborIdx];
      const dx = cell.x - neighbor.x;
      const dy = cell.y - neighbor.y;
      // Dot product with wind direction to see if neighbor is upwind
      const dotProduct = dx * windVec[0] + dy * windVec[1];
      return dotProduct > 0;
    });

    if (upwindNeighbors.length > 0) {
      // Calculate average moisture from upwind neighbors
      let moistureSum = 0;
      let upwindCount = 0;

      for (const neighborIdx of upwindNeighbors) {
        const neighbor = voronoiCells[neighborIdx];

        // Moisture diminishes with elevation increase (orographic effect)
        if (cell.elevation > neighbor.elevation) {
          const elevDiff = cell.elevation - neighbor.elevation;
          const rainAmount = rainShadow * elevDiff * neighbor.moisture;

          // Transfer moisture and apply rainfall
          moistureSum += Math.max(0, neighbor.moisture - rainAmount);
          upwindCount++;

          // Rain falls as air rises (stronger effect with greater height difference)
          if (
            neighbor.elevation >= seaLevel &&
            cell.elevation > neighbor.elevation
          ) {
            // The steeper the slope, the more rain falls
            const slopeFactor = Math.min(1, elevDiff * 10);
            const distanceFactor = Math.max(
              0.5,
              1 - mountainDistance[cellIdx] / (width * 0.2)
            );
            cell.moisture += raininess * slopeFactor * distanceFactor * 0.1;
          }
        } else {
          // Air moving downhill retains moisture
          moistureSum += neighbor.moisture;
          upwindCount++;
        }
      }

      if (upwindCount > 0) {
        // Average the incoming moisture and apply a small reduction
        cell.moisture = Math.max(
          cell.moisture,
          (moistureSum / upwindCount) * 0.95
        );
      }
    }

    // Evaporation from nearby water bodies
    const waterNeighbors = cell.neighbors.filter(
      (neighborIdx) => voronoiCells[neighborIdx].elevation < seaLevel
    );

    if (waterNeighbors.length > 0) {
      // More water neighbors = more evaporation
      const evaporationFactor =
        (waterNeighbors.length / cell.neighbors.length) * evaporation;
      cell.moisture = Math.min(1, cell.moisture + evaporationFactor * 0.2);
    }

    // Clamp moisture to valid range
    cell.moisture = Math.max(0, Math.min(1, cell.moisture));
  }

  // Calculate downslope for each cell (used for rivers)
  const downslope = new Array(voronoiCells.length).fill(-1);
  const calculateDownslope = () => {
    for (let i = 0; i < voronoiCells.length; i++) {
      const cell = voronoiCells[i];

      if (cell.elevation < seaLevel) {
        // Ocean cells flow to the lowest neighbor
        let lowestNeighbor = -1;
        let lowestElevation = cell.elevation;

        for (const neighborIdx of cell.neighbors) {
          const neighbor = voronoiCells[neighborIdx];
          if (neighbor.elevation < lowestElevation) {
            lowestElevation = neighbor.elevation;
            lowestNeighbor = neighborIdx;
          }
        }

        downslope[i] = lowestNeighbor;
      } else {
        // Land cells flow to lowest neighbor
        let lowestNeighbor = -1;
        let lowestElevation = cell.elevation;

        for (const neighborIdx of cell.neighbors) {
          const neighbor = voronoiCells[neighborIdx];
          if (neighbor.elevation < lowestElevation) {
            lowestElevation = neighbor.elevation;
            lowestNeighbor = neighborIdx;
          }
        }

        downslope[i] = lowestNeighbor;
      }
    }
  };

  calculateDownslope();

  // Calculate flow accumulation with improved river formation
  const flow = new Array(voronoiCells.length).fill(0);

  // Initialize flow based on rainfall (moisture)
  for (let i = 0; i < voronoiCells.length; i++) {
    if (voronoiCells[i].elevation >= seaLevel) {
      // Use moisture as a base for rainfall, squared for more dramatic effect in wet areas
      const rainfall = voronoiCells[i].moisture * voronoiCells[i].moisture;

      // Apply rivers parameter as a global multiplier
      flow[i] = rainfall * rivers;

      // Higher elevations tend to have more initial flow (from rainfall/snowmelt)
      const elevationAboveSea = voronoiCells[i].elevation - seaLevel;
      const elevationBonus = Math.pow(elevationAboveSea * 2, 2) * 0.2;

      flow[i] *= 1 + elevationBonus;
    }
  }

  // Sort cells by elevation for proper flow accumulation (highest to lowest)
  const visitOrder = [...voronoiCells.keys()].sort(
    (a, b) => voronoiCells[b].elevation - voronoiCells[a].elevation
  );

  // Propagate flow downstream
  for (const cellIdx of visitOrder) {
    const downstream = downslope[cellIdx];

    if (downstream >= 0) {
      // Add flow from this cell to its downstream neighbor
      flow[downstream] += flow[cellIdx];

      // Erode terrain slightly along major rivers
      if (
        flow[cellIdx] > riverMinFlow * 2 &&
        voronoiCells[downstream].elevation > seaLevel
      ) {
        // Rivers erode their channels, deepening them over time
        const erosionAmount = Math.min(0.05, flow[cellIdx] * 0.01);
        voronoiCells[downstream].elevation = Math.max(
          seaLevel + 0.01,
          voronoiCells[downstream].elevation - erosionAmount
        );
      }
    }
  }

  // Generate river paths with improved width calculation
  const riverPaths: { x: number; y: number; width: number }[] = [];
  const processedCells = new Set<number>();

  for (let i = 0; i < voronoiCells.length; i++) {
    // Only start rivers from cells with significant flow
    if (flow[i] > riverMinFlow && voronoiCells[i].elevation >= seaLevel) {
      let currentIdx = i;

      // Follow the river downstream
      while (currentIdx >= 0 && !processedCells.has(currentIdx)) {
        const cell = voronoiCells[currentIdx];

        // Calculate river width based on flow (with log scaling for more natural appearance)
        const riverWidthValue = Math.max(
          0.5,
          Math.min(8, Math.log(flow[currentIdx] * 100 + 1) * riverWidth * 2)
        );

        // Add river point
        riverPaths.push({
          x: cell.x,
          y: cell.y,
          width: riverWidthValue,
        });

        processedCells.add(currentIdx);

        // Move downstream
        currentIdx = downslope[currentIdx];

        // Stop if we reach ocean or a cell we've already processed
        if (
          currentIdx >= 0 &&
          (voronoiCells[currentIdx].elevation < seaLevel ||
            processedCells.has(currentIdx))
        ) {
          break;
        }
      }
    }
  }

  // Determine biomes with improved logic
  for (let i = 0; i < voronoiCells.length; i++) {
    const cell = voronoiCells[i];
    const e = cell.elevation;
    const m = cell.moisture;
    const t = cell.temperature;

    if (e < seaLevel - 0.15) {
      cell.biome = BiomeType.DEEP_OCEAN;
    } else if (e < seaLevel) {
      cell.biome = BiomeType.OCEAN;
    } else if (e < seaLevel + 0.02) {
      // Beach is a narrow band around sea level
      cell.biome = BiomeType.BEACH;
    } else if (e > seaLevel + 0.55) {
      // Highest elevations are high mountains
      cell.biome = BiomeType.HIGH_MOUNTAIN;
    } else if (e > seaLevel + 0.4) {
      // High elevations but not peaks
      cell.biome = BiomeType.MOUNTAIN;
    } else {
      // For regular land, use temperature and moisture to determine biome
      // Very cold regions
      if (t < 0.2) {
        cell.biome = m > 0.4 ? BiomeType.SNOW : BiomeType.TUNDRA;
      }
      // Cold regions
      else if (t < 0.3) {
        cell.biome = BiomeType.TUNDRA;
      }
      // Cool temperate regions
      else if (t < 0.4) {
        if (m > 0.6) {
          cell.biome = BiomeType.TAIGA;
        } else if (m > 0.3) {
          cell.biome = BiomeType.FOREST;
        } else {
          cell.biome = BiomeType.GRASSLAND;
        }
      }
      // Temperate regions
      else if (t < 0.6) {
        if (m < 0.3) {
          cell.biome = BiomeType.GRASSLAND;
        } else if (m < 0.6) {
          cell.biome = BiomeType.FOREST;
        } else {
          cell.biome = BiomeType.RAINFOREST;
        }
      }
      // Hot regions
      else {
        if (m < 0.2) {
          cell.biome = BiomeType.DESERT;
        } else if (m < 0.4) {
          cell.biome = BiomeType.SAVANNA;
        } else if (m < 0.8) {
          cell.biome = BiomeType.GRASSLAND;
        } else {
          cell.biome = BiomeType.RAINFOREST;
        }
      }
    }
  }

  // Convert Voronoi-based data to grid data for rendering
  const elevation = Array(height)
    .fill(0)
    .map(() => Array(width).fill(0));
  const moisture = Array(height)
    .fill(0)
    .map(() => Array(width).fill(0));
  const temperature = Array(height)
    .fill(0)
    .map(() => Array(width).fill(0));
  const biomes = Array(height)
    .fill(0)
    .map(() => Array(width).fill(BiomeType.OCEAN));

  // Rasterize Voronoi cells to the grid
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Find the nearest Voronoi cell
      let minDist = Infinity;
      let nearestCellIdx = 0;

      for (let i = 0; i < voronoiCells.length; i++) {
        const cell = voronoiCells[i];
        const dx = cell.x - x;
        const dy = cell.y - y;
        const dist = dx * dx + dy * dy;

        if (dist < minDist) {
          minDist = dist;
          nearestCellIdx = i;
        }
      }

      // Assign grid values based on the nearest cell
      const nearestCell = voronoiCells[nearestCellIdx];
      elevation[y][x] = nearestCell.elevation;
      moisture[y][x] = nearestCell.moisture;
      temperature[y][x] = nearestCell.temperature;
      biomes[y][x] = nearestCell.biome;
    }
  }

  return {
    elevation,
    moisture,
    temperature,
    biomes,
    rivers: riverPaths,
    voronoiCells,
    seed,
  };
};
