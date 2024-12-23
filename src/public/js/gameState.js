import * as THREE from "three";

class GameState {
  constructor(world) {
    // Player stats
    this.health = 100;
    this.maxHealth = 100;
    this.stamina = 100;
    this.maxStamina = 100;
    this.isPlayerSprinting = false;
    this.world = world;
    this.paused = false;

    // Wave management
    this.currentWave = 0;
    this.zombiesRemainingInWave = 0;
    this.zombiesPerWave = 5;
    this.killCount = 0;
    this.isGameOver = false;

    // UI Elements
    this.healthBar = document.getElementById("health-bar-fill");
    this.healthText = document.getElementById("healthText");
    this.staminaBar = document.getElementById("stamina-bar-fill");
    this.staminaText = document.getElementById("staminaText");
    this.waveCounter = document.getElementById("wave");
    this.zombieCounter = document.getElementById("zombies");
    this.killCounter = document.getElementById("score");
    this.gameOverScreen = document.getElementById("game-over-overlay");
    this.finalScore = document.getElementById("score");
    this.waveCompleteScreen = document.getElementById(
      "level-completed-overlay",
    );
    this.nextWaveButton = document.getElementById("next-level-button");

    this.nextWaveButton.addEventListener("click", () => {
      document.exitPointerLock(); // Exit pointer lock
      this.world.mouseControls = false;
      this.waveCompleteScreen.style.display = "none";
      this.world.startChapterLoading();
    });

    // Initial UI update
    this.updateUI();
  }

  updateUI() {
    // Update health bar and text
    const healthPercent = this.getHealthPercentage();
    if (this.healthBar) {
      this.healthBar.style.width = `${healthPercent}%`;
      this.healthBar.style.backgroundColor = this.getHealthColor(healthPercent);
    }
    if (this.healthText) {
      this.healthText.textContent = `${Math.ceil(this.health)} / ${this.maxHealth}`;
    }

    // Update stamina bar and text
    const staminaPercent = this.getStaminaPercentage();
    if (this.staminaBar) {
      this.staminaBar.style.width = `${staminaPercent}%`;
      this.staminaBar.style.backgroundColor =
        this.getStaminaColor(staminaPercent);
    }
    if (this.staminaText) {
      this.staminaText.textContent = `${Math.ceil(this.stamina)} / ${this.maxStamina}`;
    }

    // Update wave and zombie counters
    if (this.waveCounter) {
      this.waveCounter.textContent = `${this.currentWave}`;
    }
    if (this.zombieCounter) {
      this.zombieCounter.textContent = `${this.zombiesRemainingInWave}`;
    }
    if (this.killCounter) {
      this.killCounter.textContent = `${this.killCount}`;
    }

    // Update game over screen if necessary
    if (this.isGameOver) {
      this.gameOverScreen.style.display = "flex";
    }
  }

  addZombie() {
    this.zombiesRemainingInWave++;
  }

  getHealthColor(percentage) {
    if (percentage > 60) return "#4CAF50"; // Green
    if (percentage > 30) return "#FFC107"; // Yellow
    return "#F44336"; // Red
  }

  getStaminaColor(percentage) {
    if (percentage > 60) return "#2196F3"; // Blue
    if (percentage > 30) return "#87CEEB"; // Light Blue
    return "#B3E5FC"; // Very Light Blue
  }

  updateMinimap(minimap) {
    if (minimap) {
      // Update minimap with normalized coordinates
      const worldWidth = 2000; // Adjust based on your world size
      const worldHeight = 2000; // Adjust based on your world size

      const normalizedX =
        (this.world.camera.position.x + worldWidth / 2) / worldWidth;
      const normalizedY =
        (this.world.camera.position.z + worldHeight / 2) / worldHeight;

      // Get rotation from camera's quaternion
      const rotation = new THREE.Euler().setFromQuaternion(
        this.world.camera.quaternion,
        "YXZ",
      );

      minimap.update({
        player: {
          x: normalizedX,
          y: normalizedY,
          rotation: -rotation.y, // Use Y rotation for 2D minimap
        },
        enemies: this.world.shooter.markedTargets.map((target) => ({
          x: (target.position.x + worldWidth / 2) / worldWidth,
          y: (target.position.z + worldHeight / 2) / worldHeight,
        })),
        obstacles: this.world.objectsToCheck.map((_) => ({
          x: (_.object.position.x + worldWidth / 2) / worldWidth,
          y: (_.object.position.z + worldHeight / 2) / worldHeight,
          width: 0.1,
          height: 0.1,
        })),
      });
    }
  }

