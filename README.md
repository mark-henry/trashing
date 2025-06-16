ENTIRELY VIBE-CODED FOR VIBE CODING FUN SUNDAY EVENT :)
I ended up using claude-4-sonnet exclusively. If you just keep egging it on it gets pretty peppy and uses a lot of emoji

# Zero-G Paper Chaos! 🌪️📄

A physics-based paper management game built with HTML5 Canvas and Matter.js. Manage chaos in zero gravity as papers fly at you from all directions!

## 🎮 How to Play

1. **Start a local server**: `python3 -m http.server 8000`
2. **Open browser**: Navigate to `http://localhost:8000`
3. **Drag & fling papers** into the correct bins
4. **Survive the chaos** as papers spawn faster and wind gusts mess up your plans!

## 🚀 Game Mechanics

### Paper Types & Sorting Rules
- **📄 Regular** (gray): Can go in trash OR recycle bins
- **📝 Sticky** (gold): MUST go in trash bin only
- **🔒 Confidential** (red): MUST be shredded only!
- **♻️ Recyclable** (green): MUST go in recycle bin only!
- **📋 Crumpled** (purple): Can go in trash OR recycle bins

### Scoring System
- **🗑️ Trash**: 10 points
- **♻️ Recycle**: 15 points  
- **📄 Shred**: 20 points
- **Wrong bin**: -15 points penalty
- **Overdue papers**: -5 points penalty
- **Combo bonus**: +2 points per combo level
- **Time bonus**: Extra points for quick processing

### Environmental Chaos
- **Papers fly in** from left, right, and top edges at high speed
- **🖨️ Receipt printer** drops papers every 3 seconds (gets faster)
- **📠 Fax machine** slides out papers every 4.5 seconds (gets faster)
- **🌪️ Wind gusts** blow all papers around every 8 seconds (gets more frequent)
- **Overdue papers** flash with red borders when time runs out

## ✨ Technical Features

### Physics Engine
- **Matter.js** for realistic paper physics
- **Zero gravity** environment - papers float until interacted with
- **Proper collision detection** using Matter.js events
- **Thick boundary walls** prevent high-speed papers from escaping
- **Custom drag/fling mechanics** with velocity-based throwing

### Visual Effects
- **Particle effects** when papers are processed
- **Points popups** showing score changes and combos
- **Screen shake** during wind gusts
- **Machine flash effects** when printer/fax operate
- **Flashing red borders** for overdue papers (preserves paper type colors)

### Performance Optimizations
- **Event-driven collision detection** (no distance calculations every frame)
- **Efficient particle systems** with cleanup
- **Optimized physics iterations** for smooth high-speed collisions
- **Non-blocking UI elements** with `pointer-events: none`

## 🎯 Game Progression

The game gets progressively more chaotic:
- **Paper spawn rate** increases over time
- **Machine speeds** increase (printer & fax get faster)
- **Wind gust frequency** increases
- **Multiple simultaneous challenges** require StarCraft-like macro management

## 🛠️ Technical Stack

- **HTML5 Canvas** for rendering
- **Matter.js** for physics simulation
- **Vanilla JavaScript** for game logic
- **CSS3** for UI styling
- **No build tools** - runs directly in browser

## 🎨 Visual Design

- **Wood desk theme** with warm brown gradients
- **Office aesthetic** with realistic printer and fax machine designs
- **Clear visual hierarchy** with distinct paper colors and bin designs
- **Accessible UI** with high contrast text and clear instructions

## 🔧 Controls

- **Drag papers** by clicking and holding
- **Fling papers** by quickly moving mouse while dragging
- **Papers auto-process** when they collide with bins
- **Full screen interaction** - no blocked click areas

---

*Built during a collaborative coding session exploring physics-based game mechanics and progressive complexity systems.* 