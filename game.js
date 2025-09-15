// Game client for MMORPG
class GameClient {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.worldImage = null;
        this.worldWidth = 2048;
        this.worldHeight = 2048;
        
        // Game state
        this.players = {};
        this.avatars = {};
        this.myPlayerId = null;
        this.myPlayer = null;
        
        // Image cache
        this.imageCache = new Map();
        
        // Input state
        this.pressedKeys = {
            ArrowUp: false,
            ArrowDown: false,
            ArrowLeft: false,
            ArrowRight: false
        };
        this.lastSentDirection = null;
        this.isMoving = false;
        
        // Camera/viewport
        this.cameraX = 0;
        this.cameraY = 0;
        
        // WebSocket
        this.socket = null;
        this.serverUrl = 'wss://codepath-mmorg.onrender.com';
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.loadWorldMap();
        this.setupInputHandlers();
        this.connectToServer();
    }
    
    setupCanvas() {
        // Set canvas size to fill the browser window
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.updateCamera();
            this.render();
        });
    }
    
    loadWorldMap() {
        this.worldImage = new Image();
        this.worldImage.onload = () => {
            this.render();
        };
        this.worldImage.src = 'world.jpg';
    }
    
    setupInputHandlers() {
        // Handle keydown events
        document.addEventListener('keydown', (event) => {
            this.handleKeyDown(event);
        });
        
        // Handle keyup events
        document.addEventListener('keyup', (event) => {
            this.handleKeyUp(event);
        });
    }
    
    handleKeyDown(event) {
        // Only handle arrow keys
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
            return;
        }
        
        // Prevent default browser behavior
        event.preventDefault();
        
        // If key was already pressed, don't send duplicate command
        if (this.pressedKeys[event.code]) {
            return;
        }
        
        // Mark key as pressed
        this.pressedKeys[event.code] = true;
        
        // Send move command
        this.sendMoveCommand(event.code);
    }
    
    handleKeyUp(event) {
        // Only handle arrow keys
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
            return;
        }
        
        // Prevent default browser behavior
        event.preventDefault();
        
        // Mark key as released
        this.pressedKeys[event.code] = false;
        
        // Check if any movement keys are still pressed
        const anyKeyPressed = Object.values(this.pressedKeys).some(pressed => pressed);
        
        if (!anyKeyPressed) {
            // No keys pressed, send stop command
            this.sendStopCommand();
        } else {
            // Other keys still pressed, send move command for the next priority direction
            this.sendMoveCommandForPressedKeys();
        }
    }
    
    sendMoveCommand(keyCode) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            return;
        }
        
        const direction = this.keyCodeToDirection(keyCode);
        if (!direction) return;
        
        // Update facing direction first
        if (this.myPlayer) {
            this.myPlayer.facing = direction;
        }
        
        // Calculate new position
        const newPosition = this.calculateNewPosition(direction);
        
        const moveMessage = {
            action: 'move',
            x: newPosition.x,
            y: newPosition.y
        };
        
        this.socket.send(JSON.stringify(moveMessage));
        this.lastSentDirection = direction;
        this.isMoving = true;
        
        // Update our own position locally
        this.updateMyPosition(direction);
    }
    
    calculateNewPosition(direction) {
        if (!this.myPlayer) return { x: 0, y: 0 };
        
        const moveSpeed = 16;
        let newX = this.myPlayer.x;
        let newY = this.myPlayer.y;
        
        switch (direction) {
            case 'up':
                newY = Math.max(0, this.myPlayer.y - moveSpeed);
                break;
            case 'down':
                newY = Math.min(this.worldHeight, this.myPlayer.y + moveSpeed);
                break;
            case 'left':
                newX = Math.max(0, this.myPlayer.x - moveSpeed);
                break;
            case 'right':
                newX = Math.min(this.worldWidth, this.myPlayer.x + moveSpeed);
                break;
        }
        
        return { x: newX, y: newY };
    }
    
    updateMyPosition(direction) {
        if (!this.myPlayer) return;
        
        const moveSpeed = 16; // Adjust this value to match server movement speed
        const oldX = this.myPlayer.x;
        const oldY = this.myPlayer.y;
        
        switch (direction) {
            case 'up':
                this.myPlayer.y = Math.max(0, this.myPlayer.y - moveSpeed);
                break;
            case 'down':
                this.myPlayer.y = Math.min(this.worldHeight, this.myPlayer.y + moveSpeed);
                break;
            case 'left':
                this.myPlayer.x = Math.max(0, this.myPlayer.x - moveSpeed);
                break;
            case 'right':
                this.myPlayer.x = Math.min(this.worldWidth, this.myPlayer.x + moveSpeed);
                break;
        }
        
        // Facing direction already updated in sendMoveCommand
        
        console.log(`Moved ${direction}: (${oldX}, ${oldY}) -> (${this.myPlayer.x}, ${this.myPlayer.y})`);
        
        // Render will handle camera update
        this.render();
    }
    
    sendStopCommand() {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            return;
        }
        
        const stopMessage = {
            action: 'stop'
        };
        
        this.socket.send(JSON.stringify(stopMessage));
        this.lastSentDirection = null;
        this.isMoving = false;
    }
    
    sendMoveCommandForPressedKeys() {
        // Find the first pressed key and send its direction
        for (const [keyCode, isPressed] of Object.entries(this.pressedKeys)) {
            if (isPressed) {
                this.sendMoveCommand(keyCode);
                break;
            }
        }
    }
    
    keyCodeToDirection(keyCode) {
        const keyMap = {
            'ArrowUp': 'up',
            'ArrowDown': 'down',
            'ArrowLeft': 'left',
            'ArrowRight': 'right'
        };
        return keyMap[keyCode];
    }
    
    connectToServer() {
        this.socket = new WebSocket(this.serverUrl);
        
        this.socket.onopen = () => {
            console.log('Connected to game server');
            this.joinGame();
        };
        
        this.socket.onmessage = (event) => {
            this.handleServerMessage(JSON.parse(event.data));
        };
        
        this.socket.onclose = () => {
            console.log('Disconnected from game server');
        };
        
        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }
    
    joinGame() {
        const joinMessage = {
            action: 'join_game',
            username: 'Jadon'
        };
        
        this.socket.send(JSON.stringify(joinMessage));
    }
    
    handleServerMessage(message) {
        switch (message.action) {
            case 'join_game':
                if (message.success) {
                    this.myPlayerId = message.playerId;
                    this.players = message.players;
                    this.avatars = message.avatars;
                    this.myPlayer = this.players[this.myPlayerId];
                    this.updateCamera();
                    console.log('Joined game successfully', this.myPlayer);
                } else {
                    console.error('Failed to join game:', message.error);
                }
                break;
                
            case 'player_joined':
                this.players[message.player.id] = message.player;
                this.avatars[message.avatar.name] = message.avatar;
                break;
                
            case 'players_moved':
                // Only log if my player is in the update
                if (this.myPlayerId && message.players[this.myPlayerId]) {
                    console.log('My player updated:', message.players[this.myPlayerId]);
                }
                Object.assign(this.players, message.players);
                // Camera will be updated by render() call at the end
                break;
                
            case 'player_left':
                delete this.players[message.playerId];
                break;
                
            case 'move':
                if (!message.success) {
                    console.error('Move command failed:', message.error);
                }
                break;
                
            case 'stop':
                if (!message.success) {
                    console.error('Stop command failed:', message.error);
                }
                break;
                
            default:
                console.log('Unknown message:', message);
        }
        
        this.render();
    }
    
    updateCamera() {
        if (!this.myPlayer) return;
        
        // Center camera on my avatar
        this.cameraX = this.myPlayer.x - this.canvas.width / 2;
        this.cameraY = this.myPlayer.y - this.canvas.height / 2;
        
        // Clamp camera to map boundaries
        this.cameraX = Math.max(0, Math.min(this.cameraX, this.worldWidth - this.canvas.width));
        this.cameraY = Math.max(0, Math.min(this.cameraY, this.worldHeight - this.canvas.height));
    }
    
    worldToScreen(worldX, worldY) {
        return {
            x: worldX - this.cameraX,
            y: worldY - this.cameraY
        };
    }
    
    loadAvatarImage(avatarData) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.src = avatarData;
        });
    }
    
    async renderAvatar(player) {
        if (!this.avatars[player.avatar]) return;
        
        const avatar = this.avatars[player.avatar];
        const direction = player.facing || 'south';
        const frame = player.animationFrame || 0;
        
        // Handle west direction by using east frames
        const actualDirection = (direction === 'left' || direction === 'west') ? 'east' : direction;
        const shouldFlip = (direction === 'left' || direction === 'west');
        
        // Get the appropriate frame
        const frameData = avatar.frames[actualDirection]?.[frame];
        if (!frameData) return;
        
        // Create cache key for this specific frame
        const cacheKey = `${player.avatar}_${direction}_${frame}`;
        
        // Load image if not already cached
        if (!this.imageCache.has(cacheKey)) {
            const img = await this.loadAvatarImage(frameData);
            this.imageCache.set(cacheKey, img);
        }
        
        const img = this.imageCache.get(cacheKey);
        const screenPos = this.worldToScreen(player.x, player.y);
        
        // Check if avatar is within viewport
        if (screenPos.x < -50 || screenPos.x > this.canvas.width + 50 ||
            screenPos.y < -50 || screenPos.y > this.canvas.height + 50) {
            return;
        }
        
        // Calculate avatar size (maintain aspect ratio)
        const avatarSize = 32;
        const aspectRatio = img.width / img.height;
        const width = avatarSize;
        const height = avatarSize / aspectRatio;
        
        // Center avatar on player position
        const x = screenPos.x - width / 2;
        const y = screenPos.y - height;
        
        // Draw avatar with optional horizontal flip for west direction
        if (shouldFlip) {
            this.ctx.save();
            this.ctx.scale(-1, 1); // Flip horizontally
            this.ctx.drawImage(img, -(x + width), y, width, height);
            this.ctx.restore();
        } else {
            this.ctx.drawImage(img, x, y, width, height);
        }
        
        // Draw username label
        this.ctx.fillStyle = 'white';
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 2;
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        
        const textX = screenPos.x;
        const textY = screenPos.y - height - 5;
        
        // Draw text with outline
        this.ctx.strokeText(player.username, textX, textY);
        this.ctx.fillText(player.username, textX, textY);
    }
    
    async render() {
        if (!this.worldImage) return;
        
        // Update camera to follow my player
        this.updateCamera();
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw world map with camera offset
        this.ctx.drawImage(
            this.worldImage,
            this.cameraX, this.cameraY, this.canvas.width, this.canvas.height,  // source rectangle
            0, 0, this.canvas.width, this.canvas.height  // destination rectangle
        );
        
        // Render all players
        for (const playerId in this.players) {
            await this.renderAvatar(this.players[playerId]);
        }
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new GameClient();
});
