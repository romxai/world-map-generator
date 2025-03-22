"use client";

import React, { useRef, useState, useEffect } from "react";
import { HexColorPicker } from "react-colorful";
import {
  generateMap,
  MapConfig,
  MapData,
  BiomeType,
  BiomeColors,
} from "../utils/mapGenerator";
import { renderMap, RenderOptions } from "../utils/mapRenderer";

const defaultMapConfig: MapConfig = {
  seed: Math.random().toString(36).substring(2, 15),
  width: 1024,
  height: 768,
  seaLevel: 0.4,
  mountainHeight: 0.7,
  roughness: 0.5,
  rivers: 0.5,
  biomeDensity: 0.6,
  continentSize: 2,
  islandFrequency: 8,
};

const defaultRenderOptions: RenderOptions = {
  showElevation: false,
  showMoisture: false,
  showTemperature: false,
  showBiomes: true,
  showRivers: true,
  hillshading: true,
  pixelated: false,
};

export default function MapGenerator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mapConfig, setMapConfig] = useState<MapConfig>({
    ...defaultMapConfig,
  });
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

  // Generate a new map whenever the configuration changes
  useEffect(() => {
    if (!loading) {
      generateNewMap();
    }
  }, []);

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

  const generateNewMap = async () => {
    setLoading(true);

    // Use setTimeout to allow UI to update before heavy computation
    setTimeout(() => {
      try {
        const newMapData = generateMap(mapConfig);
        setMapData(newMapData);
      } catch (error) {
        console.error("Error generating map:", error);
      } finally {
        setLoading(false);
      }
    }, 10);
  };

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
    <div className="flex flex-col lg:flex-row w-full gap-4 p-4">
      {/* Map Canvas */}
      <div className="flex-grow relative border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden h-[70vh]">
        <canvas
          ref={canvasRef}
          width={mapConfig.width}
          height={mapConfig.height}
          className="w-full h-full object-contain"
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          onWheel={handleCanvasWheel}
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="text-white text-2xl font-bold">
              Generating Map...
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-col space-y-4 w-full lg:w-80 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <h2 className="text-xl font-bold">Map Settings</h2>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-sm">Seed:</span>
            <input
              type="text"
              name="seed"
              value={mapConfig.seed}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 dark:bg-gray-700 dark:border-gray-600"
            />
          </label>

          <label className="block">
            <span className="text-sm">Sea Level:</span>
            <input
              type="range"
              name="seaLevel"
              min="0.1"
              max="0.7"
              step="0.01"
              value={mapConfig.seaLevel}
              onChange={handleInputChange}
              className="mt-1 block w-full"
            />
            <span className="text-xs">{mapConfig.seaLevel.toFixed(2)}</span>
          </label>

          <label className="block">
            <span className="text-sm">Mountains:</span>
            <input
              type="range"
              name="mountainHeight"
              min="0.1"
              max="2"
              step="0.1"
              value={mapConfig.mountainHeight}
              onChange={handleInputChange}
              className="mt-1 block w-full"
            />
            <span className="text-xs">
              {mapConfig.mountainHeight.toFixed(1)}
            </span>
          </label>

          <label className="block">
            <span className="text-sm">Roughness:</span>
            <input
              type="range"
              name="roughness"
              min="0.1"
              max="0.9"
              step="0.05"
              value={mapConfig.roughness}
              onChange={handleInputChange}
              className="mt-1 block w-full"
            />
            <span className="text-xs">{mapConfig.roughness.toFixed(2)}</span>
          </label>

          <label className="block">
            <span className="text-sm">Rivers:</span>
            <input
              type="range"
              name="rivers"
              min="0"
              max="2"
              step="0.1"
              value={mapConfig.rivers}
              onChange={handleInputChange}
              className="mt-1 block w-full"
            />
            <span className="text-xs">{mapConfig.rivers.toFixed(1)}</span>
          </label>

          <label className="block">
            <span className="text-sm">Continent Size:</span>
            <input
              type="range"
              name="continentSize"
              min="1"
              max="5"
              step="0.2"
              value={mapConfig.continentSize}
              onChange={handleInputChange}
              className="mt-1 block w-full"
            />
            <span className="text-xs">
              {mapConfig.continentSize.toFixed(1)}
            </span>
          </label>

          <label className="block">
            <span className="text-sm">Island Frequency:</span>
            <input
              type="range"
              name="islandFrequency"
              min="0"
              max="20"
              step="1"
              value={mapConfig.islandFrequency}
              onChange={handleInputChange}
              className="mt-1 block w-full"
            />
            <span className="text-xs">
              {mapConfig.islandFrequency.toFixed(0)}
            </span>
          </label>
        </div>

        <button
          onClick={generateNewMap}
          disabled={loading}
          className="py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {loading ? "Generating..." : "Generate New Map"}
        </button>

        <button
          onClick={downloadMap}
          disabled={!mapData || loading}
          className="py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
        >
          Download Map
        </button>

        <hr className="border-gray-300 dark:border-gray-700" />

        <h3 className="text-lg font-semibold">Display Options</h3>

        <div className="space-y-2">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              name="showBiomes"
              checked={renderOptions.showBiomes}
              onChange={handleCheckboxChange}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span>Show Biomes</span>
          </label>

          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              name="showElevation"
              checked={renderOptions.showElevation}
              onChange={handleCheckboxChange}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span>Show Elevation</span>
          </label>

          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              name="showMoisture"
              checked={renderOptions.showMoisture}
              onChange={handleCheckboxChange}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span>Show Moisture</span>
          </label>

          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              name="showTemperature"
              checked={renderOptions.showTemperature}
              onChange={handleCheckboxChange}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span>Show Temperature</span>
          </label>

          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              name="showRivers"
              checked={renderOptions.showRivers}
              onChange={handleCheckboxChange}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span>Show Rivers</span>
          </label>

          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              name="hillshading"
              checked={renderOptions.hillshading}
              onChange={handleCheckboxChange}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span>Hill Shading</span>
          </label>
        </div>

        <hr className="border-gray-300 dark:border-gray-700" />

        <h3 className="text-lg font-semibold">Biome Colors</h3>

        <div className="grid grid-cols-2 gap-2 overflow-y-auto max-h-48">
          {Object.entries(BiomeType).map(([key, value]) => (
            <button
              key={key}
              onClick={() => setSelectedBiome(value)}
              className={`flex items-center p-1 text-sm rounded ${
                selectedBiome === value ? "ring-2 ring-indigo-500" : ""
              }`}
            >
              <div
                className="w-4 h-4 mr-1 rounded-sm"
                style={{ backgroundColor: biomeColors[value] }}
              />
              <span>{key.replace(/_/g, " ")}</span>
            </button>
          ))}
        </div>

        {selectedBiome && (
          <div className="mt-2">
            <h4 className="text-sm font-semibold mb-1">
              {selectedBiome.replace(/_/g, " ")}
            </h4>
            <HexColorPicker
              color={biomeColors[selectedBiome]}
              onChange={handleBiomeColorChange}
              className="w-full max-w-xs"
            />
          </div>
        )}
      </div>
    </div>
  );
}
