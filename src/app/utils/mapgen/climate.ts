/*
 * Climate and River Simulation Module
 * Creates realistic temperature, precipitation, and river systems
 */

import FlatQueue from "flatqueue";
import { createSeededNoise2D } from "./random";
import { type VoronoiMesh, type MapConfig, type RiverPath } from "./types";

/**
 * Generate temperature based on elevation and latitude
 */
export function generateTemperature(
  mesh: VoronoiMesh,
  elevation_t: Float32Array,
  config: MapConfig
): Float32Array {
  console.log("Generating temperature model");
  const { numTriangles } = mesh;
  const temperature_t = new Float32Array(numTriangles);
  const { seaLevel } = config;

  const noise2D = createSeededNoise2D(config.seed + "-temperature");

  for (let t = 0; t < numTriangles; t++) {
    const x = mesh.x_of_t(t);
    const y = mesh.y_of_t(t);

    // Normalize coordinates to calculate latitude effect
    const nx = x / mesh.width;
    const ny = y / mesh.height;

    // Temperature gradient from equator (center) to poles (top/bottom)
    // This creates a temperature gradient based on latitude
    const latitude = Math.abs(ny - 0.5) * 2; // 0 at equator, 1 at poles

    // Calculate baseline temperature (1.0 at equator, 0.0 at poles)
    let temp = 1.0 - Math.pow(latitude, 1.2);

    // Apply elevation effect - higher elevations are colder
    const elevationAboveSea = Math.max(0, elevation_t[t] - seaLevel);

    // Mountains get colder
    temp -= elevationAboveSea * 0.6;

    // Water has a moderating effect on temperature
    if (elevation_t[t] < seaLevel) {
      temp = temp * 0.8 + 0.2; // Less extreme temperatures over water
    }

    // Apply some minor local variations with noise
    const noiseVal = noise2D(nx * 8, ny * 8) * 0.05;
    temp += noiseVal;

    // Clamp to valid range
    temperature_t[t] = Math.max(0, Math.min(1, temp));
  }

  console.log("Temperature model complete");
  return temperature_t;
}

/**
 * Sort regions based on wind direction for rainfall calculation
 */
export function calculateWindOrder(
  mesh: VoronoiMesh,
  config: MapConfig
): number[] {
  console.log("Calculating wind order");
  const { windAngleDeg } = config;
  const { numTriangles } = mesh;

  // Convert wind angle to radians
  const windAngleRad = (windAngleDeg * Math.PI) / 180;
  const windX = Math.cos(windAngleRad);
  const windY = Math.sin(windAngleRad);

  // Calculate wind projection for each triangle
  const windProjections = new Float32Array(numTriangles);
  for (let t = 0; t < numTriangles; t++) {
    const x = mesh.x_of_t(t);
    const y = mesh.y_of_t(t);

    // Project position onto wind direction vector
    windProjections[t] = x * windX + y * windY;
  }

  // Sort triangles by projection value (upwind to downwind)
  const triangles = Array.from({ length: numTriangles }, (_, i) => i);
  triangles.sort((a, b) => windProjections[a] - windProjections[b]);

  console.log("Wind order calculation complete");
  return triangles;
}

/**
 * Calculate moisture and rainfall based on wind direction, elevation, and climate factors
 */
