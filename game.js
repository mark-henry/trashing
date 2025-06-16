// Game state
let game = {
    score: 0,
    papersTrash: 0,
    deskSpaceUsed: 0,
    maxDeskSpace: 15,
    paperSpawnRate: 2000,
    lastSpawn: 0,
    combo: 0,
    lastTrashTime: 0,
    comboWindow: 2000, // 2 seconds for combo
    penalties: 0,
    gameTime: 0,
    lastWindGust: 0,
    windGustInterval: 8000, // Wind gust every 8 seconds
    // JUICE FEATURES! 🧃
    slowMotion: false,
    slowMotionEnd: 0,
    magneticMode: false,
    magneticEnd: 0,
    doublePoints: false,
    doublePointsEnd: 0,
    lastPowerUp: 0,
    powerUpInterval: 15000, // Power-up every 15 seconds
    screenShakeIntensity: 0,
    lastSpecialEvent: 0
};

// Power-ups array
let powerUps = [];
let activeEffects = [];

// Matter.js setup
const Engine = Matter.Engine;
const Render = Matter.Render;
const World = Matter.World;
const Bodies = Matter.Bodies;
const Mouse = Matter.Mouse;
const MouseConstraint = Matter.MouseConstraint;
const Events = Matter.Events;
const Body = Matter.Body;

// Create engine and world with better collision detection
const engine = Engine.create();
const world = engine.world;
engine.world.gravity.y = 0; // No gravity - papers float!

// Improve collision detection to prevent tunneling
engine.timing.timeScale = 1;
engine.velocityIterations = 8; // More collision solving iterations
engine.positionIterations = 6; // More position correction iterations
engine.enableSleeping = false; // Keep all bodies active for consistent physics

// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Responsive canvas sizing
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Create renderer
const render = Render.create({
    canvas: canvas,
    engine: engine,
    options: {
        width: canvas.width,
        height: canvas.height,
        wireframes: false,
        background: 'transparent',
        showAngleIndicator: false,
        showVelocity: false
    }
});

// Create screen boundaries - THICK walls to prevent tunneling
const wallThickness = 200; // Much thicker walls
const walls = [
    Bodies.rectangle(canvas.width / 2, canvas.height + wallThickness/2, canvas.width + wallThickness*2, wallThickness, { 
        isStatic: true, 
        render: { fillStyle: '#8B4513' },
        restitution: 0.6 // More bouncy
    }), // Bottom
    Bodies.rectangle(-wallThickness/2, canvas.height / 2, wallThickness, canvas.height + wallThickness*2, { 
        isStatic: true, 
        render: { fillStyle: '#8B4513' },
        restitution: 0.6
    }), // Left
    Bodies.rectangle(canvas.width + wallThickness/2, canvas.height / 2, wallThickness, canvas.height + wallThickness*2, { 
        isStatic: true, 
        render: { fillStyle: '#8B4513' },
        restitution: 0.6
    }), // Right
    Bodies.rectangle(canvas.width / 2, -wallThickness/2, canvas.width + wallThickness*2, wallThickness, { 
        isStatic: true, 
        render: { fillStyle: '#8B4513' },
        restitution: 0.6
    }) // Top boundary!
];

// Create bins
const binWidth = 120;
const binHeight = 80;
const bins = {
    trash: {
        body: Bodies.rectangle(100, canvas.height - 40, binWidth, binHeight, { 
            isStatic: true, 
            render: { fillStyle: '#333333' },
            label: 'trash'
        }),
        points: 10,
        color: '#333333'
    },
    recycle: {
        body: Bodies.rectangle(canvas.width / 2, canvas.height - 40, binWidth, binHeight, { 
            isStatic: true, 
            render: { fillStyle: '#2E8B57' },
            label: 'recycle'
        }),
        points: 15,
        color: '#2E8B57'
    },
    shred: {
        body: Bodies.rectangle(canvas.width - 100, canvas.height - 40, binWidth, binHeight, { 
            isStatic: true, 
            render: { fillStyle: '#8B0000' },
            label: 'shred'
        }),
        points: 20,
        color: '#8B0000'
    }
};

// Position bin labels
document.getElementById('trashLabel').style.left = (100 - binWidth/2) + 'px';
document.getElementById('trashLabel').style.top = (canvas.height - 40 - binHeight/2 - 20) + 'px';
document.getElementById('recycleLabel').style.left = (canvas.width/2 - binWidth/2) + 'px';
document.getElementById('recycleLabel').style.top = (canvas.height - 40 - binHeight/2 - 20) + 'px';
document.getElementById('shredLabel').style.left = (canvas.width - 100 - binWidth/2) + 'px';
document.getElementById('shredLabel').style.top = (canvas.height - 40 - binHeight/2 - 20) + 'px';

// Add all static bodies to world
World.add(world, [...walls, ...Object.values(bins).map(bin => bin.body)]);

