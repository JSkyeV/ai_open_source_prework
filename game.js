// Game client for MMORPG
class GameClient {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.worldImage = null;
        this.worldWidth = 2048;
        this.worldHeight = 2048;
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.loadWorldMap();
    }
    
    setupCanvas() {
        // Set canvas size to fill the browser window
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.drawWorld();
        });
    }
    
    loadWorldMap() {
        this.worldImage = new Image();
        this.worldImage.onload = () => {
            this.drawWorld();
        };
        this.worldImage.src = 'world.jpg';
    }
    
    drawWorld() {
        if (!this.worldImage) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw world map at actual size, showing upper left corner
        // This ensures the coordinate system matches (0,0) at top-left)
        this.ctx.drawImage(
            this.worldImage,
            0, 0, this.worldWidth, this.worldHeight,  // source rectangle (full image)
            0, 0, this.worldWidth, this.worldHeight  // destination rectangle (actual size)
        );
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new GameClient();
});