export function calculateMoisture(
  mesh: VoronoiMesh,
  elevation_t: Float32Array,
  windOrder: number[],
  config: MapConfig
): {
  moisture_t: Float32Array;
  rainfall_t: Float32Array;
} {
  console.log("Calculating moisture and rainfall");
  const { numTriangles } = mesh;
  const moisture_t = new Float32Array(numTriangles).fill(0);
  const rainfall_t = new Float32Array(numTriangles).fill(0);

  const { seaLevel, raininess, rainShadow, evaporation, windAngleDeg } = config;

  // Create slight variations in wind direction to simulate turbulence
  const turbulenceNoise = createSeededNoise2D(config.seed + "-windturb");

  // Wind direction vectors
  const windAngleRad = (windAngleDeg * Math.PI) / 180;
  const windX = Math.cos(windAngleRad);
  const windY = Math.sin(windAngleRad);

  // Initialize moisture - oceans have high moisture content
  for (let t = 0; t < numTriangles; t++) {
    // Ocean has high moisture (1.0), land starts dry
    moisture_t[t] = elevation_t[t] < seaLevel ? 1.0 : 0.1;
  }

  // Process triangles in wind order (upwind to downwind)
  for (const t of windOrder) {
    if (mesh.is_boundary_t[t]) continue;

    // Skip deep water
    if (elevation_t[t] < seaLevel - 0.1) continue;

    // Wind turbulence - minor variations in wind direction
    const nx = mesh.x_of_t(t) / mesh.width;
    const ny = mesh.y_of_t(t) / mesh.height;
    const turbulence = turbulenceNoise(nx * 5, ny * 5) * 0.2;

    // Adjusted wind direction with turbulence
    const adjustedWindX = windX + turbulence * windY;
    const adjustedWindY = windY - turbulence * windX;
    const windLength = Math.sqrt(
      adjustedWindX * adjustedWindX + adjustedWindY * adjustedWindY
    );
    const normalizedWindX = adjustedWindX / windLength;
    const normalizedWindY = adjustedWindY / windLength;

    // Find upwind neighbors (neighbors in direction opposite to wind)
    for (const neighbor of mesh.neighbors[t]) {
      if (neighbor === -1) continue;

      // Vector from neighbor to current triangle
      const dx = mesh.x_of_t(t) - mesh.x_of_t(neighbor);
      const dy = mesh.y_of_t(t) - mesh.y_of_t(neighbor);

      // Check if this neighbor is upwind (dot product with wind > 0)
      const dotProduct = dx * normalizedWindX + dy * normalizedWindY;

      if (dotProduct > 0) {
        // Transfer moisture from upwind neighbor
        const neighborElevation = elevation_t[neighbor];
        const currentElevation = elevation_t[t];

        // Baseline moisture transfer
        moisture_t[t] += moisture_t[neighbor] * 0.2;

        // Orographic rainfall: rising air loses moisture
        // When moving from low to high elevation
        if (currentElevation > neighborElevation) {
          const elevationDiff = currentElevation - neighborElevation;

          // Rising air creates rainfall based on available moisture and slope steepness
          const rainfallAmount =
            moisture_t[neighbor] *
            raininess *
            Math.min(1, elevationDiff * 5) *
            (currentElevation > seaLevel ? 1.0 : 0.3); // Less rainfall over ocean

          // Add rainfall
          rainfall_t[t] += rainfallAmount;

          // Reduce moisture (rain shadow effect)
          if (elevationDiff > 0.1) {
            // More pronounced rain shadow for larger elevation changes
            const shadowStrength = Math.min(
              0.9,
              rainShadow * elevationDiff * 2
            );
            moisture_t[t] -= moisture_t[neighbor] * shadowStrength;
          }
        }
      }
    }

    // Normalize and ensure valid range
    moisture_t[t] = Math.max(0, Math.min(1, moisture_t[t]));

    // Add evaporation from water bodies and wet ground
    if (elevation_t[t] < seaLevel) {
      // Evaporation from oceans
      moisture_t[t] = 1.0;
    } else if (rainfall_t[t] > 0) {
      // Some of the rainfall adds back to the moisture
      moisture_t[t] += rainfall_t[t] * evaporation * 0.3;
      moisture_t[t] = Math.min(1, moisture_t[t]);
    }
  }

  // Final pass - normalize rainfall
  let maxRainfall = 0;
  for (let t = 0; t < numTriangles; t++) {
    maxRainfall = Math.max(maxRainfall, rainfall_t[t]);
  }

  if (maxRainfall > 0) {
    for (let t = 0; t < numTriangles; t++) {
      rainfall_t[t] /= maxRainfall;
    }
  }

  console.log("Moisture and rainfall calculation complete");
  return { moisture_t, rainfall_t };
}

/**
 * Calculate downslope directions - water flows downhill
 */