// Paper types with constraints
const paperTypes = [
    { 
        color: '#F5F5F5', 
        size: 40, 
        type: 'regular', 
        crinkle: 0,
        validBins: ['trash', 'recycle'],
        timeLimit: 15000, // 15 seconds
        icon: '📄'
    },
    { 
        color: '#FFD700', 
        size: 35, 
        type: 'sticky', 
        crinkle: 0,
        validBins: ['trash'],
        timeLimit: 12000, // 12 seconds - shorter for sticky
        icon: '📝'
    },
    { 
        color: '#DC143C', 
        size: 45, 
        type: 'confidential', 
        crinkle: 0,
        validBins: ['shred'], // MUST be shredded
        timeLimit: 10000, // 10 seconds - urgent!
        icon: '🔒'
    },
    { 
        color: '#DDA0DD', 
        size: 38, 
        type: 'crumpled', 
        crinkle: 0.3,
        validBins: ['trash', 'recycle'],
        timeLimit: 20000, // 20 seconds - already processed
        icon: '📋'
    },
    {
        color: '#32CD32',
        size: 42,
        type: 'recyclable',
        crinkle: 0,
        validBins: ['recycle'], // MUST be recycled
        timeLimit: 18000,
        icon: '♻️'
    }
];

// Papers array
let papers = [];

// Printer and fax machine configuration
const printer = {
    x: 50, // Left side
    y: 200,
    width: 60,
    height: 40,
    lastPrint: 0,
    printInterval: 3000 // Print every 3 seconds
};

const faxMachine = {
    x: 50, // Next to printer
    y: 260,
    width: 70,
    height: 45,
    lastFax: 0,
    faxInterval: 4500 // Fax every 4.5 seconds
};

// Create mouse for dragging with custom logic
const mouse = Mouse.create(canvas);
let draggedPaper = null;
let dragStartPos = null;
let mouseStartPos = null;
let mouseHistory = []; // Track recent mouse positions for proper velocity

// Custom drag implementation for better flinging
canvas.addEventListener('mousedown', (e) => {
    const mousePos = { x: e.clientX, y: e.clientY };
    
    // Find paper under mouse
    papers.forEach(paper => {
        const dx = mousePos.x - paper.position.x;
        const dy = mousePos.y - paper.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 30) { // Simple radius check
            draggedPaper = paper;
            dragStartPos = { x: paper.position.x, y: paper.position.y };
            mouseStartPos = { x: mousePos.x, y: mousePos.y };
            
            // Reduce velocity to make dragging smoother
            Body.setVelocity(paper, { x: 0, y: 0 });
        }
    });
});

canvas.addEventListener('mousemove', (e) => {
    if (draggedPaper) {
        const mousePos = { x: e.clientX, y: e.clientY, time: Date.now() };
        const newX = dragStartPos.x + (mousePos.x - mouseStartPos.x);
        const newY = dragStartPos.y + (mousePos.y - mouseStartPos.y);
        
        // Track mouse history for velocity calculation
        mouseHistory.push(mousePos);
        if (mouseHistory.length > 5) {
            mouseHistory.shift(); // Keep only last 5 positions
        }
        
        // Move paper to follow mouse
        Body.setPosition(draggedPaper, { x: newX, y: newY });
    }
});

canvas.addEventListener('mouseup', (e) => {
    if (draggedPaper) {
        let velocityX = 0, velocityY = 0;
        
        // Calculate velocity from recent mouse movement (proper physics!)
        if (mouseHistory.length >= 2) {
            const recent = mouseHistory[mouseHistory.length - 1];
            const previous = mouseHistory[Math.max(0, mouseHistory.length - 3)];
            const timeDiff = recent.time - previous.time;
            
            if (timeDiff > 0) {
                velocityX = (recent.x - previous.x) / timeDiff * 15; // Scale for good feel
                velocityY = (recent.y - previous.y) / timeDiff * 15;
            }
        }
        
        // Apply the velocity for flinging
        Body.setVelocity(draggedPaper, { x: velocityX, y: velocityY });
        
        // Clear drag state
        draggedPaper = null;
        dragStartPos = null;
        mouseStartPos = null;
        mouseHistory = [];
    }
});

// Paper creation function - papers fly in from sides
function createPaper() {
    if (papers.length >= game.maxDeskSpace) return;
    
    const paperType = paperTypes[Math.floor(Math.random() * paperTypes.length)];
    
    // Random spawn side: 0=left, 1=right, 2=top
    const spawnSide = Math.floor(Math.random() * 3);
    let x, y, velocityX, velocityY;
    
    switch(spawnSide) {
        case 0: // Left side
            x = -50;
            y = Math.random() * (canvas.height - 200) + 100;
            velocityX = 6 + Math.random() * 8; // Much faster!
            velocityY = (Math.random() - 0.5) * 4;
            break;
        case 1: // Right side  
            x = canvas.width + 50;
            y = Math.random() * (canvas.height - 200) + 100;
            velocityX = -(6 + Math.random() * 8); // Much faster!
            velocityY = (Math.random() - 0.5) * 4;
            break;
        case 2: // Top side
            x = Math.random() * (canvas.width - 200) + 100;
            y = -50;
            velocityX = (Math.random() - 0.5) * 6;
            velocityY = 4 + Math.random() * 6; // Much faster!
            break;
    }
    
    const paper = Bodies.rectangle(x, y, paperType.size, paperType.size, {
        render: {
            fillStyle: paperType.color,
            strokeStyle: '#CCCCCC',
            lineWidth: 2
        },
        frictionAir: 0.02, // Less air friction for smoother movement
        restitution: 0.4,
        label: 'paper',
        inertia: Infinity, // Prevent rotation for more predictable collisions
        frictionStatic: 0.1,
        friction: 0.1
    });
    
    paper.paperType = paperType.type;
    paper.crinkle = paperType.crinkle;
    paper.validBins = paperType.validBins;
    paper.timeLimit = paperType.timeLimit;
    paper.spawnTime = Date.now();
    paper.icon = paperType.icon;
    paper.isOverdue = false;
    
    World.add(world, paper);
    papers.push(paper);
    
    // Set velocity to fly in from the side
    Body.setVelocity(paper, { x: velocityX, y: velocityY });
}

