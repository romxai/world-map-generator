"use client";

import React, { useRef, useState, useEffect } from "react";
import { HexColorPicker } from "react-colorful";
import { generateMap, MapConfig, MapData, BiomeType } from "../utils/mapgen";
import { renderMap, RenderOptions } from "../utils/mapRenderer";

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

const defaultMapConfig: MapConfig = {
  seed: Math.random().toString(36).substring(2, 10),
  width: 800,
  height: 600,
  seaLevel: 0.4,
  biomeDensity: 0.8,
  mountainFrequency: 0.3,
  hillFrequency: 0.6,
  islandFrequency: 0.4,
  pointDeviation: 0.45,
  oceanRatio: 0.3,
  jaggedness: 0.6,
  mountainHeight: 0.8,
  windAngleDeg: 45,
  raininess: 0.5,
  rainShadow: 0.7,
  evaporation: 0.5,
  riverWidth: 1.0,
  rivers: 0.5,
  riverMinFlow: 0.02,
  showVoronoi: false,
  lighting: {
    enabled: true,
    azimuth: 315,
    angle: 45,
    intensity: 0.5,
  },
};

const defaultRenderOptions: RenderOptions = {
  showElevation: false,
  showMoisture: false,
  showTemperature: false,
  showBiomes: true,
  showRivers: true,
  hillshading: true,
  showVoronoi: false,
  outlineStrength: 2.0,
  lighting: 0.7,
  ambientLight: 0.5,
  lightAngle: 315,
};