export function calculateDownslope(
  mesh: VoronoiMesh,
  elevation_t: Float32Array
): Int32Array {
  console.log("Calculating downslope directions");
  const { numTriangles } = mesh;
  const downslope_t = new Int32Array(numTriangles).fill(-1);

  // For each triangle, find the lowest neighbor
  for (let t = 0; t < numTriangles; t++) {
    let lowestNeighbor = -1;
    let lowestElevation = elevation_t[t];

    // Check all neighbors
    for (const neighbor of mesh.neighbors[t]) {
      if (neighbor === -1) continue;

      if (elevation_t[neighbor] < lowestElevation) {
        lowestNeighbor = neighbor;
        lowestElevation = elevation_t[neighbor];
      }
    }

    downslope_t[t] = lowestNeighbor;
  }

  // Break elevation plateaus/sinks by finding the nearest downslope path
  const queue = new FlatQueue();
  const visited = new Uint8Array(numTriangles);

  for (let t = 0; t < numTriangles; t++) {
    if (downslope_t[t] === -1) {
      // Find a downslope path for this sink
      visited.fill(0);

      queue.clear();
      queue.push(t, 0);

      let pathFound = false;

      while (!pathFound && queue.length > 0) {
        const current = queue.pop();

        if (visited[current]) continue;
        visited[current] = 1;

        // Check all neighbors of the current triangle
        for (const neighbor of mesh.neighbors[current]) {
          if (neighbor === -1 || visited[neighbor]) continue;

          if (downslope_t[neighbor] !== -1) {
            // We found a path to drainage
            downslope_t[t] = neighbor;
            pathFound = true;
            break;
          }

          // Otherwise, continue search
          queue.push(neighbor, elevation_t[neighbor]);
        }
      }
    }
  }

  console.log("Downslope calculation complete");
  return downslope_t;
}

/**
 * Calculate flow accumulation for rivers
 */
export function calculateFlowAccumulation(
  mesh: VoronoiMesh,
  elevation_t: Float32Array,
  rainfall_t: Float32Array,
  downslope_t: Int32Array,
  config: MapConfig
): {
  flow_t: Float32Array;
  riverPaths: RiverPath[];
} {
  console.log("Calculating river flow accumulation");

  try {
    const { numTriangles } = mesh;
    const flow_t = new Float32Array(numTriangles).fill(0);
    const { seaLevel, riverMinFlow, rivers = 0.5 } = config;

    // Initialize flow with rainfall
    for (let t = 0; t < numTriangles; t++) {
      // Land areas receive water from rainfall
      if (elevation_t[t] >= seaLevel) {
        // Rivers intensity parameter scales the overall river size
        flow_t[t] = rainfall_t[t] * rivers;

        // Higher elevations get a little bonus flow (mountain springs)
        const elevationAboveSea = elevation_t[t] - seaLevel;
        if (elevationAboveSea > 0.5) {
          flow_t[t] *= 1 + (elevationAboveSea - 0.5);
        }
      }
    }

    // Sort triangles by elevation (highest to lowest) for proper flow accumulation
    console.log("Sorting triangles by elevation for flow accumulation");
    const trianglesByElevation = Array.from(
      { length: numTriangles },
      (_, i) => i
    ).sort((a, b) => elevation_t[b] - elevation_t[a]);

    // Accumulate flow downstream
    let totalFlow = 0;
    for (const t of trianglesByElevation) {
      const downstream = downslope_t[t];

      if (downstream >= 0 && !mesh.is_boundary_t[t]) {
        // Transfer flow downstream
        flow_t[downstream] += flow_t[t];
        totalFlow += flow_t[t];
      }
    }

    // Create river paths
    const riverPaths: RiverPath[] = [];
    const riverSourceThreshold = 0.1; // Minimum flow to start a river

    // Find significant river sources
    for (let t = 0; t < numTriangles; t++) {
      // Only consider land triangles with significant flow as river sources
      if (
        elevation_t[t] >= seaLevel &&
        flow_t[t] >= riverSourceThreshold &&
        elevation_t[t] > 0.5
      ) {
        // Trace the river path from source to outlet
        const path: number[] = [t];
        let current = t;
        let sourceTriangle = t;
        let isValid = true;

        // Follow the flow downstream
        while (true) {
          const next = downslope_t[current];

          // Stop if we reached a sink or boundary
          if (next < 0 || mesh.is_boundary_t[next]) break;

          // Stop if we reached water or an existing path
          if (elevation_t[next] < seaLevel) break;

          // Check for cycles (prevent infinite loops)
          if (path.includes(next)) {
            isValid = false;
            break;
          }

          // Add to path and continue
          path.push(next);
          current = next;
        }

        if (isValid && path.length > 3) {
          riverPaths.push({
            triangles: path,
            sourceTriangle,
            flow: flow_t[t],
          });
        }
      }
    }

    // Sort rivers by flow for rendering purposes
    riverPaths.sort((a, b) => b.flow - a.flow);

    // Keep only the largest rivers
    const maxRivers = 100; // Limit for performance
    if (riverPaths.length > maxRivers) {
      riverPaths.length = maxRivers;
    }

    console.log(
      `Generated ${riverPaths.length} rivers with min flow ${riverMinFlow}`
    );
    return { flow_t, riverPaths };
  } catch (error) {
    console.error("Error in flow accumulation:", error);
    return {
      flow_t: new Float32Array(mesh.numTriangles),
      riverPaths: [],
    };
  }
}