// Receipt printer paper creation
function createPrinterPaper() {
    if (papers.length >= game.maxDeskSpace) return;
    
    const paperType = paperTypes[Math.floor(Math.random() * paperTypes.length)];
    
    // Papers emerge from printer
    const x = printer.x;
    const y = printer.y + printer.height;
    
    const paper = Bodies.rectangle(x, y, paperType.size * 0.8, paperType.size, {
        render: {
            fillStyle: paperType.color,
            strokeStyle: '#CCCCCC',
            lineWidth: 2
        },
        frictionAir: 0.03,
        restitution: 0.3,
        label: 'paper',
        inertia: Infinity,
        frictionStatic: 0.1,
        friction: 0.1
    });
    
    paper.paperType = paperType.type;
    paper.crinkle = paperType.crinkle;
    paper.validBins = paperType.validBins;
    paper.timeLimit = paperType.timeLimit;
    paper.spawnTime = Date.now();
    paper.icon = paperType.icon;
    paper.isOverdue = false;
    
    World.add(world, paper);
    papers.push(paper);
    
    // Papers drop out of printer with more speed
    Body.setVelocity(paper, { 
        x: -3 + Math.random() * 6, 
        y: 3 + Math.random() * 5 
    });
    
    // Printer animation effect
    createPrinterEffect();
}

// Fax machine paper creation
function createFaxPaper() {
    if (papers.length >= game.maxDeskSpace) return;
    
    // Fax tends toward confidential and important papers
    const faxPaperTypes = paperTypes.filter(type => 
        type.type === 'confidential' || type.type === 'regular' || type.type === 'recyclable');
    const paperType = faxPaperTypes[Math.floor(Math.random() * faxPaperTypes.length)];
    
    // Papers slide out of fax horizontally
    const x = faxMachine.x + faxMachine.width;
    const y = faxMachine.y + faxMachine.height / 2;
    
    const paper = Bodies.rectangle(x, y, paperType.size, paperType.size * 0.7, {
        render: {
            fillStyle: paperType.color,
            strokeStyle: '#000000',
            lineWidth: 1
        },
        frictionAir: 0.04,
        restitution: 0.2,
        label: 'paper',
        inertia: Infinity,
        frictionStatic: 0.1,
        friction: 0.1
    });
    
    paper.paperType = paperType.type;
    paper.crinkle = paperType.crinkle;
    paper.validBins = paperType.validBins;
    paper.timeLimit = paperType.timeLimit;
    paper.spawnTime = Date.now();
    paper.icon = paperType.icon;
    paper.isOverdue = false;
    
    World.add(world, paper);
    papers.push(paper);
    
    // Papers slide out horizontally much faster
    Body.setVelocity(paper, { 
        x: 8 + Math.random() * 6, 
        y: (Math.random() - 0.5) * 3 
    });
    
    // Fax animation effect
    createFaxEffect();
}

// POWER-UP SYSTEM! 🌟
function createPowerUp() {
    const powerUpTypes = [
        { type: 'slowmo', color: '#00FFFF', icon: '⏰', name: 'SLOW MOTION' },
        { type: 'magnet', color: '#FF69B4', icon: '🧲', name: 'PAPER MAGNET' },
        { type: 'double', color: '#FFD700', icon: '2️⃣', name: 'DOUBLE POINTS' },
        { type: 'vacuum', color: '#9370DB', icon: '🌪️', name: 'PAPER VACUUM' },
        { type: 'freeze', color: '#87CEEB', icon: '❄️', name: 'TIME FREEZE' }
    ];
    
    const powerUpType = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
    const x = Math.random() * (canvas.width - 200) + 100;
    const y = Math.random() * (canvas.height - 200) + 100;
    
    const powerUp = Bodies.circle(x, y, 25, {
        render: {
            fillStyle: powerUpType.color,
            strokeStyle: '#FFFFFF',
            lineWidth: 3
        },
        isSensor: true, // Doesn't affect physics
        label: 'powerup',
        isStatic: false
    });
    
    powerUp.powerUpType = powerUpType.type;
    powerUp.powerUpName = powerUpType.name;
    powerUp.powerUpIcon = powerUpType.icon;
    powerUp.spawnTime = Date.now();
    
    World.add(world, powerUp);
    powerUps.push(powerUp);
    
    // Gentle floating motion
    Body.setVelocity(powerUp, {
        x: (Math.random() - 0.5) * 2,
        y: (Math.random() - 0.5) * 2
    });
    
    // Power-up spawn effect
    createPowerUpEffect(x, y, powerUpType.color);
}

// Activate power-up effects
function activatePowerUp(powerUp) {
    const now = Date.now();
    const duration = 8000; // 8 seconds
    
    switch(powerUp.powerUpType) {
        case 'slowmo':
            game.slowMotion = true;
            game.slowMotionEnd = now + duration;
            engine.timing.timeScale = 0.3; // Slow down physics
            break;
            
        case 'magnet':
            game.magneticMode = true;
            game.magneticEnd = now + duration;
            break;
            
        case 'double':
            game.doublePoints = true;
            game.doublePointsEnd = now + duration;
            break;
            
        case 'vacuum':
            // Instantly pull all papers toward center
            papers.forEach(paper => {
                const centerX = canvas.width / 2;
                const centerY = canvas.height / 2;
                const dx = centerX - paper.position.x;
                const dy = centerY - paper.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance > 0) {
                    Body.setVelocity(paper, {
                        x: (dx / distance) * 8,
                        y: (dy / distance) * 8
                    });
                }
            });
            break;
            
        case 'freeze':
            // Freeze all papers for a moment
            papers.forEach(paper => {
                Body.setVelocity(paper, { x: 0, y: 0 });
            });
            break;
    }
    
    // Power-up activation effect
    createActivationEffect(powerUp.powerUpName, powerUp.powerUpIcon);
    game.score += 5; // Bonus for collecting power-up
}