  addObstacle(obstacle) {
    const normalizedObstacle = {
      x: (obstacle.position.x + this.worldWidth / 2) / this.worldWidth,
      y: (obstacle.position.z + this.worldHeight / 2) / this.worldHeight,
      width: obstacle.scale.x / this.worldWidth,
      height: obstacle.scale.z / this.worldHeight,
    };
    this.obstacles.push(normalizedObstacle);
  }

  damagePlayer(amount) {
    this.health = Math.max(0, this.health - amount);
    this.updateUI();
    if (this.health <= 0) {
      this.gameOver();
    }
  }

  healPlayer(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
    this.updateUI();
  }

  updateStamina(deltaTime) {
    const oldStamina = this.stamina;
    if (this.isPlayerSprinting && this.stamina > 0) {
      this.stamina = Math.max(0, this.stamina - 30 * deltaTime);
    } else if (!this.isPlayerSprinting && this.stamina < this.maxStamina) {
      this.stamina = Math.min(this.maxStamina, this.stamina + 20 * deltaTime);
    }
    if (Math.abs(this.stamina - oldStamina) > 0.1) {
      this.updateUI();
    }
  }

  canSprint() {
    return this.stamina > 0;
  }

  setSprinting(isSprinting) {
    this.isPlayerSprinting = isSprinting && this.canSprint();
  }

  _getRandomNumber() {
    return Math.floor(Math.random() * 1001) - 500;
  }

  startNewWave() {
    this.currentWave++;
    this.zombiesRemainingInWave =
      this.zombiesPerWave + (this.currentWave - 1) * 5;
    if (this.waveCompleteScreen) {
      this.waveCompleteScreen.style.display = "none";
    }

    if (this.world.zombies) {
      this.world.zombies.forEach(zombie => {
        if (zombie && zombie.removeFromScene) {
          zombie.removeFromScene();
        }
      });
      this.world.zombies = [];
    }

    for (let i = 0; i < this.zombiesRemainingInWave; i++) {
      setTimeout(() => {
        this.world.spawnZombie({
          x: this._getRandomNumber(),
          y: 0,
          z: this._getRandomNumber(),
        });
      }, i * 100);
    }
    this.updateUI();
  }

  killZombie(zombie) {
    if (this.zombiesRemainingInWave > 0) {
      this.zombiesRemainingInWave--;
      this.killCount++;
      this.updateUI();

      if (this.zombiesRemainingInWave === 0) {
        if (this.waveCompleteScreen) {
          this.waveCompleteScreen.style.display = "flex";
          this.world.currentChapter++;
        }
        return "wave_complete";
      }
      return true;
    }
    return false;
  }

  gameOver() {
    this.isGameOver = true;
    this.updateUI();
  }

  reset() {
    this.health = this.maxHealth;
    this.stamina = this.maxStamina;
    this.currentWave = 1;
    this.zombiesRemainingInWave = this.zombiesPerWave;
    this.killCount = 0;
    this.isGameOver = false;
    this.isPlayerSprinting = false;
    this.enemies = [];

    if (this.gameOverScreen) {
      this.gameOverScreen.style.display = "none";
    }
    if (this.waveCompleteScreen) {
      this.waveCompleteScreen.style.display = "none";
    }

    this.updateUI();
  }

  getHealthPercentage() {
    return (this.health / this.maxHealth) * 100;
  }

  getStaminaPercentage() {
    return (this.stamina / this.maxStamina) * 100;
  }

  getKillCount() {
    return this.killCount;
  }

  getZombiesRemaining() {
    return this.zombiesRemainingInWave;
  }

  getCurrentWave() {
    return this.currentWave;
  }
  togglePause() {
    this.paused = !this.paused; // Toggle the pause state
    if (this.paused) {
      console.log("Game is now paused.");
      // this.scene.mouseControls = false;
      // document.exitPointerLock();
    } else {
      // console.log("Game is now resumed.");
      // this.scene.mouseControls = true; 
      this.world.animate();  // Resume the game loop when unpausing
      this.updateUI();
    }
  }

  isPaused() {
    return this.paused;  // Provide a method to check if the game is paused
  }
}

export default GameState;