export default function MapGenerator() {
  console.log("MapGenerator component rendering");
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mapConfig, setMapConfig] = useState<MapConfig>({ ...defaultMapConfig });
  const [renderOptions, setRenderOptions] = useState<RenderOptions>({
    ...defaultRenderOptions,
  });
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedBiome, setSelectedBiome] = useState<BiomeType | null>(null);
  const [biomeColors, setBiomeColors] = useState<Record<BiomeType, string>>({
    ...BiomeColors,
  });
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [error, setError] = useState<string | null>(null);

  // Generate a new map whenever the configuration changes
  useEffect(() => {
    console.log("Starting map generation with config:", mapConfig);
    setLoading(true);
    setError(null);
    
    try {
      // Start generation in the next tick to allow UI to update
      setTimeout(() => {
        try {
          console.time('mapGeneration');
          const data = generateMap(mapConfig);
          console.timeEnd('mapGeneration');
          console.log("Map generation complete, data:", {
            width: data.width,
            height: data.height,
            hasElevation: !!data.elevation && data.elevation.length > 0,
            hasMoisture: !!data.moisture && data.moisture.length > 0,
            hasBiomes: !!data.biomes && data.biomes.length > 0,
            hasRivers: !!data.rivers && data.rivers.length > 0,
          });
          
          setMapData(data);
          setLoading(false);
        } catch (err) {
          console.error("Map generation error:", err);
          setError(`Error generating map: ${err.message}`);
          
          // Create empty map data as fallback
          console.log("Creating fallback empty map data");
          setMapData(createEmptyMapData(mapConfig.width, mapConfig.height));
          setLoading(false);
        }
      }, 0);
    } catch (err) {
      console.error("Error in map generation setup:", err);
      setError(`Error setting up map generation: ${err.message}`);
      setLoading(false);
    }
  }, [mapConfig.seed, mapConfig.seaLevel, mapConfig.mountainFrequency, 
      mapConfig.biomeDensity, mapConfig.windAngleDeg, mapConfig.raininess, 
      mapConfig.jaggedness, mapConfig.mountainHeight, mapConfig.rivers]);

  // Render the map whenever map data or render options change
  useEffect(() => {
    if (mapData && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        // Apply transformation for zoom and pan
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(zoom, 0, 0, zoom, pan.x, pan.y);

        // Render the map
        renderMap(ctx, mapData, renderOptions);
      }
    }
  }, [mapData, renderOptions, zoom, pan]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;

    if (type === "number" || type === "range") {
      setMapConfig({
        ...mapConfig,
        [name]: parseFloat(value),
      });
    } else {
      setMapConfig({
        ...mapConfig,
        [name]: value,
      });
    }
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setRenderOptions({
      ...renderOptions,
      [name]: checked,
    });
  };

  const handleBiomeColorChange = (color: string) => {
    if (selectedBiome) {
      const newBiomeColors = {
        ...biomeColors,
        [selectedBiome]: color,
      };

      setBiomeColors(newBiomeColors);

      // Update render if we're showing biomes
      if (renderOptions.showBiomes && mapData) {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.setTransform(zoom, 0, 0, zoom, pan.x, pan.y);
            renderMap(ctx, mapData, renderOptions);
          }
        }
      }
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  };

  const handleCanvasMouseUp = () => {
    setIsPanning(false);
  };

  const handleCanvasWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();

    // Calculate new zoom level
    const delta = -e.deltaY * 0.01;
    const newZoom = Math.max(0.1, Math.min(5, zoom + delta));

    // Get mouse position relative to canvas
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Calculate new pan position to zoom centered on mouse
      const newPan = {
        x: pan.x - mouseX * (newZoom / zoom - 1),
        y: pan.y - mouseY * (newZoom / zoom - 1),
      };

      setZoom(newZoom);
      setPan(newPan);
    }
  };

  const downloadMap = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Create a new canvas for the download to avoid zoom/pan effects
      const downloadCanvas = document.createElement("canvas");
      downloadCanvas.width = mapConfig.width;
      downloadCanvas.height = mapConfig.height;
      const ctx = downloadCanvas.getContext("2d");

      if (ctx && mapData) {
        renderMap(ctx, mapData, renderOptions);

        // Convert to data URL and trigger download
        const dataUrl = downloadCanvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.download = `fantasy-map-${mapConfig.seed}.png`;
        link.href = dataUrl;
        link.click();
      }
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Fantasy World Map Generator</h1>
      
      {error && (
    <div className="flex flex-col md:flex-row w-full min-h-screen bg-gray-900 text-white">
      <div className="flex flex-col w-full md:w-80 p-4 bg-gray-800 overflow-y-auto">
        <h1 className="text-2xl font-bold mb-4">World Map Generator</h1>

        <button
          onClick={generateNewMap}
          disabled={loading}
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 rounded font-bold mb-4 disabled:opacity-50"
        >
          {loading ? "Generating..." : "Generate New Map"}
        </button>

        {/* Collapsible Configuration Sections */}
        <div className="space-y-2">
          {/* World Parameters */}
          <details className="bg-gray-700 rounded p-2" open>
            <summary className="font-bold cursor-pointer">
              World Parameters
            </summary>
            <div className="space-y-2 mt-2">
              <div>
                <label className="block text-sm">Seed</label>
                <div className="flex items-center">
                  <input
                    type="text"
                    name="seed"
                    value={mapConfig.seed}
                    onChange={handleInputChange}
                    className="w-full bg-gray-900 rounded px-2 py-1 text-sm"
                  />
                  <button
                    onClick={() => {
                      const newSeed = Math.random()
                        .toString(36)
                        .substring(2, 15);
                      setMapConfig({
                        ...mapConfig,
                        seed: newSeed,
                      });
                    }}
                    className="ml-2 bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded"
                  >
                    🎲
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm">Width</label>
                <input
                  type="number"
                  name="width"
                  value={mapConfig.width}
                  onChange={handleInputChange}
                  min="256"
                  max="4096"
                  className="w-full bg-gray-900 rounded px-2 py-1 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm">Height</label>
                <input
                  type="number"
                  name="height"
                  value={mapConfig.height}
                  onChange={handleInputChange}
                  min="256"
                  max="4096"
                  className="w-full bg-gray-900 rounded px-2 py-1 text-sm"
                />
              </div>
            </div>
          </details>

          {/* Terrain Parameters */}
          <details className="bg-gray-700 rounded p-2" open>
            <summary className="font-bold cursor-pointer">
              Terrain Parameters
            </summary>
            <div className="space-y-2 mt-2">
              <div>
                <label className="block text-sm">
                  Sea Level: {mapConfig.seaLevel.toFixed(2)}
                </label>
                <input
                  type="range"
                  name="seaLevel"
                  value={mapConfig.seaLevel}
                  onChange={handleInputChange}
                  min="0.1"
                  max="0.7"
                  step="0.01"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm">
                  Mountain Height: {mapConfig.mountainHeight.toFixed(2)}
                </label>
                <input
                  type="range"
                  name="mountainHeight"
                  value={mapConfig.mountainHeight}
                  onChange={handleInputChange}
                  min="0.1"
                  max="1"
                  step="0.01"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm">
                  Roughness: {mapConfig.roughness.toFixed(2)}
                </label>
                <input
                  type="range"
                  name="roughness"
                  value={mapConfig.roughness}
                  onChange={handleInputChange}
                  min="0.2"
                  max="0.8"
                  step="0.01"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm">
                  Continent Size: {mapConfig.continentSize.toFixed(1)}
                </label>
                <input
                  type="range"
                  name="continentSize"
                  value={mapConfig.continentSize}
                  onChange={handleInputChange}
                  min="0.5"
                  max="5"
                  step="0.1"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm">
                  Island Frequency: {mapConfig.islandFactor.toFixed(1)}
                </label>
                <input
                  type="range"
                  name="islandFactor"
                  value={mapConfig.islandFactor}
                  onChange={handleInputChange}
                  min="0"
                  max="2"
                  step="0.05"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm">
                  Mountain Jaggedness: {mapConfig.mountainJaggedness.toFixed(2)}
                </label>
                <input
                  type="range"
                  name="mountainJaggedness"
                  value={mapConfig.mountainJaggedness}
                  onChange={handleInputChange}
                  min="0"
                  max="1"
                  step="0.01"
                  className="w-full"
                />
              </div>
            </div>
          </details>

          {/* Climate Parameters */}
          <details className="bg-gray-700 rounded p-2">
            <summary className="font-bold cursor-pointer">
              Climate Parameters
            </summary>
            <div className="space-y-2 mt-2">
              <div>
                <label className="block text-sm">
                  Wind Angle: {mapConfig.windAngleDeg}°
                </label>
                <input
                  type="range"
                  name="windAngleDeg"
                  value={mapConfig.windAngleDeg}
                  onChange={handleInputChange}
                  min="0"
                  max="360"
                  step="5"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm">
                  Raininess: {mapConfig.raininess.toFixed(2)}
                </label>
                <input
                  type="range"
                  name="raininess"
                  value={mapConfig.raininess}
                  onChange={handleInputChange}
                  min="0.1"
                  max="2"
                  step="0.05"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm">
                  Rain Shadow: {mapConfig.rainShadow.toFixed(2)}
                </label>
                <input
                  type="range"
                  name="rainShadow"
                  value={mapConfig.rainShadow}
                  onChange={handleInputChange}
                  min="0.1"
                  max="1"
                  step="0.05"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm">
                  Evaporation: {mapConfig.evaporation.toFixed(2)}
                </label>
                <input
                  type="range"
                  name="evaporation"
                  value={mapConfig.evaporation}
                  onChange={handleInputChange}
                  min="0"
                  max="1"
                  step="0.05"
                  className="w-full"
                />
              </div>
            </div>
          </details>

          {/* River Parameters */}
          <details className="bg-gray-700 rounded p-2">
            <summary className="font-bold cursor-pointer">
              River Parameters
            </summary>
            <div className="space-y-2 mt-2">
              <div>
                <label className="block text-sm">
                  River Amount: {mapConfig.rivers?.toFixed(2) || "0.00"}
                </label>
                <input
                  type="range"
                  name="rivers"
                  value={mapConfig.rivers || 0.5}
                  onChange={handleInputChange}
                  min="0"
                  max="2"
                  step="0.05"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm">
                  River Min Flow: {mapConfig.riverMinFlow.toFixed(3)}
                </label>
                <input
                  type="range"
                  name="riverMinFlow"
                  value={mapConfig.riverMinFlow}
                  onChange={handleInputChange}
                  min="0.001"
                  max="0.1"
                  step="0.001"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm">
                  River Width: {mapConfig.riverWidth.toFixed(2)}
                </label>
                <input
                  type="range"
                  name="riverWidth"
                  value={mapConfig.riverWidth}
                  onChange={handleInputChange}
                  min="0.05"
                  max="1"
                  step="0.05"
                  className="w-full"
                />
              </div>
            </div>
          </details>

          {/* Density Parameters */}
          <details className="bg-gray-700 rounded p-2">
            <summary className="font-bold cursor-pointer">
              Detail Parameters
            </summary>
            <div className="space-y-2 mt-2">
              <div>
                <label className="block text-sm">
                  Biome Density: {mapConfig.biomeDensity.toFixed(2)}
                </label>
                <input
                  type="range"
                  name="biomeDensity"
                  value={mapConfig.biomeDensity}
                  onChange={handleInputChange}
                  min="0.1"
                  max="2"
                  step="0.05"
                  className="w-full"
                />
              </div>
            </div>
          </details>

          {/* Rendering Options */}
          <details className="bg-gray-700 rounded p-2" open>
            <summary className="font-bold cursor-pointer">
              Rendering Options
            </summary>
            <div className="space-y-2 mt-2">
              <div className="flex flex-wrap gap-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="showElevation"
                    checked={renderOptions.showElevation}
                    onChange={handleCheckboxChange}
                    className="mr-1"
                  />
                  <span className="text-sm">Elevation</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="showMoisture"
                    checked={renderOptions.showMoisture}
                    onChange={handleCheckboxChange}
                    className="mr-1"
                  />
                  <span className="text-sm">Moisture</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="showTemperature"
                    checked={renderOptions.showTemperature}
                    onChange={handleCheckboxChange}
                    className="mr-1"
                  />
                  <span className="text-sm">Temperature</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="showBiomes"
                    checked={renderOptions.showBiomes}
                    onChange={handleCheckboxChange}
                    className="mr-1"
                  />
                  <span className="text-sm">Biomes</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="showRivers"
                    checked={renderOptions.showRivers}
                    onChange={handleCheckboxChange}
                    className="mr-1"
                  />
                  <span className="text-sm">Rivers</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="hillshading"
                    checked={renderOptions.hillshading}
                    onChange={handleCheckboxChange}
                    className="mr-1"
                  />
                  <span className="text-sm">Hillshading</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="showVoronoi"
                    checked={renderOptions.showVoronoi}
                    onChange={handleCheckboxChange}
                    className="mr-1"
                  />
                  <span className="text-sm">Show Voronoi</span>
                </label>
              </div>

              <div>
                <label className="block text-sm">
                  Light Angle: {renderOptions.lightAngle}°
                </label>
                <input
                  type="range"
                  name="lightAngle"
                  value={renderOptions.lightAngle}
                  onChange={(e) =>
                    setRenderOptions({
                      ...renderOptions,
                      lightAngle: parseFloat(e.target.value),
                    })
                  }
                  min="0"
                  max="360"
                  step="5"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm">
                  Lighting: {renderOptions.lighting.toFixed(2)}
                </label>
                <input
                  type="range"
                  name="lighting"
                  value={renderOptions.lighting}
                  onChange={(e) =>
                    setRenderOptions({
                      ...renderOptions,
                      lighting: parseFloat(e.target.value),
                    })
                  }
                  min="0"
                  max="1.5"
                  step="0.05"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm">
                  Ambient Light: {renderOptions.ambientLight.toFixed(2)}
                </label>
                <input
                  type="range"
                  name="ambientLight"
                  value={renderOptions.ambientLight}
                  onChange={(e) =>
                    setRenderOptions({
                      ...renderOptions,
                      ambientLight: parseFloat(e.target.value),
                    })
                  }
                  min="0.2"
                  max="1"
                  step="0.05"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm">
                  Outline Strength: {renderOptions.outlineStrength.toFixed(2)}
                </label>
                <input
                  type="range"
                  name="outlineStrength"
                  value={renderOptions.outlineStrength}
                  onChange={(e) =>
                    setRenderOptions({
                      ...renderOptions,
                      outlineStrength: parseFloat(e.target.value),
                    })
                  }
                  min="0.5"
                  max="4"
                  step="0.1"
                  className="w-full"
                />
              </div>
            </div>
          </details>

          {/* Biome Colors (Collapsible) */}
          <details className="bg-gray-700 rounded p-2">
            <summary className="font-bold cursor-pointer">Biome Colors</summary>
            <div className="mt-2">
              <div className="grid grid-cols-2 gap-1">
                {Object.keys(BiomeColors).map((biome) => (
                  <button
                    key={biome}
                    onClick={() => setSelectedBiome(biome as BiomeType)}
                    className="flex items-center text-left py-1 px-2 rounded hover:bg-gray-600"
                  >
                    <div
                      className="w-4 h-4 mr-2 rounded"
                      style={{
                        backgroundColor: biomeColors[biome as BiomeType],
                      }}
                    ></div>
                    <span className="text-xs">{biome.replace(/_/g, " ")}</span>
                  </button>
                ))}
              </div>

              {selectedBiome && (
                <div className="mt-2">
                  <h4 className="text-sm font-bold">
                    {selectedBiome.replace(/_/g, " ")}
                  </h4>
                  <div className="mt-1">
                    <HexColorPicker
                      color={biomeColors[selectedBiome]}
                      onChange={handleBiomeColorChange}
                    />
                  </div>
                </div>
              )}
            </div>
          </details>

          {/* Map Controls */}
          <details className="bg-gray-700 rounded p-2">
            <summary className="font-bold cursor-pointer">Map Controls</summary>
            <div className="space-y-2 mt-2">
              <div>
                <label className="block text-sm">
                  Zoom: {zoom.toFixed(1)}x
                </label>
                <input
                  type="range"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  min="0.2"
                  max="4"
                  step="0.1"
                  className="w-full"
                />
              </div>

              <div className="flex justify-center gap-2">
                <button
                  onClick={() => setPan({ x: 0, y: 0 })}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded"
                >
                  Reset View
                </button>

                <button
                  onClick={downloadMap}
                  className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1 rounded"
                >
                  Download
                </button>
              </div>
            </div>
          </details>
        </div>
      </div>

      <div className="flex-1 bg-gray-900 p-4 flex justify-center items-center overflow-hidden">
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={mapConfig.width}
            height={mapConfig.height}
            className="border border-gray-700 cursor-move"
            style={{
              maxWidth: "100%",
              maxHeight: "calc(100vh - 2rem)",
              objectFit: "contain",
            }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onWheel={handleCanvasWheel}
          ></canvas>

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
              <div className="text-white text-lg">Generating map...</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