// Collision detection for bins and time management
Events.on(engine, 'beforeUpdate', function() {
    const now = Date.now();
    
    papers.forEach((paper, index) => {
        // Check if paper is overdue
        const timeOnDesk = now - paper.spawnTime;
        if (timeOnDesk > paper.timeLimit && !paper.isOverdue) {
            paper.isOverdue = true;
            // Keep original color but add flashing red border instead
            paper.render.strokeStyle = '#FF4444';
            paper.render.lineWidth = 4;
            game.score -= 5; // Penalty for letting paper sit too long
            game.penalties++;
        }
        
        // Flash overdue papers
        if (paper.isOverdue) {
            const flashCycle = Math.floor(now / 300) % 2; // Flash every 300ms
            paper.render.strokeStyle = flashCycle ? '#FF4444' : '#FF8888';
            paper.render.lineWidth = flashCycle ? 5 : 3;
        }
        
        // MAGNETIC MODE EFFECT! 🧲
        if (game.magneticMode && !draggedPaper) {
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const dx = centerX - paper.position.x;
            const dy = centerY - paper.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 50) { // Don't pull if too close to center
                const pullStrength = 0.002;
                Body.applyForce(paper, paper.position, {
                    x: dx * pullStrength,
                    y: dy * pullStrength
                });
            }
        }
        
        // Note: Collision detection now handled by Matter.js events below
        
        // Remove papers that fall off screen
        if (paper.position.y > canvas.height + 100) {
            World.remove(world, paper);
            papers.splice(index, 1);
        }
    });
});

// Matter.js collision detection events - PROPER collision system!
Events.on(engine, 'collisionStart', function(event) {
    const pairs = event.pairs;
    
    pairs.forEach(pair => {
        const { bodyA, bodyB } = pair;
        
        // Check if collision is between paper and bin
        let paper = null;
        let binName = null;
        let bin = null;
        let powerUp = null;
        
        // Paper-bin collision
        if (bodyA.label === 'paper' && Object.values(bins).some(b => b.body === bodyB)) {
            paper = bodyA;
            binName = Object.keys(bins).find(key => bins[key].body === bodyB);
            bin = bins[binName];
        } else if (bodyB.label === 'paper' && Object.values(bins).some(b => b.body === bodyA)) {
            paper = bodyB;
            binName = Object.keys(bins).find(key => bins[key].body === bodyA);
            bin = bins[binName];
        }
        
        // Paper-powerup collision
        if (bodyA.label === 'paper' && bodyB.label === 'powerup') {
            powerUp = bodyB;
        } else if (bodyB.label === 'paper' && bodyA.label === 'powerup') {
            powerUp = bodyA;
        }
        
        // Handle power-up collection
        if (powerUp) {
            activatePowerUp(powerUp);
            World.remove(world, powerUp);
            const powerUpIndex = powerUps.indexOf(powerUp);
            if (powerUpIndex > -1) {
                powerUps.splice(powerUpIndex, 1);
            }
            updateUI();
            return; // Don't process paper-bin collision if power-up was collected
        }
        
        if (paper && bin && binName) {
            const now = Date.now();
            const timeOnDesk = now - paper.spawnTime;
            
            // Check if this is a valid bin for this paper type
            const isValidBin = paper.validBins.includes(binName);
            let points = 0;
            let effectColor = bin.color;
            
            if (isValidBin) {
                // Correct bin - calculate points with combo bonus
                points = bin.points;
                
                // Combo system
                if (now - game.lastTrashTime < game.comboWindow) {
                    game.combo++;
                    points += game.combo * 2; // Bonus points for combo
                } else {
                    game.combo = 0;
                }
                game.lastTrashTime = now;
                
                // Time bonus - extra points for quick processing
                const timeBonus = Math.max(0, Math.floor((paper.timeLimit - timeOnDesk) / 1000));
                points += timeBonus;
                
            } else {
                // Wrong bin - penalty!
                points = -15;
                effectColor = '#FF0000';
                game.penalties++;
                game.combo = 0; // Reset combo on mistake
            }
            
            // Apply double points if active
            if (game.doublePoints && points > 0) {
                points *= 2;
            }
            
            // Remove paper from world and array
            World.remove(world, paper);
            const paperIndex = papers.indexOf(paper);
            if (paperIndex > -1) {
                papers.splice(paperIndex, 1);
            }
            
            // Update score
            game.score += points;
            game.papersTrash++;
            
            // SPECIAL SHREDDER JUICE! 🔥
            if (binName === 'shred' && isValidBin) {
                console.log('SHREDDING!', paper.paperType, 'in', binName); // Debug log
                createShredderEffect(paper.position.x, paper.position.y, paper.render.fillStyle);
                createScreenShake(15, 600); // More intense shake for shredder
                
                // Shredder "chomp" visual effect
                createShredderChomp();
            } else {
                console.log('Regular trash:', paper.paperType, 'in', binName, 'valid:', isValidBin); // Debug log
                // Regular trash effect for other bins
                createTrashEffect(paper.position.x, paper.position.y, effectColor);
                
                // Medium shake for correct bins, small for wrong bins
                if (isValidBin) {
                    createScreenShake(8, 400);
                } else {
                    createScreenShake(12, 500); // Wrong bin gets angry shake
                }
            }
            
            // Show points popup
            createPointsPopup(paper.position.x, paper.position.y, points, game.combo);
            
            updateUI();
        }
    });
});

