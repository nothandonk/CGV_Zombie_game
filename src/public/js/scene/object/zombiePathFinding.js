import * as THREE from "three";

class NavigationMesh {
    constructor(world) {
        this.world = world;
        this.grid = [];
        this.nodeSize = 5; // Size of each navigation node
        this.heightTolerance = 2; // Maximum walkable height difference
        this.obstacles = new Set(); // Store processed obstacles
        this.initialize();
    }

    initialize() {
        // Process and cache all obstacles first
        this.processSceneObstacles();
        
        // Create a grid based on the world size
        const worldSize = 1000; // Adjust based on your world size
        const gridSize = Math.ceil(worldSize / this.nodeSize);
        
        for (let x = 0; x < gridSize; x++) {
            this.grid[x] = [];
            for (let z = 0; z < gridSize; z++) {
                const worldX = x * this.nodeSize - worldSize / 2;
                const worldZ = z * this.nodeSize - worldSize / 2;
                
                // Check if position is walkable considering obstacles and terrain
                const isWalkable = this.isPositionWalkable(worldX, worldZ);
                
                this.grid[x][z] = {
                    x: worldX,
                    z: worldZ,
                    isWalkable,
                    f: 0,
                    g: 0,
                    h: 0,
                    parent: null
                };
            }
        }

        // Optional: Visualize the navigation mesh for debugging
        if (this.world.debug) {
            this.visualizeNavMesh();
        }
    }

    processSceneObstacles() {
        // Clear existing obstacles
        this.obstacles.clear();

        // Process all objects that should be considered for collision
        for (const object of this.world.objectsToCheck) {
            if (!object.boundingBox) {
                object.boundingBox = new THREE.Box3().setFromObject(object);
            }
            
            // Store relevant obstacle data
            const obstacle = {
                box: object.boundingBox.clone(),
                center: new THREE.Vector3(),
                size: new THREE.Vector3()
            };
            
            obstacle.box.getCenter(obstacle.center);
            obstacle.box.getSize(obstacle.size);
            
            this.obstacles.add(obstacle);
        }
    }

    isPositionWalkable(x, z) {
        // Get terrain height at position
        const terrainY = this.world.getTerrainHeight(x, z);
        
        // Create a test box for the zombie at this position
        const testBox = new THREE.Box3();
        const zombieHeight = 30; // Adjust based on your zombie model height
        const zombieRadius = 5; // Adjust based on your zombie model width
        
        const boxSize = new THREE.Vector3(
            zombieRadius * 2,
            zombieHeight,
            zombieRadius * 2
        );
        
        const boxCenter = new THREE.Vector3(
            x,
            terrainY + zombieHeight / 2,
            z
        );
        
        testBox.setFromCenterAndSize(boxCenter, boxSize);

        // Check terrain slope
        const slopeTestPoints = [
            { dx: this.nodeSize/2, dz: 0 },
            { dx: -this.nodeSize/2, dz: 0 },
            { dx: 0, dz: this.nodeSize/2 },
            { dx: 0, dz: -this.nodeSize/2 }
        ];

        for (const point of slopeTestPoints) {
            const neighborY = this.world.getTerrainHeight(
                x + point.dx,
                z + point.dz
            );
            
            if (Math.abs(neighborY - terrainY) > this.heightTolerance) {
                return false; // Too steep
            }
        }

        // Check collision with obstacles
        for (const obstacle of this.obstacles) {
            if (testBox.intersectsBox(obstacle.box)) {
                return false;
            }

            // Check for narrow passages
            const distanceToObstacle = boxCenter.distanceTo(obstacle.center);
            const minRequiredSpace = zombieRadius + 2; // Add some buffer space

            if (distanceToObstacle < minRequiredSpace) {
                return false; // Too close to obstacle
            }
        }

        return true;
    }

    getNeighbors(node) {
        const neighbors = [];
        const directions = [
            // Cardinal directions
            { x: -1, z: 0, cost: 1 },
            { x: 1, z: 0, cost: 1 },
            { x: 0, z: -1, cost: 1 },
            { x: 0, z: 1, cost: 1 },
            // Diagonal directions
            { x: -1, z: -1, cost: Math.SQRT2 },
            { x: -1, z: 1, cost: Math.SQRT2 },
            { x: 1, z: -1, cost: Math.SQRT2 },
            { x: 1, z: 1, cost: Math.SQRT2 }
        ];

        const worldSize = 1000; // Should match your initialization
        
        for (const dir of directions) {
            const gridX = Math.floor((node.x + worldSize/2) / this.nodeSize) + dir.x;
            const gridZ = Math.floor((node.z + worldSize/2) / this.nodeSize) + dir.z;
            
            if (gridX >= 0 && gridX < this.grid.length &&
                gridZ >= 0 && gridZ < this.grid[0].length) {
                
                const neighbor = this.grid[gridX][gridZ];
                
                // Check if diagonal movement is possible (no corner cutting)
                if (Math.abs(dir.x) === 1 && Math.abs(dir.z) === 1) {
                    const cardinalNeighbor1 = this.grid[gridX][Math.floor((node.z + worldSize/2) / this.nodeSize)];
                    const cardinalNeighbor2 = this.grid[Math.floor((node.x + worldSize/2) / this.nodeSize)][gridZ];
                    
                    if (!cardinalNeighbor1.isWalkable || !cardinalNeighbor2.isWalkable) {
                        continue; // Can't cut corners
                    }
                }
                
                if (neighbor.isWalkable) {
                    // Add movement cost based on terrain and distance
                    const terrainDiff = Math.abs(
                        this.world.getTerrainHeight(neighbor.x, neighbor.z) -
                        this.world.getTerrainHeight(node.x, node.z)
                    );
                    
                    neighbor.movementCost = dir.cost * (1 + terrainDiff / this.heightTolerance);
                    neighbors.push(neighbor);
                }
            }
        }
        
        return neighbors;
    }

