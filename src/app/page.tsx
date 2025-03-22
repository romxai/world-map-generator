import MapGenerator from "./components/MapGenerator";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-indigo-800 text-white p-4">
        <h1 className="text-2xl font-bold">Fantasy World Map Generator</h1>
        <p className="text-sm">
          Create beautiful procedurally generated maps with customizable
          terrain, biomes, and more
        </p>
      </header>

      <main className="flex-grow p-2 md:p-4">
        <MapGenerator />
      </main>

      <footer className="bg-gray-100 dark:bg-gray-800 p-4 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>
          Built with Next.js and procedural generation techniques. Inspired by{" "}
          <a
            className="text-indigo-500 hover:underline"
            href="https://github.com/redblobgames/mapgen4"
            target="_blank"
            rel="noopener noreferrer"
          >
            mapgen4
          </a>{" "}
          and{" "}
          <a
            className="text-indigo-500 hover:underline"
            href="https://github.com/Azgaar/Fantasy-Map-Generator"
            target="_blank"
            rel="noopener noreferrer"
          >
            Fantasy Map Generator
          </a>
          .
        </p>
      </footer>
    </div>
  );
}
