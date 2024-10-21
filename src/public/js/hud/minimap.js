export default class MiniMap {
  constructor() {
    self.canvas = document.getElementById("minimap");
    self.ctx = canvas.getContext("2d");
    self.width = 100;
    self.height = 100;
  }

  _drawPlayer() {
    ctx.beginPath();
    ctx.arc(self.width / 2, self.height / 2, 2, 0, 2 * Math.PI);
    ctx.fillStyle = "white";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "white";
    ctx.stroke();
  }

  _drawEnemy() {
    ctx.beginPath();
    ctx.arc(self.width / 1.5, self.height / 2, 2, 0, 2 * Math.PI);
    ctx.fillStyle = "red";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "red";
    ctx.stroke();
  }

  draw(gameState) {
    // do transformations

    //draw state
    this._drawPlayer();
    this._drawEnemy();
  }
}