    visualizeNavMesh() {
        // Remove existing visualization if any
        if (this.debugMesh) {
            this.world.scene.remove(this.debugMesh);
        }

        // Create geometry for walkable areas
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const colors = [];

        for (let x = 0; x < this.grid.length; x++) {
            for (let z = 0; z < this.grid[x].length; z++) {
                const node = this.grid[x][z];
                const y = this.world.getTerrainHeight(node.x, node.z) + 0.1; // Slightly above terrain
                
                // Create a square for each walkable node
                if (node.isWalkable) {
                    const halfSize = this.nodeSize / 2;
                    
                    // Create two triangles for the square
                    vertices.push(
                        node.x - halfSize, y, node.z - halfSize,
                        node.x + halfSize, y, node.z - halfSize,
                        node.x - halfSize, y, node.z + halfSize,
                        
                        node.x + halfSize, y, node.z - halfSize,
                        node.x + halfSize, y, node.z + halfSize,
                        node.x - halfSize, y, node.z + halfSize
                    );

                    // Add colors (green for walkable)
                    for (let i = 0; i < 6; i++) {
                        colors.push(0, 1, 0, 0.5); // Semi-transparent green
                    }
                }
            }
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));

        const material = new THREE.MeshBasicMaterial({
            vertexColors: true,
            transparent: true,
            side: THREE.DoubleSide
        });

        this.debugMesh = new THREE.Mesh(geometry, material);
        this.world.scene.add(this.debugMesh);
    }
}

class PathFinder {
    constructor(navMesh) {
        this.navMesh = navMesh;
    }

    findPath(startPos, targetPos) {
        // Convert world positions to grid coordinates
        const startNode = this.getClosestNode(startPos);
        const targetNode = this.getClosestNode(targetPos);
        
        if (!startNode || !targetNode || !startNode.isWalkable || !targetNode.isWalkable) {
            return null;
        }

        const openSet = [startNode];
        const closedSet = new Set();
        
        startNode.g = 0;
        startNode.h = this.heuristic(startNode, targetNode);
        startNode.f = startNode.g + startNode.h;
        
        while (openSet.length > 0) {
            // Get node with lowest f value
            const current = openSet.reduce((min, node) => 
                node.f < min.f ? node : min, openSet[0]);
            
            if (current === targetNode) {
                return this.reconstructPath(current);
            }
            
            // Remove current from openSet and add to closedSet
            openSet.splice(openSet.indexOf(current), 1);
            closedSet.add(current);
            
            for (const neighbor of this.navMesh.getNeighbors(current)) {
                if (closedSet.has(neighbor)) {
                    continue;
                }
                
                const tentativeG = current.g + this.getDistance(current, neighbor);
                
                if (!openSet.includes(neighbor)) {
                    openSet.push(neighbor);
                } else if (tentativeG >= neighbor.g) {
                    continue;
                }
                
                neighbor.parent = current;
                neighbor.g = tentativeG;
                neighbor.h = this.heuristic(neighbor, targetNode);
                neighbor.f = neighbor.g + neighbor.h;
            }
        }
        
        return null; // No path found
    }

    getClosestNode(position) {
        const gridX = Math.floor((position.x + this.navMesh.worldSize/2) / this.navMesh.nodeSize);
        const gridZ = Math.floor((position.z + this.navMesh.worldSize/2) / this.navMesh.nodeSize);
        
        if (gridX >= 0 && gridX < this.navMesh.grid.length &&
            gridZ >= 0 && gridZ < this.navMesh.grid[0].length) {
            return this.navMesh.grid[gridX][gridZ];
        }
        return null;
    }

    heuristic(nodeA, nodeB) {
        // Manhattan distance
        return Math.abs(nodeA.x - nodeB.x) + Math.abs(nodeA.z - nodeB.z);
    }

    getDistance(nodeA, nodeB) {
        // Euclidean distance for more accurate pathfinding
        const dx = nodeA.x - nodeB.x;
        const dz = nodeA.z - nodeB.z;
        return Math.sqrt(dx * dx + dz * dz);
    }

    reconstructPath(endNode) {
        const path = [];
        let current = endNode;
        
        while (current !== null) {
            path.unshift(new THREE.Vector3(current.x, 0, current.z));
            current = current.parent;
        }
        
        return this.smoothPath(path);
    }

    smoothPath(path) {
        if (path.length <= 2) return path;
        
        const smoothed = [path[0]];
        let current = 0;
        
        while (current < path.length - 1) {
            let furthest = current + 1;
            
            // Look ahead for longest valid straight line
            for (let i = current + 2; i < path.length; i++) {
                if (this.isValidLine(path[current], path[i])) {
                    furthest = i;
                }
            }
            
            smoothed.push(path[furthest]);
            current = furthest;
        }
        
        return smoothed;
    }

    isValidLine(start, end) {
        // Check if straight line between points is walkable
        const steps = 10;
        const dx = (end.x - start.x) / steps;
        const dz = (end.z - start.z) / steps;
        
        for (let i = 1; i < steps; i++) {
            const x = start.x + dx * i;
            const z = start.z + dz * i;
            const node = this.getClosestNode({x, z});
            
            if (!node || !node.isWalkable) {
                return false;
            }
        }
        
        return true;
    }
}

export {NavigationMesh, PathFinder};