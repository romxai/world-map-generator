/**
 * Map Renderer Module
 * Renders map data to a canvas context with various visual options
 */

import { BiomeType, type MapData } from "./mapgen/types";

// Define biome colors for rendering
const BiomeColors: Record<BiomeType, string> = {
  [BiomeType.OCEAN_DEEP]: "#000080",
  [BiomeType.OCEAN]: "#0077be",
  [BiomeType.OCEAN_SHALLOW]: "#0099cc",
  [BiomeType.BEACH]: "#dfcc74",
  [BiomeType.SCORCHED]: "#555555",
  [BiomeType.BARE]: "#888888",
  [BiomeType.TUNDRA]: "#ddddbb",
  [BiomeType.SNOW]: "#ffffff",
  [BiomeType.TEMPERATE_DESERT]: "#e4e8ca",
  [BiomeType.SUBTROPICAL_DESERT]: "#d2b98b",
  [BiomeType.GRASSLAND]: "#b4c9a9",
  [BiomeType.TEMPERATE_DECIDUOUS_FOREST]: "#a3c789",
  [BiomeType.TEMPERATE_RAIN_FOREST]: "#86b26b",
  [BiomeType.TROPICAL_SEASONAL_FOREST]: "#79c05a",
  [BiomeType.TROPICAL_RAIN_FOREST]: "#338033",
  [BiomeType.SHRUBLAND]: "#c4b29f",
  [BiomeType.TAIGA]: "#ccd4bb",
  [BiomeType.ALPINE]: "#aaaaaa",
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

// Helper function to convert color string to RGB array
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
    : [0, 0, 0];
}

// Helper function to convert RGB array to color string
function rgbToHex(r: number, g: number, b: number): string {
  return `#${Math.round(r).toString(16).padStart(2, "0")}${Math.round(g)
    .toString(16)
    .padStart(2, "0")}${Math.round(b).toString(16).padStart(2, "0")}`;
}

// Helper to blend two colors with alpha
function blendColors(
  baseColor: string,
  overlayColor: string,
  alpha: number
): string {
  const baseRgb = hexToRgb(baseColor);
  const overlayRgb = hexToRgb(overlayColor);

  const r = baseRgb[0] * (1 - alpha) + overlayRgb[0] * alpha;
  const g = baseRgb[1] * (1 - alpha) + overlayRgb[1] * alpha;
  const b = baseRgb[2] * (1 - alpha) + overlayRgb[2] * alpha;

  return rgbToHex(r, g, b);
}

// Helper to calculate hillshade value
function calculateHillshade(
  x: number,
  y: number,
  elevation: number[][],
  width: number,
  height: number,
  lightDir: [number, number, number]
): number {
  if (x <= 0 || y <= 0 || x >= width - 1 || y >= height - 1) {
    return 1.0; // Default value for edges
  }

  // Calculate surface normal using surrounding elevation points
  const z = elevation[y][x];
  const zLeft = elevation[y][x - 1];
  const zRight = elevation[y][x + 1];
  const zUp = elevation[y - 1][x];
  const zDown = elevation[y + 1][x];

  // Scale factor for terrain exaggeration
  const scale = 0.15;

  // Calculate slopes in x and y directions
  const dzdx = (zRight - zLeft) * scale;
  const dzdy = (zDown - zUp) * scale;

  // Surface normal vector
  const normal: [number, number, number] = [-dzdx, -dzdy, 1];

  // Normalize the normal vector
  const length = Math.sqrt(
    normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2]
  );
  normal[0] /= length;
  normal[1] /= length;
  normal[2] /= length;

  // Calculate the dot product of the light direction and normal
  const dotProduct =
    normal[0] * lightDir[0] + normal[1] * lightDir[1] + normal[2] * lightDir[2];

  // Return hillshade value (clamped to 0-1)
  return Math.max(0, Math.min(1, dotProduct));
}

/**
 * Render the map data to a canvas context
 */
