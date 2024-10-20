export default class LoadingScreen {
    constructor() {
      this.domElement = this.createDomElement();
      this.progressElement = this.domElement.querySelector('.progress');
    }
  
    createDomElement() {
      const container = document.createElement('div');
      container.innerHTML = `
        <div id="loading-screen">
          <div class="spinner"></div>
          <span class="progress">Loading... 0%</span>
        </div>
      `;
      return container.firstElementChild;
    }
  
    show() {
        // Check if the loading screen is already in the DOM
        if (!document.getElementById('loading-screen')) {
            document.body.appendChild(this.domElement);
            console.log("Loading screen displayed.");
        } else {
            console.log("Loading screen already present.");
        }
    }
    
  
    hide() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.parentNode.removeChild(loadingScreen);
            console.log("Loading screen removed.");
        } else {
            console.log("No loading screen found to hide.");
        }
    }
    
  
    updateProgress(progress) {
      this.progressElement.textContent = `Loading... ${Math.round(progress)}%`;
    }
  
    loadHUD() {
      const hudHTML = `
        <div id="hud">
          <div id="health-bar"><div id="health-bar-fill"></div></div>
          <div id="stamina-bar"><div id="stamina-bar-fill"></div></div>
          <div id="minimap-container">
            <canvas id="minimap" width="100" height="100"></canvas>
          </div>
          <div id="stats">
            <p>Score: <span id="score">0</span></p>
            <p>Ammo: <span id="ammo">100</span></p>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', hudHTML);
    }
  }