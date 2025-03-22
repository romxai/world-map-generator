/*
 * Mesh Construction Module
 * Creates a Voronoi mesh from a set of points
 */

import Delaunator from "delaunator";
import { type Point, type PointsData, type VoronoiMesh } from "./types";

/**
 * Create a Voronoi mesh from a set of points
 */
export function createMesh(
  pointsData: PointsData,
  width: number,
  height: number
): VoronoiMesh {
  console.log("Creating mesh from points data");
  console.log(
    `Input: ${pointsData.points.length} points, width: ${width}, height: ${height}`
  );

  try {
    // Extract x,y coordinates for Delaunator
    const flatPoints: number[] = [];
    for (const point of pointsData.points) {
      flatPoints.push(point.x, point.y);
    }

    console.log(`Extracted ${flatPoints.length / 2} point coordinates`);

    // Create Delaunay triangulation
    const delaunay = new Delaunator(flatPoints);
    console.log(
      `Created Delaunay triangulation with ${
        delaunay.triangles.length / 3
      } triangles`
    );

    // Extract the triangulation data
    const numPoints = pointsData.points.length;
    const numTriangles = delaunay.triangles.length / 3;
    const numHalfedges = delaunay.halfedges.length;

    // Create array to track if a triangle is on the boundary
    const is_boundary_t = new Uint8Array(numTriangles);

    // Create array to store triangle neighbors
    const neighbors: number[][] = Array(numTriangles)
      .fill(null)
      .map(() => [-1, -1, -1]); // Initialize with -1 (no neighbor)

    console.log(
      `Analyzing ${numTriangles} triangles for neighbors and boundaries`
    );

    // Compute triangle neighbors and boundary status
    for (let e = 0; e < numHalfedges; e++) {
      const t = Math.floor(e / 3); // triangle of this halfedge
      const j = e % 3; // edge index within triangle
      const opposite = delaunay.halfedges[e];

      if (opposite >= 0) {
        // If there's an opposite halfedge, this is an interior edge
        const oppositeTriangle = Math.floor(opposite / 3);
        neighbors[t][j] = oppositeTriangle;
      } else {
        // No opposite means this is a boundary edge
        is_boundary_t[t] = 1;
      }
    }

    // Triangle centers cache
    const triangleCenters: Point[] = [];
    for (let t = 0; t < numTriangles; t++) {
      const centerPoint = calculateTriangleCenter(
        t,
        delaunay.triangles,
        flatPoints
      );
      triangleCenters.push(centerPoint);
    }

    // Create mesh object
    const mesh: VoronoiMesh = {
      // Core geometry
      points: new Float32Array(flatPoints),
      triangles: delaunay.triangles,
      halfedges: delaunay.halfedges,
      numPoints,
      numTriangles,
      numHalfedges,

      // Mesh analysis
      is_boundary_t,
      neighbors,
      width,
      height,

      // Accessor methods
      x_of_t: (t: number): number => {
        return triangleCenters[t].x;
      },

      y_of_t: (t: number): number => {
        return triangleCenters[t].y;
      },

      t_center: (t: number): Point => {
        return triangleCenters[t];
      },
    };

    console.log(
      `Mesh creation complete: ${numPoints} points, ${numTriangles} triangles`
    );
    console.log(
      `Boundary triangles: ${is_boundary_t.reduce((sum, val) => sum + val, 0)}`
    );

    return mesh;
  } catch (error) {
    console.error("Error creating mesh:", error);
    throw new Error(`Failed to create mesh: ${error.message}`);
  }
}

/**
 * Calculate the center point of a triangle
 */
function calculateTriangleCenter(
  t: number,
  triangles: Uint32Array,
  points: number[]
): Point {
  const i = t * 3;
  const p0 = triangles[i] * 2;
  const p1 = triangles[i + 1] * 2;
  const p2 = triangles[i + 2] * 2;

  const x = (points[p0] + points[p1] + points[p2]) / 3;
  const y = (points[p0 + 1] + points[p1 + 1] + points[p2 + 1]) / 3;

  return { x, y };
}
