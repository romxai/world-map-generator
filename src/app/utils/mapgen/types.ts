/*
 * Map generator types
 * Based on reference implementation from RedBlobGames
 */

/**
 * Type definitions for the map generation system
 */

// Point data structure
export interface Point {
  x: number;
  y: number;
}

// Points data returned from point generation
export interface PointsData {
  points: Point[];
  mountainPoints: Point[];
}

// Voronoi mesh structure
export interface VoronoiMesh {
  points: Float32Array;
  triangles: Uint32Array;
  halfedges: Int32Array;
  numPoints: number;
  numTriangles: number;
  numHalfedges: number;
  is_boundary_t: Uint8Array;
  width: number;
  height: number;
  neighbors: number[][]; // Array of neighboring triangles for each triangle

  // Accessor methods
  x_of_t(t: number): number;
  y_of_t(t: number): number;
  t_center(t: number): Point;
}

// Noise data structure for precalculated noise
export interface NoiseData {
  elevation: Float32Array;
  moisture: Float32Array;
  waterNoise: Float32Array;
  roughness: Float32Array;
}

// River path structure
export interface RiverPath {
  triangles: number[];
  sourceTriangle: number;
  flow: number;
}

// Map configuration parameters
export interface MapConfig {
  seed: string;
  width: number;
  height: number;
  seaLevel: number;
  biomeDensity: number;
  mountainFrequency: number;
  hillFrequency: number;
  islandFrequency: number;
  pointDeviation: number;
  oceanRatio: number;
  jaggedness: number;
  mountainHeight: number;
  windAngleDeg: number;
  raininess: number;
  rainShadow: number;
  evaporation: number;
  riverWidth: number;
  rivers: number;
  riverMinFlow: number;
  showVoronoi: boolean;
  lighting: {
    enabled: boolean;
    azimuth: number;
    angle: number;
    intensity: number;
  };
}

// Output map data structure
export interface MapData {
  width: number;
  height: number;
  elevation: number[][];
  moisture: number[][];
  temperature: number[][];
  biomes: number[][];
  rivers: number[][];
}

// Biome type enumeration
export enum BiomeType {
  // Water biomes
  OCEAN = 0,
  DEEP_OCEAN = 1,
  SHALLOW_OCEAN = 2,
  SHALLOW_WATER = 3,

  // Coastal biomes
  BEACH = 4,

  // Cold biomes
  SNOW = 5,
  TUNDRA = 6,
  TAIGA = 7,

  // Temperate biomes
  GRASSLAND = 8,
  SHRUBLAND = 9,
  TEMPERATE_DECIDUOUS_FOREST = 10,
  TEMPERATE_RAIN_FOREST = 11,
  TEMPERATE_DESERT = 12,

  // Warm biomes
  SUBTROPICAL_DESERT = 13,
  TROPICAL_SEASONAL_FOREST = 14,
  TROPICAL_RAIN_FOREST = 15,

  // Mountain/Special biomes
  MOUNTAIN = 16,
  BARE = 17,
  SCORCHED = 18,
}

// Biome color mapping
export const BiomeColors: Record<BiomeType, string> = {
  [BiomeType.OCEAN]: "#0077be",
  [BiomeType.DEEP_OCEAN]: "#005a8c",
  [BiomeType.SHALLOW_OCEAN]: "#0099cc",
  [BiomeType.SHALLOW_WATER]: "#2cb6e5",
  [BiomeType.BEACH]: "#e9ddc3",
  [BiomeType.SNOW]: "#f5f5f5",
  [BiomeType.TUNDRA]: "#ddddbb",
  [BiomeType.TAIGA]: "#99aa77",
  [BiomeType.GRASSLAND]: "#b4c378",
  [BiomeType.SHRUBLAND]: "#c4b77a",
  [BiomeType.TEMPERATE_DECIDUOUS_FOREST]: "#73a348",
  [BiomeType.TEMPERATE_RAIN_FOREST]: "#448855",
  [BiomeType.TEMPERATE_DESERT]: "#e4cd9c",
  [BiomeType.SUBTROPICAL_DESERT]: "#e9ddc3",
  [BiomeType.TROPICAL_SEASONAL_FOREST]: "#559944",
  [BiomeType.TROPICAL_RAIN_FOREST]: "#337755",
  [BiomeType.MOUNTAIN]: "#aaaaaa",
  [BiomeType.BARE]: "#bbbbbb",
  [BiomeType.SCORCHED]: "#999999",
};

export interface RenderOptions {
  showElevation: boolean;
  showMoisture: boolean;
  showTemperature: boolean;
  showBiomes: boolean;
  showRivers: boolean;
  hillshading: boolean;
  showVoronoi: boolean;
  outlineStrength: number;
  lighting: number;
  ambientLight: number;
  lightAngle: number;
}
