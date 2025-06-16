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
    windGustInterval: 8000 // Wind gust every 8 seconds
};

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
        
        if (bodyA.label === 'paper' && Object.values(bins).some(b => b.body === bodyB)) {
            paper = bodyA;
            binName = Object.keys(bins).find(key => bins[key].body === bodyB);
            bin = bins[binName];
        } else if (bodyB.label === 'paper' && Object.values(bins).some(b => b.body === bodyA)) {
            paper = bodyB;
            binName = Object.keys(bins).find(key => bins[key].body === bodyA);
            bin = bins[binName];
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
            
            // Remove paper from world and array
            World.remove(world, paper);
            const paperIndex = papers.indexOf(paper);
            if (paperIndex > -1) {
                papers.splice(paperIndex, 1);
            }
            
            // Update score
            game.score += points;
            game.papersTrash++;
            
            // Visual feedback
            createTrashEffect(paper.position.x, paper.position.y, effectColor);
            
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