// Create visual effect when paper is trashed
function createTrashEffect(x, y, color) {
    const particles = [];
    for (let i = 0; i < 8; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            life: 30,
            color: color
        });
    }
    
    // Animate particles
    const animateParticles = () => {
        ctx.save();
        particles.forEach((particle, index) => {
            if (particle.life <= 0) {
                particles.splice(index, 1);
                return;
            }
            
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.life--;
            
            ctx.globalAlpha = particle.life / 30;
            ctx.fillStyle = particle.color;
            ctx.fillRect(particle.x - 2, particle.y - 2, 4, 4);
        });
        ctx.restore();
        
        if (particles.length > 0) {
            requestAnimationFrame(animateParticles);
        }
    };
    
    animateParticles();
}

// Create points popup effect
function createPointsPopup(x, y, points, combo) {
    const popup = document.createElement('div');
    popup.style.position = 'absolute';
    popup.style.left = x + 'px';
    popup.style.top = y + 'px';
    popup.style.color = points > 0 ? '#00FF00' : '#FF0000';
    popup.style.fontWeight = 'bold';
    popup.style.fontSize = '18px';
    popup.style.pointerEvents = 'none';
    popup.style.zIndex = '1000';
    popup.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
    
    let text = points > 0 ? '+' + points : points.toString();
    if (combo > 0) {
        text += ` (${combo}x combo!)`;
    }
    popup.textContent = text;
    
    document.body.appendChild(popup);
    
    // Animate popup
    let opacity = 1;
    let yPos = y;
    let frames = 0;
    const animate = () => {
        frames++;
        
        // Stay visible for first 60 frames (about 1 second)
        if (frames > 60) {
            opacity -= 0.02; // Slower fade
            yPos -= 1; // Slower movement
        } else {
            yPos -= 0.5; // Gentle initial movement
        }
        
        popup.style.opacity = opacity;
        popup.style.top = yPos + 'px';
        
        if (opacity <= 0) {
            document.body.removeChild(popup);
        } else {
            requestAnimationFrame(animate);
        }
    };
    animate();
}

// Create printer visual effect
function createPrinterEffect() {
    // Create a brief flash effect when printer works
    const flash = document.createElement('div');
    flash.style.position = 'absolute';
    flash.style.left = printer.x + 'px';
    flash.style.top = printer.y + 'px';
    flash.style.width = printer.width + 'px';
    flash.style.height = printer.height + 'px';
    flash.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
    flash.style.borderRadius = '5px';
    flash.style.pointerEvents = 'none';
    flash.style.zIndex = '999';
    
    document.body.appendChild(flash);
    
    setTimeout(() => {
        if (document.body.contains(flash)) {
            document.body.removeChild(flash);
        }
    }, 200);
}

// Create fax machine visual effect
function createFaxEffect() {
    const flash = document.createElement('div');
    flash.style.position = 'absolute';
    flash.style.left = faxMachine.x + 'px';
    flash.style.top = faxMachine.y + 'px';
    flash.style.width = faxMachine.width + 'px';
    flash.style.height = faxMachine.height + 'px';
    flash.style.backgroundColor = 'rgba(0, 255, 0, 0.6)';
    flash.style.borderRadius = '8px';
    flash.style.pointerEvents = 'none';
    flash.style.zIndex = '999';
    
    document.body.appendChild(flash);
    
    setTimeout(() => {
        if (document.body.contains(flash)) {
            document.body.removeChild(flash);
        }
    }, 300);
}

// Wind Gust - NEW MECHANIC!
function createWindGust() {
    // Random wind direction
    const windDirections = [
        { x: 8, y: 0, name: "→ EAST WIND" },    // East (right)
        { x: -8, y: 0, name: "← WEST WIND" },   // West (left)
        { x: 0, y: -6, name: "↑ NORTH WIND" },  // North (up)
        { x: 0, y: 6, name: "↓ SOUTH WIND" },   // South (down)
        { x: 6, y: -4, name: "↗ NORTHEAST" },   // Northeast
        { x: -6, y: -4, name: "↖ NORTHWEST" }   // Northwest
    ];
    
    const selectedWind = windDirections[Math.floor(Math.random() * windDirections.length)];
    
    // Apply wind force over time for sustained effect
    let windPulses = 0;
    const maxPulses = 8; // More pulses = longer lasting wind
    
    const applyWindPulse = () => {
        papers.forEach(paper => {
            if (!draggedPaper || paper !== draggedPaper) { // Don't affect dragged papers
                const currentVel = paper.velocity;
                const strength = Math.max(0.2, 1 - (windPulses / maxPulses)); // Diminishing strength
                Body.setVelocity(paper, {
                    x: currentVel.x + selectedWind.x * strength + (Math.random() - 0.5) * 2,
                    y: currentVel.y + selectedWind.y * strength + (Math.random() - 0.5) * 2
                });
            }
        });
        
        windPulses++;
        if (windPulses < maxPulses) {
            setTimeout(applyWindPulse, 150); // Apply wind every 150ms for 1.2 seconds total
        }
    };
    
    applyWindPulse(); // Start the wind effect
    
    // Visual wind effect
    createWindEffect(selectedWind.name);
    
    // Longer screen shake effect
    let shakeCount = 0;
    const maxShakes = 6;
    const shakeEffect = () => {
        document.body.style.transform = 'translate(' + (Math.random() - 0.5) * 6 + 'px, ' + (Math.random() - 0.5) * 6 + 'px)';
        shakeCount++;
        if (shakeCount < maxShakes) {
            setTimeout(shakeEffect, 200);
        } else {
            document.body.style.transform = '';
        }
    };
    shakeEffect();
}

