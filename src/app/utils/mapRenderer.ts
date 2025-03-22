import { MapData, BiomeColors, BiomeType } from "./mapGenerator";

export interface RenderOptions {
  showElevation: boolean;
  showMoisture: boolean;
  showTemperature: boolean;
  showBiomes: boolean;
  showRivers: boolean;
  hillshading: boolean;
  pixelated: boolean;
}

export const renderMap = (
  ctx: CanvasRenderingContext2D,
  mapData: MapData,
  options: RenderOptions
): void => {
  const { elevation, moisture, temperature, biomes, rivers } = mapData;
  const width = elevation[0].length;
  const height = elevation.length;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Create ImageData for pixel manipulation
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;

  // Fill pixel data
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;

      if (options.showElevation) {
        // Render elevation map
        const e = elevation[y][x];
        const gray = Math.floor(e * 255);
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
        data[i + 3] = 255;
      } else if (options.showMoisture) {
        // Render moisture map
        const m = moisture[y][x];
        const blue = Math.floor(m * 255);
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = blue;
        data[i + 3] = 255;
      } else if (options.showTemperature) {
        // Render temperature map
        const t = temperature[y][x];
        const r = Math.floor(t * 255);
        const g = Math.floor((1 - Math.abs(t - 0.5) * 2) * 255);
        const b = Math.floor((1 - t) * 255);
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = 255;
      } else if (options.showBiomes) {
        // Render biome map
        const biome = biomes[y][x] as BiomeType;
        const color = hexToRgb(BiomeColors[biome]);

        if (color) {
          data[i] = color.r;
          data[i + 1] = color.g;
          data[i + 2] = color.b;
          data[i + 3] = 255;
        }

        // Apply hillshading if enabled
        if (
          options.hillshading &&
          y > 0 &&
          x > 0 &&
          y < height - 1 &&
          x < width - 1
        ) {
          const nx = (elevation[y][x + 1] - elevation[y][x - 1]) * 2;
          const ny = (elevation[y + 1][x] - elevation[y - 1][x]) * 2;
          const nz = 1;
          const len = Math.sqrt(nx * nx + ny * ny + nz * nz);

          // Light from the top-left
          const light = { x: -1, y: -1, z: 1 };
          const lightLen = Math.sqrt(
            light.x * light.x + light.y * light.y + light.z * light.z
          );

          // Normalize vectors
          const nx_norm = nx / len;
          const ny_norm = ny / len;
          const nz_norm = nz / len;

          const lx_norm = light.x / lightLen;
          const ly_norm = light.y / lightLen;
          const lz_norm = light.z / lightLen;

          // Calculate dot product for shading
          const dot = nx_norm * lx_norm + ny_norm * ly_norm + nz_norm * lz_norm;
          const shade = Math.min(Math.max(0.6 + dot * 0.4, 0.6), 1.0);

          // Apply shading
          data[i] = Math.floor(data[i] * shade);
          data[i + 1] = Math.floor(data[i + 1] * shade);
          data[i + 2] = Math.floor(data[i + 2] * shade);
        }
      }
    }
  }

  // Put the image data on the canvas
  ctx.putImageData(imageData, 0, 0);

  // Draw rivers
  if (options.showRivers) {
    ctx.strokeStyle = "#0077ff";
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let i = 0; i < rivers.length; i++) {
      const { x, y } = rivers[i];
      if (i === 0 || i % 5 === 0) {
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
  }

  // If pixelated rendering is requested
  if (options.pixelated) {
    // Canvas rendering is already pixelated by default
    // This is just a placeholder in case we want to add special handling
  }
};

// Helper function to convert hex color to RGB
const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
};
