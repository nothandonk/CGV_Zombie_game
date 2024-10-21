// src/gameState.js

class GameState {
    constructor() {
        // Player stats
        this.health = 100;          // Player health (red)
        this.maxHealth = 100;
        this.stamina = 100;         // Player stamina (blue)
        this.maxStamina = 100;
        this.isPlayerSprinting = false;
        
        // Wave management
        this.currentWave = 1;
        this.zombiesRemainingInWave = 0;
        this.zombiesPerWave = 10;   // Base zombies per wave, increases each wave

        // Game stats
        this.killCount = 0;
        this.isGameOver = false;
    }

    // Player health management
    damagePlayer(amount) {
        this.health = Math.max(0, this.health - amount);
        if (this.health <= 0) {
            this.gameOver();
        }
    }

    healPlayer(amount) {
        this.health = Math.min(this.maxHealth, this.health + amount);
    }

    // Stamina management
    updateStamina(deltaTime) {
        if (this.isPlayerSprinting && this.stamina > 0) {
            // Decrease stamina while sprinting (30 stamina per second)
            this.stamina = Math.max(0, this.stamina - (30 * deltaTime));
        } else if (!this.isPlayerSprinting && this.stamina < this.maxStamina) {
            // Regenerate stamina when not sprinting (20 stamina per second)
            this.stamina = Math.min(this.maxStamina, this.stamina + (20 * deltaTime));
        }
    }

    canSprint() {
        return this.stamina > 0;
    }

    setSprinting(isSprinting) {
        this.isPlayerSprinting = isSprinting && this.canSprint();
    }

    // Wave management
    startNewWave() {
        this.currentWave++;
        this.zombiesRemainingInWave = this.zombiesPerWave + (this.currentWave - 1) * 5;
    }

    killZombie() {
        if (this.zombiesRemainingInWave > 0) {
            this.zombiesRemainingInWave--;
            this.killCount++;
            
            // Check if wave is complete
            if (this.zombiesRemainingInWave === 0) {
                return 'wave_complete';
            }
            return true;
        }
        return false;
    }

    gameOver() {
        this.isGameOver = true;
    }

    reset() {
        this.health = this.maxHealth;
        this.stamina = this.maxStamina;
        this.currentWave = 1;
        this.zombiesRemainingInWave = this.zombiesPerWave;
        this.killCount = 0;
        this.isGameOver = false;
        this.isPlayerSprinting = false;
    }

    // Getters for UI display
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
}

export default GameState;