/**
 * Rasterize climate data to grid
 */
export function rasterizeClimate(
  mesh: VoronoiMesh,
  moisture_t: Float32Array,
  temperature_t: Float32Array,
  width: number,
  height: number
): {
  moisture: number[][];
  temperature: number[][];
} {
  console.log(`Rasterizing climate data to ${width}x${height} grid`);
  const moistureGrid: number[][] = Array(height)
    .fill(0)
    .map(() => Array(width).fill(0));
  const temperatureGrid: number[][] = Array(height)
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

      moistureGrid[y][x] = moisture_t[closestT];
      temperatureGrid[y][x] = temperature_t[closestT];
    }
  }

  return {
    moisture: moistureGrid,
    temperature: temperatureGrid,
  };
}

/**
 * Rasterize river flow to a grid
 */
export function rasterizeRivers(
  mesh: VoronoiMesh,
  riverPaths: RiverPath[],
  width: number,
  height: number,
  config: MapConfig
): number[][] {
  console.log(
    `Rasterizing ${riverPaths.length} river paths to ${width}x${height} grid`
  );
  const riverGrid: number[][] = Array(height)
    .fill(0)
    .map(() => Array(width).fill(0));

  const { riverWidth = 0.2 } = config;

  if (!riverPaths || riverPaths.length === 0) {
    console.log("No river paths to rasterize");
    return riverGrid;
  }

  // For each river path
  for (const { triangles, flow } of riverPaths) {
    if (!triangles || triangles.length < 2) continue;

    // Calculate flow at each point along the river
    // Rivers get wider as they flow downstream (accumulate water)
    for (let i = 0; i < triangles.length; i++) {
      const t = triangles[i];

      // Calculate river width based on flow and position along the river
      // Rivers grow wider downstream (they accumulate flow)
      const positionFactor = i / triangles.length; // 0 at source, 1 at outlet
      const accumulatedFlow = flow * (0.2 + 0.8 * positionFactor);

      // Convert to screen coordinates
      const x = Math.floor(mesh.x_of_t(t));
      const y = Math.floor(mesh.y_of_t(t));

      if (x < 0 || x >= width || y < 0 || y >= height) continue;

      // Calculate river width - logarithmic scale gives better visual appearance
      const scaledWidth = Math.max(
        1,
        Math.log(1 + accumulatedFlow * 10) * riverWidth * 5
      );

      // Draw river at this point with width
      const radius = Math.max(1, Math.ceil(scaledWidth));

      // Draw the river segment
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;

          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

          // Distance from center of river
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist <= scaledWidth) {
            // Falloff function for river edges (higher value towards center)
            const intensity = Math.pow(1 - dist / scaledWidth, 0.8);

            // Update the river grid with the maximum value
            riverGrid[ny][nx] = Math.max(
              riverGrid[ny][nx],
              intensity * scaledWidth
            );
          }
        }
      }
    }
  }

  return riverGrid;
}
