/*
 * Main map generation module
 * Orchestrates the entire map generation process
 */

import { createMesh } from "./mesh";
import { generatePoints } from "./pointsGeneration";
import {
  precalculateNoise,
  calculateMountainDistance,
  generateContinentMask,
  generateElevation,
  rasterizeElevation,
} from "./terrain";
import {
  generateTemperature,
  calculateWindOrder,
  calculateMoisture,
  calculateDownslope,
  calculateFlowAccumulation,
  rasterizeClimate,
  rasterizeRivers,
} from "./climate";
import { assignBiomes, rasterizeBiomes } from "./biomes";
import { type MapConfig, type MapData, type VoronoiMesh } from "./types";

/**
 * Main map generation function
 * Coordinates all the separate generation systems
 */
export function generateMap(config: MapConfig): MapData {
  console.log(`Generating map with seed: ${config.seed}`);
  console.time("mapGeneration");
  try {
    const { width, height } = config;
    const mapData: MapData = {
      width,
      height,
      elevation: [],
      moisture: [],
      temperature: [],
      biomes: [],
      rivers: [],
    };

    // 1. Generate points and create mesh
    console.log("Step 1: Generating points and creating Voronoi mesh");
    console.time("meshCreation");
    const pointsData = generatePoints(config);
    const mesh = createMesh(pointsData, width, height);
    console.timeEnd("meshCreation");
    console.log(`Created mesh with ${mesh.numTriangles} triangles`);

    // 2. Generate elevation data (terrain)
    console.log("Step 2: Generating terrain");
    console.time("terrainGeneration");
    const noiseData = precalculateNoise(config);
    const { distances, peaks } = calculateMountainDistance(mesh, config);
    const continentMask = generateContinentMask(mesh, config, noiseData);
    const elevation_t = generateElevation(
      mesh,
      continentMask,
      distances,
      noiseData,
      config
    );
    console.timeEnd("terrainGeneration");

    // 3. Generate climate (temperature and moisture)
    console.log("Step 3: Generating climate model");
    console.time("climateGeneration");
    const temperature_t = generateTemperature(mesh, elevation_t, config);
    const windOrder = calculateWindOrder(mesh, config);
    const { moisture_t, rainfall_t } = calculateMoisture(
      mesh,
      elevation_t,
      windOrder,
      config
    );
    console.timeEnd("climateGeneration");

    // 4. Generate rivers
    console.log("Step 4: Generating river systems");
    console.time("riverGeneration");
    const downslope_t = calculateDownslope(mesh, elevation_t);
    const { flow_t, riverPaths } = calculateFlowAccumulation(
      mesh,
      elevation_t,
      rainfall_t,
      downslope_t,
      config
    );
    console.timeEnd("riverGeneration");
    console.log(`Generated ${riverPaths.length} rivers`);

    // 5. Assign biomes
    console.log("Step 5: Assigning biomes");
    console.time("biomeAssignment");
    const biomes_t = assignBiomes(
      mesh,
      elevation_t,
      moisture_t,
      temperature_t,
      config.seaLevel
    );
    console.timeEnd("biomeAssignment");

    // 6. Rasterize all data to regular grids
    console.log("Step 6: Rasterizing data to output grids");
    console.time("rasterization");
    mapData.elevation = rasterizeElevation(mesh, elevation_t, width, height);

    const climateGrids = rasterizeClimate(
      mesh,
      moisture_t,
      temperature_t,
      width,
      height
    );
    mapData.moisture = climateGrids.moisture;
    mapData.temperature = climateGrids.temperature;

    mapData.rivers = rasterizeRivers(mesh, riverPaths, width, height, config);
    mapData.biomes = rasterizeBiomes(mesh, biomes_t, width, height);
    console.timeEnd("rasterization");

    // Return the complete map data
    console.timeEnd("mapGeneration");
    console.log("Map generation complete");
    return mapData;
  } catch (error) {
    console.error("Error generating map:", error);
    throw error;
  }
}

/**
 * Initialize default map data
 */
export function createEmptyMapData(width: number, height: number): MapData {
  // Create empty 2D arrays for each data type
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
    .map(() => Array(width).fill(0));
  const rivers = Array(height)
    .fill(0)
    .map(() => Array(width).fill(0));

  return {
    width,
    height,
    elevation,
    moisture,
    temperature,
    biomes,
    rivers,
  };
}

// Re-export types
export * from "./types";
