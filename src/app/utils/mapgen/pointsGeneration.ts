/*
 * Point generation module
 * Creates points for Voronoi mesh creation with mountain peaks
 */

import { createSeededNoise2D } from "@/app/utils/mapgen/random";
import { type PointsData, type Point, type MapConfig } from "./types";

/**
 * Generate points using relaxed Poisson-disk sampling
 */
export function generatePoints(config: MapConfig): PointsData {
  console.log(`Generating points with seed: ${config.seed}`);
  const {
    width,
    height,
    biomeDensity,
    mountainFrequency,
    pointDeviation = 0.4,
  } = config;

  // Calculate point spacing based on density
  const cellSize = Math.sqrt(
    (width * height) / ((width * height * biomeDensity) / 30)
  );
  console.log(`Using cell size: ${cellSize} for density: ${biomeDensity}`);

  // Generate noise functions
  const noise2D = createSeededNoise2D(config.seed);
  const mountainNoise = createSeededNoise2D(config.seed + "-mountains");

  // Generate a grid of points with jittering
  const points: Point[] = [];
  const mountainPoints: Point[] = [];

  // Create boundary points
  createBoundaryPoints(points, width, height, cellSize / 2);

  // Create interior points using relaxed grid with jittering
  for (let y = cellSize / 2; y < height - cellSize / 2; y += cellSize) {
    for (let x = cellSize / 2; x < width - cellSize / 2; x += cellSize) {
      // Add randomness to point placement
      const offsetX = (Math.random() * 2 - 1) * cellSize * pointDeviation;
      const offsetY = (Math.random() * 2 - 1) * cellSize * pointDeviation;

      const nx = (x + offsetX) / width;
      const ny = (y + offsetY) / height;

      // Ensure the point stays within bounds
      const px = Math.max(
        cellSize / 2,
        Math.min(width - cellSize / 2, x + offsetX)
      );
      const py = Math.max(
        cellSize / 2,
        Math.min(height - cellSize / 2, y + offsetY)
      );

      points.push({ x: px, y: py });

      // Determine if this should be a mountain point
      // Mountains tend to form in clusters/ranges
      const mountainValue =
        (mountainNoise(nx * 4, ny * 4) * 0.5 + 0.5) *
        (noise2D(nx * 8, ny * 8) * 0.5 + 0.5);

      if (mountainValue > 0.7 && Math.random() < mountainFrequency) {
        mountainPoints.push({ x: px, y: py });
      }
    }
  }

  console.log(`Generated ${points.length} total points`);
  console.log(`Generated ${mountainPoints.length} mountain points`);

  return {
    points,
    mountainPoints,
  };
}

/**
 * Create boundary points to ensure we have a clean boundary
 */
function createBoundaryPoints(
  points: Point[],
  width: number,
  height: number,
  spacing: number
): void {
  // Bottom edge
  for (let x = 0; x <= width; x += spacing) {
    points.push({ x, y: 0 });
  }

  // Right edge
  for (let y = spacing; y <= height; y += spacing) {
    points.push({ x: width, y });
  }

  // Top edge
  for (let x = width - spacing; x >= 0; x -= spacing) {
    points.push({ x, y: height });
  }

  // Left edge
  for (let y = height - spacing; y >= spacing; y -= spacing) {
    points.push({ x: 0, y });
  }
}