// Create wind visual effect
function createWindEffect(windName) {
    const windAlert = document.createElement('div');
    windAlert.style.position = 'absolute';
    windAlert.style.left = '50%';
    windAlert.style.top = '30%';
    windAlert.style.transform = 'translateX(-50%)';
    windAlert.style.color = '#00FFFF';
    windAlert.style.fontSize = '24px';
    windAlert.style.fontWeight = 'bold';
    windAlert.style.textShadow = '3px 3px 6px rgba(0,0,0,0.8)';
    windAlert.style.pointerEvents = 'none';
    windAlert.style.zIndex = '1000';
    windAlert.textContent = windName + "!";
    
    document.body.appendChild(windAlert);
    
    // Much longer display duration
    setTimeout(() => {
        // Fade out animation after staying visible longer
        let opacity = 1;
        const fadeOut = () => {
            opacity -= 0.01; // Much slower fade
            windAlert.style.opacity = opacity;
            if (opacity > 0) {
                requestAnimationFrame(fadeOut);
            } else {
                if (document.body.contains(windAlert)) {
                    document.body.removeChild(windAlert);
                }
            }
        };
        fadeOut();
    }, 2000); // Stay at full opacity for 2 seconds before starting to fade
}

// JUICY VISUAL EFFECTS! ✨

// Power-up spawn effect
function createPowerUpEffect(x, y, color) {
    for (let i = 0; i < 12; i++) {
        const particle = document.createElement('div');
        particle.style.position = 'absolute';
        particle.style.left = x + 'px';
        particle.style.top = y + 'px';
        particle.style.width = '8px';
        particle.style.height = '8px';
        particle.style.backgroundColor = color;
        particle.style.borderRadius = '50%';
        particle.style.pointerEvents = 'none';
        particle.style.zIndex = '1000';
        
        document.body.appendChild(particle);
        
        // Animate particles in a burst
        const angle = (i / 12) * Math.PI * 2;
        const speed = 100 + Math.random() * 50;
        let vx = Math.cos(angle) * speed;
        let vy = Math.sin(angle) * speed;
        let px = x, py = y;
        let life = 100;
        
        const animateParticle = () => {
            life -= 3;
            px += vx * 0.02;
            py += vy * 0.02;
            vx *= 0.98;
            vy *= 0.98;
            
            particle.style.left = px + 'px';
            particle.style.top = py + 'px';
            particle.style.opacity = life / 100;
            
            if (life > 0) {
                requestAnimationFrame(animateParticle);
            } else if (document.body.contains(particle)) {
                document.body.removeChild(particle);
            }
        };
        animateParticle();
    }
}

// Power-up activation effect
function createActivationEffect(name, icon) {
    const effect = document.createElement('div');
    effect.style.position = 'absolute';
    effect.style.left = '50%';
    effect.style.top = '20%';
    effect.style.transform = 'translateX(-50%)';
    effect.style.color = '#FFD700';
    effect.style.fontSize = '32px';
    effect.style.fontWeight = 'bold';
    effect.style.textShadow = '3px 3px 6px rgba(0,0,0,0.8)';
    effect.style.pointerEvents = 'none';
    effect.style.zIndex = '1000';
    effect.textContent = icon + ' ' + name + ' ACTIVATED!';
    
    document.body.appendChild(effect);
    
    // Bounce and fade animation
    let scale = 0.5;
    let opacity = 1;
    const animate = () => {
        scale += (1.2 - scale) * 0.1;
        opacity -= 0.015;
        
        effect.style.transform = `translateX(-50%) scale(${scale})`;
        effect.style.opacity = opacity;
        
        if (opacity > 0) {
            requestAnimationFrame(animate);
        } else if (document.body.contains(effect)) {
            document.body.removeChild(effect);
        }
    };
    animate();
    
    // Screen flash effect
    const flash = document.createElement('div');
    flash.style.position = 'absolute';
    flash.style.top = '0';
    flash.style.left = '0';
    flash.style.width = '100%';
    flash.style.height = '100%';
    flash.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
    flash.style.pointerEvents = 'none';
    flash.style.zIndex = '999';
    
    document.body.appendChild(flash);
    setTimeout(() => {
        if (document.body.contains(flash)) {
            document.body.removeChild(flash);
        }
    }, 150);
}

// Enhanced screen shake
function createScreenShake(intensity = 10, duration = 500) {
    game.screenShakeIntensity = intensity;
    const startTime = Date.now();
    
    const shake = () => {
        const elapsed = Date.now() - startTime;
        const progress = elapsed / duration;
        
        if (progress < 1) {
            const currentIntensity = intensity * (1 - progress);
            const offsetX = (Math.random() - 0.5) * currentIntensity;
            const offsetY = (Math.random() - 0.5) * currentIntensity;
            
            document.body.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
            requestAnimationFrame(shake);
        } else {
            document.body.style.transform = '';
            game.screenShakeIntensity = 0;
        }
    };
    shake();
}