export function renderMap(
  ctx: CanvasRenderingContext2D,
  mapData: MapData,
  options: RenderOptions,
  customBiomeColors: Record<BiomeType, string> = BiomeColors
): void {
  const {
    width,
    height,
    elevation,
    moisture,
    temperature,
    biomes,
    rivers,
    mesh,
  } = mapData;

  // Clear the canvas
  ctx.clearRect(0, 0, width, height);

  // Calculate light direction vector from angle
  const lightAngleRad = (options.lightAngle * Math.PI) / 180;
  const lightX = Math.cos(lightAngleRad);
  const lightY = Math.sin(lightAngleRad);
  const lightZ = 0.5; // Height of light source

  // Normalize the light vector
  const lightLength = Math.sqrt(
    lightX * lightX + lightY * lightY + lightZ * lightZ
  );
  const lightDir: [number, number, number] = [
    lightX / lightLength,
    lightY / lightLength,
    lightZ / lightLength,
  ];

  // Create the image data
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;

  // Render the map pixel by pixel
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      let color = "#000000"; // Default black

      // Determine base color based on rendering mode
      if (options.showElevation) {
        // Elevation map
        const elevationValue = elevation[y][x];
        if (elevationValue < 0.4) {
          // Water gradient (deep to shallow)
          const normalizedDepth = elevationValue / 0.4;
          color = blendColors("#000080", "#0099cc", normalizedDepth);
        } else {
          // Land gradient (low to high)
          const normalizedHeight = (elevationValue - 0.4) / 0.6;
          color = blendColors("#8a8a5c", "#ffffff", normalizedHeight);
        }
      } else if (options.showMoisture) {
        // Moisture map (dry to wet)
        const moistureValue = moisture[y][x];
        color = blendColors("#e6d298", "#0077be", moistureValue);
      } else if (options.showTemperature) {
        // Temperature map (cold to hot)
        const temperatureValue = temperature[y][x];
        color = blendColors("#62c0ff", "#ff5f00", temperatureValue);
      } else if (options.showBiomes) {
        // Biome map
        const biomeValue = biomes[y][x];
        color = customBiomeColors[biomeValue];
      }

      // Apply hillshading if enabled
      if (
        options.hillshading &&
        (options.showElevation || options.showBiomes)
      ) {
        const hillshade = calculateHillshade(
          x,
          y,
          elevation,
          width,
          height,
          lightDir
        );

        // Apply ambient + directional lighting
        const lighting = options.ambientLight + hillshade * options.lighting;

        // Convert color to RGB
        const rgb = hexToRgb(color);

        // Apply lighting
        rgb[0] = Math.min(255, rgb[0] * lighting);
        rgb[1] = Math.min(255, rgb[1] * lighting);
        rgb[2] = Math.min(255, rgb[2] * lighting);

        // Convert back to hex
        color = rgbToHex(rgb[0], rgb[1], rgb[2]);
      }

      // Convert final color to RGB for the ImageData
      const rgb = hexToRgb(color);
      data[idx] = rgb[0]; // R
      data[idx + 1] = rgb[1]; // G
      data[idx + 2] = rgb[2]; // B
      data[idx + 3] = 255; // A (fully opaque)
    }
  }

  // Draw the base image
  ctx.putImageData(imageData, 0, 0);

  // Draw rivers if enabled
  if (options.showRivers) {
    ctx.globalCompositeOperation = "source-over";
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (rivers[y][x] > 0) {
          // Draw river segments with varying width based on flow
          const riverWidth = Math.max(
            1,
            Math.sqrt(rivers[y][x]) * 5 * options.outlineStrength
          );
          const elevValue = elevation[y][x];

          // Create a gradient color based on elevation
          const riverColor = blendColors("#0077be", "#8ac7db", elevValue);

          ctx.fillStyle = riverColor;
          ctx.beginPath();
          ctx.arc(x, y, riverWidth / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // Debug: Show Voronoi mesh if enabled
  if (options.showVoronoi && mesh) {
    // Draw Voronoi cells
    ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
    ctx.lineWidth = 0.5;

    // Draw connections between neighboring triangles
    for (let t = 0; t < mesh.numTriangles; t++) {
      const center = mesh.t_center(t);

      if (
        center[0] >= 0 &&
        center[0] < width &&
        center[1] >= 0 &&
        center[1] < height
      ) {
        // Draw connections to neighbors
        for (const neighbor of mesh.neighbors[t]) {
          if (neighbor !== -1) {
            const neighborCenter = mesh.t_center(neighbor);

            ctx.beginPath();
            ctx.moveTo(center[0], center[1]);
            ctx.lineTo(neighborCenter[0], neighborCenter[1]);
            ctx.stroke();
          }
        }

        // Draw center point
        ctx.fillStyle = mesh.isBoundary[t] ? "red" : "black";
        ctx.beginPath();
        ctx.arc(center[0], center[1], 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
