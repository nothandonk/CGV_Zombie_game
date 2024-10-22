export default class MiniMap {
  constructor(containerId, options = {}) {
    // Default options
    this.options = {
      size: options.size || 150,
      backgroundColor: options.backgroundColor || "rgba(0, 0, 0, 0.5)",
      borderColor: options.borderColor || "rgba(255, 255, 255, 0.3)",
      playerColor: options.playerColor || "#44ff44",
      enemyColor: options.enemyColor || "#ff4444",
      obstacleColor: options.obstacleColor || "#404040",
      playerSize: options.playerSize || 6,
      enemySize: options.enemySize || 4,
      directionIndicatorLength: options.directionIndicatorLength || 12,
    };

    // Create container if it doesn't exist
    this.container = document.getElementById(containerId);
    if (!this.container) {
      this.container = document.createElement("div");
      this.container.id = containerId;
      document.body.appendChild(this.container);
    }

    // Set up container styles
    this.setupContainer();

    // Create and set up canvas
    this.canvas = document.getElementById("minimap");
    this.canvas.width = this.options.size;
    this.canvas.height = this.options.size;
    this.container.appendChild(this.canvas);

    // Get context
    this.ctx = this.canvas.getContext("2d");

    // Initialize empty game state
    this.gameState = {
      player: { x: 0.5, y: 0.5, rotation: 0 },
      enemies: [],
      obstacles: [],
    };
  }

  setupContainer() {
    Object.assign(this.container.style, {
      width: `${this.options.size}px`,
      height: `${this.options.size}px`,
      backgroundColor: this.options.backgroundColor,
      border: `2px solid ${this.options.borderColor}`,
      borderRadius: "50%",
      overflow: "hidden",
      marginBottom: "15px",
    });
  }

  // Convert world coordinates to minimap coordinates
  worldToMinimap(x, y) {
    return {
      x: x * this.options.size,
      y: y * this.options.size,
    };
  }

  // Draw player on minimap
  drawPlayer() {
    const { x, y } = this.worldToMinimap(
      this.gameState.player.x,
      this.gameState.player.y,
    );

    // Draw player dot
    this.ctx.beginPath();
    this.ctx.arc(x, y, this.options.playerSize, 0, Math.PI * 2);
    this.ctx.fillStyle = this.options.playerColor;
    this.ctx.fill();

    // Draw direction indicator
    const rotation = this.gameState.player.rotation;
    const dirX = x + Math.sin(rotation) * this.options.directionIndicatorLength;
    const dirY = y - Math.cos(rotation) * this.options.directionIndicatorLength;

    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(dirX, dirY);
    this.ctx.strokeStyle = this.options.playerColor;
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
  }

  // Draw enemies on minimap
  drawEnemies() {
    this.gameState.enemies.forEach((enemy) => {
      const { x, y } = this.worldToMinimap(enemy.x, enemy.y);
      this.ctx.beginPath();
      this.ctx.arc(x, y, this.options.enemySize, 0, Math.PI * 2);
      this.ctx.fillStyle = this.options.enemyColor;
      this.ctx.fill();
    });
  }

  // Draw obstacles on minimap
  drawObstacles() {
    this.gameState.obstacles.forEach((obstacle) => {
      const { x, y } = this.worldToMinimap(obstacle.x, obstacle.y);
      const width = obstacle.width * this.options.size;
      const height = obstacle.height * this.options.size;

      this.ctx.fillStyle = this.options.obstacleColor;
      this.ctx.fillRect(x, y, width, height);
    });
  }

  // Clear the minimap
  clear() {
    this.ctx.clearRect(0, 0, this.options.size, this.options.size);
  }

  // Update game state and redraw
  update(gameState) {
    this.gameState = gameState;
    this.render();
  }

  // Render the minimap
  render() {
    this.clear();
    this.drawObstacles();
    this.drawEnemies();
    this.drawPlayer();
  }

  // Resize the minimap
  resize(size) {
    this.options.size = size;
    this.canvas.width = size;
    this.canvas.height = size;
    this.container.style.width = `${size}px`;
    this.container.style.height = `${size}px`;
    this.render();
  }

  // Show/hide the minimap
  setVisibility(visible) {
    this.container.style.display = visible ? "block" : "none";
  }
}