// Update UI
function updateUI() {
    document.getElementById('score').textContent = game.score;
    document.getElementById('trashed').textContent = game.papersTrash;
    
    const deskSpacePercent = Math.max(0, ((game.maxDeskSpace - papers.length) / game.maxDeskSpace) * 100);
    document.getElementById('deskSpace').textContent = Math.round(deskSpacePercent) + '%';
    
    // Update combo display
    const comboDisplay = document.getElementById('combo');
    const comboValue = document.getElementById('comboValue');
    if (comboDisplay && comboValue) {
        comboValue.textContent = game.combo;
        comboDisplay.style.display = game.combo > 0 ? 'block' : 'none';
    }
    
    // Update penalties display
    const penaltiesDisplay = document.getElementById('penalties');
    if (penaltiesDisplay) {
        penaltiesDisplay.textContent = game.penalties;
    }
    
    // POWER-UP STATUS DISPLAY! ⚡
    const now = Date.now();
    let activeEffectsText = '';
    
    if (game.slowMotion) {
        const timeLeft = Math.ceil((game.slowMotionEnd - now) / 1000);
        activeEffectsText += `⏰ SLOW-MO (${timeLeft}s) `;
    }
    
    if (game.magneticMode) {
        const timeLeft = Math.ceil((game.magneticEnd - now) / 1000);
        activeEffectsText += `🧲 MAGNET (${timeLeft}s) `;
    }
    
    if (game.doublePoints) {
        const timeLeft = Math.ceil((game.doublePointsEnd - now) / 1000);
        activeEffectsText += `2️⃣ DOUBLE (${timeLeft}s) `;
    }
    
    // Update active effects display
    let effectsDisplay = document.getElementById('activeEffects');
    if (!effectsDisplay) {
        effectsDisplay = document.createElement('div');
        effectsDisplay.id = 'activeEffects';
        effectsDisplay.style.position = 'absolute';
        effectsDisplay.style.bottom = '20px';
        effectsDisplay.style.left = '50%';
        effectsDisplay.style.transform = 'translateX(-50%)';
        effectsDisplay.style.color = '#FFD700';
        effectsDisplay.style.fontSize = '18px';
        effectsDisplay.style.fontWeight = 'bold';
        effectsDisplay.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
        effectsDisplay.style.pointerEvents = 'none';
        effectsDisplay.style.zIndex = '100';
        document.body.appendChild(effectsDisplay);
    }
    
    effectsDisplay.textContent = activeEffectsText;
    effectsDisplay.style.display = activeEffectsText ? 'block' : 'none';
}

// Game loop
function gameLoop() {
    const now = Date.now();
    
    // Spawn papers from sides
    if (now - game.lastSpawn > game.paperSpawnRate) {
        createPaper();
        game.lastSpawn = now;
        
        // Increase difficulty over time
        if (game.paperSpawnRate > 800) {
            game.paperSpawnRate -= 10;
        }
    }
    
    // Receipt printer papers
    if (now - printer.lastPrint > printer.printInterval) {
        createPrinterPaper();
        printer.lastPrint = now;
        
        // Printer gets faster over time too
        if (printer.printInterval > 1500) {
            printer.printInterval -= 50;
        }
    }
    
    // Fax machine papers
    if (now - faxMachine.lastFax > faxMachine.faxInterval) {
        createFaxPaper();
        faxMachine.lastFax = now;
        
        // Fax gets faster over time too
        if (faxMachine.faxInterval > 2000) {
            faxMachine.faxInterval -= 100;
        }
    }
    
    // Wind gusts - NEW MECHANIC!
    if (now - game.lastWindGust > game.windGustInterval) {
        createWindGust();
        game.lastWindGust = now;
        
        // Wind gusts become more frequent over time
        if (game.windGustInterval > 4000) {
            game.windGustInterval -= 200;
        }
    }
    
    // POWER-UP SPAWNING! 🌟
    if (now - game.lastPowerUp > game.powerUpInterval) {
        createPowerUp();
        game.lastPowerUp = now;
        
        // Power-ups spawn more frequently over time
        if (game.powerUpInterval > 8000) {
            game.powerUpInterval -= 500;
        }
    }
    
    // ACTIVE EFFECT MANAGEMENT! ⚡
    // Check if slow motion should end
    if (game.slowMotion && now > game.slowMotionEnd) {
        game.slowMotion = false;
        engine.timing.timeScale = 1; // Restore normal speed
        createScreenShake(5, 300); // Small shake when effect ends
    }
    
    // Check if magnetic mode should end
    if (game.magneticMode && now > game.magneticEnd) {
        game.magneticMode = false;
        createScreenShake(5, 300);
    }
    
    // Check if double points should end
    if (game.doublePoints && now > game.doublePointsEnd) {
        game.doublePoints = false;
        createScreenShake(5, 300);
    }
    
    // Clean up old power-ups (they expire after 20 seconds)
    powerUps.forEach((powerUp, index) => {
        if (now - powerUp.spawnTime > 20000) {
            World.remove(world, powerUp);
            powerUps.splice(index, 1);
        }
    });
    
    updateUI();
    requestAnimationFrame(gameLoop);
}

