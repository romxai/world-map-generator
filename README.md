# Fantasy World Map Generator

A Next.js application for generating high-resolution, detailed fantasy maps with procedural generation techniques. Create beautiful maps with customizable terrain, biomes, rivers, mountains, oceans, islands, and more.

![Fantasy Map Generator](https://github.com/username/world-map-generator/raw/main/screenshot.png)

## Features

- **Procedurally Generated Maps**: Create unique fantasy maps with each generation
- **Seed Control**: Reuse or share seeds to recreate the same map
- **High Resolution**: Generate detailed maps at high resolutions (1024x768 default, can be customized)
- **Interactive Controls**: Adjust parameters in real-time:
  - Sea level
  - Mountain height
  - Terrain roughness
  - River density
  - Continent size
  - Island frequency
- **Biome Visualization**: Realistic biome placement based on elevation, moisture, and temperature
- **Multiple View Modes**:
  - Biome view
  - Elevation view
  - Moisture view
  - Temperature view
- **Interactive Features**:
  - Zoom and pan
  - Customize biome colors
  - Hillshading for 3D effect
- **Export**: Download maps as PNG images

## Technologies Used

- **Next.js**: React framework for the web application
- **TypeScript**: For type-safe code
- **Simplex Noise**: For natural-looking terrain generation
- **React Colorful**: For color picking interface
- **Tailwind CSS**: For styling
- **Canvas API**: For map rendering

## How It Works

The map generation process follows these steps:

1. **Base Terrain Generation**: Using multiple octaves of Simplex noise to create a heightmap
2. **Moisture & Temperature Calculation**: Creating climate data based on elevation and position
3. **River Formation**: Simulating water flow from high to low elevation
4. **Biome Assignment**: Determining biomes based on elevation, moisture, and temperature
5. **Rendering**: Visualizing the data using the HTML Canvas API

## Inspiration

This project was inspired by:

- [mapgen4](https://github.com/redblobgames/mapgen4) by Red Blob Games
- [Fantasy Map Generator](https://github.com/Azgaar/Fantasy-Map-Generator) by Azgaar

## Getting Started

### Prerequisites

- Node.js (v14.0.0 or higher)
- npm or yarn

### Installation

1. Clone the repository:

   ```
   git clone https://github.com/username/world-map-generator.git
   cd world-map-generator
   ```

2. Install dependencies:

   ```
   npm install
   # or
   yarn install
   ```

3. Start the development server:

   ```
   npm run dev
   # or
   yarn dev
   ```

4. Open your browser and navigate to [http://localhost:3000](http://localhost:3000)

## Usage

1. Adjust the parameters in the control panel to customize your map
2. Click the "Generate New Map" button to create a new map with the current settings
3. Use the mouse wheel to zoom in/out and drag to pan around the map
4. Toggle different view modes to see different aspects of your world
5. Click the "Download Map" button to save your creation as a PNG image

## License

This project is licensed under the MIT License - see the LICENSE file for details.