// Start the game
Engine.run(engine);
Render.run(render);
gameLoop();

// Initial papers
for (let i = 0; i < 3; i++) {
    setTimeout(() => createPaper(), i * 500);
}

// SHREDDER JUICE EFFECTS! 🔥🗃️

// Shredder particle effect - paper gets torn into strips!
function createShredderEffect(x, y, paperColor) {
    // Create shredded paper strips
    for (let i = 0; i < 25; i++) {
        const strip = document.createElement('div');
        strip.style.position = 'absolute';
        strip.style.left = x + 'px';
        strip.style.top = y + 'px';
        strip.style.width = (2 + Math.random() * 4) + 'px';  // Thin strips
        strip.style.height = (8 + Math.random() * 12) + 'px'; // Longer pieces
        strip.style.backgroundColor = paperColor;
        strip.style.borderRadius = '1px';
        strip.style.pointerEvents = 'none';
        strip.style.zIndex = '1000';
        strip.style.boxShadow = '0 0 3px rgba(0,0,0,0.3)';
        
        document.body.appendChild(strip);
        
        // Animate strips flying out in all directions
        const angle = (Math.random() * Math.PI * 2);
        const speed = 80 + Math.random() * 120;
        const gravity = 0.3;
        let vx = Math.cos(angle) * speed;
        let vy = Math.sin(angle) * speed;
        let px = x, py = y;
        let rotation = Math.random() * 360;
        let rotationSpeed = (Math.random() - 0.5) * 20;
        let life = 120;
        
        const animateStrip = () => {
            life -= 2;
            px += vx * 0.02;
            py += vy * 0.02;
            vy += gravity; // Gravity pulls strips down
            vx *= 0.99; // Air resistance
            vy *= 0.99;
            rotation += rotationSpeed;
            
            strip.style.left = px + 'px';
            strip.style.top = py + 'px';
            strip.style.transform = `rotate(${rotation}deg)`;
            strip.style.opacity = Math.max(0, life / 120);
            
            if (life > 0 && py < window.innerHeight + 100) {
                requestAnimationFrame(animateStrip);
            } else if (document.body.contains(strip)) {
                document.body.removeChild(strip);
            }
        };
        animateStrip();
    }
    
    // Red sparks effect for the shredding action
    for (let i = 0; i < 15; i++) {
        const spark = document.createElement('div');
        spark.style.position = 'absolute';
        spark.style.left = x + 'px';
        spark.style.top = y + 'px';
        spark.style.width = '3px';
        spark.style.height = '3px';
        spark.style.backgroundColor = '#FF6600';
        spark.style.borderRadius = '50%';
        spark.style.pointerEvents = 'none';
        spark.style.zIndex = '1001';
        spark.style.boxShadow = '0 0 6px #FF6600';
        
        document.body.appendChild(spark);
        
        const sparkAngle = Math.random() * Math.PI * 2;
        const sparkSpeed = 60 + Math.random() * 80;
        let sparkVx = Math.cos(sparkAngle) * sparkSpeed;
        let sparkVy = Math.sin(sparkAngle) * sparkSpeed;
        let sparkPx = x, sparkPy = y;
        let sparkLife = 60;
        
        const animateSpark = () => {
            sparkLife -= 4;
            sparkPx += sparkVx * 0.015;
            sparkPy += sparkVy * 0.015;
            sparkVx *= 0.95;
            sparkVy *= 0.95;
            
            spark.style.left = sparkPx + 'px';
            spark.style.top = sparkPy + 'px';
            spark.style.opacity = sparkLife / 60;
            
            if (sparkLife > 0) {
                requestAnimationFrame(animateSpark);
            } else if (document.body.contains(spark)) {
                document.body.removeChild(spark);
            }
        };
        animateSpark();
    }
}

// Shredder "chomp" effect - make the shredder bin react!
function createShredderChomp() {
    // Get the shredder bin correctly
    const shredderBin = bins.shred;
    if (!shredderBin) return;
    
    // Flash the shredder bin red
    const originalColor = shredderBin.body.render.fillStyle;
    shredderBin.body.render.fillStyle = '#FF4444';
    
    // Create "CHOMP!" text effect
    const chompText = document.createElement('div');
    chompText.style.position = 'absolute';
    chompText.style.left = (canvas.width - 100) + 'px';
    chompText.style.top = (canvas.height - 80) + 'px';
    chompText.style.color = '#FF0000';
    chompText.style.fontSize = '24px';
    chompText.style.fontWeight = 'bold';
    chompText.style.textShadow = '3px 3px 6px rgba(0,0,0,0.8)';
    chompText.style.pointerEvents = 'none';
    chompText.style.zIndex = '1000';
    chompText.textContent = 'CHOMP!';
    
    document.body.appendChild(chompText);
    
    // Animate the chomp text
    let scale = 0.5;
    let opacity = 1;
    const animateChomp = () => {
        scale += (1.5 - scale) * 0.15;
        opacity -= 0.025;
        
        chompText.style.transform = `scale(${scale})`;
        chompText.style.opacity = opacity;
        
        if (opacity > 0) {
            requestAnimationFrame(animateChomp);
        } else if (document.body.contains(chompText)) {
            document.body.removeChild(chompText);
        }
    };
    animateChomp();
    
    // Restore shredder color after flash
    setTimeout(() => {
        if (shredderBin && shredderBin.body) {
            shredderBin.body.render.fillStyle = originalColor;
        }
    }, 200);
} 