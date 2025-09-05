# RPS Physics Battle Simulator

An interactive, deterministic Rock–Paper–Scissors ecosystem on an HTML5 canvas. Entities move, collide, and transform the weaker type into the stronger — until only one type remains!

**Types included:**

- Rock (circle)
- Paper (square)
- Scissors (triangle)
- Lizard (diamond)
- Spock (pentagon)

**Demo:** [Play it here](https://darylf.github.io/rps-simulator/)

## 🧪 Quick Start

1. Clone/download the repo.
2. Open `index.html` in a modern browser.
3. Click **Start**. Tweak counts, speed, size, and wall mode; use **Reset** to re-spawn with current settings.

> **Note:** For the "Copy Seed" button, some browsers require HTTPS or `localhost`.

## 🧠 Rules (beats map)

### Basic Rules

- Rock crushes Scissors and Lizard
- Paper covers Rock and disproves Spock
- Scissors cut Paper and decapitate Lizard
- Lizard eats Paper and poisons Spock
- Spock smashes Scissors and vaporizes Rock

### Technical "Beats" Map

```js
const beats = {
  circle:   ['triangle', 'lizard'], // Rock crushes Scissors & Lizard
  square:   ['circle', 'spock'],    // Paper covers Rock & disproves Spock
  triangle: ['square', 'lizard'],   // Scissors cut Paper & decapitate Lizard
  lizard:   ['spock', 'square'],    // Lizard poisons Spock & eats Paper
  spock:    ['triangle', 'circle'], // Spock smashes Scissors & vaporizes Rock
};
```

## ✨ Features

- **Classic + Extended Rules:**
  Play not just Rock–Paper–Scissors, but the full **RPSLS** set (Rock, Paper, Scissors, Lizard, Spock), with clear shape + letter labels for easy tracking.

- **Interactive Sandbox:**
  Adjust population sizes, speed, and entity size to see how different setups evolve. Reset or clear anytime to try new scenarios.

- **Different Worlds:**
  Switch between **bouncing walls** (like a box of marbles) and **wrapping space** (an endless torus where edges loop around).

- **Seeded Reproducibility:**
  Lock in a random seed for repeatable experiments — or randomize for fresh outcomes. Copy/paste seeds to share scenarios with others.

- **Live Stats and Visuals:**
  Always know which type is winning:
  - Totals per type
  - A color-coded population mix bar
  - A timeline sparkline tracking proportions over time

- **Accessible & Shareable:**
  Runs in any modern browser — no install needed. Saves your settings locally so you can pick up where you left off.

- **Safe Limits:**
  Built-in caps keep the simulation smooth even with large populations.

## 🔧 Developer Notes

### Project Structure

```text
index.html   # Markup and control panel wiring
main.css     # Theme, layout, legend/mix bar/sparkline styles, toasts
sim.js       # Simulation, physics, RNG, UI logic, charts
```

### Key Constants

```js
const MAX_ENTITIES_PER_TYPE = 500; // per-type cap
const MAX_TOTAL_ENTITIES    = 1200; // global cap
const MAX_SEED_LEN          = 128;  // seed truncation guard

const FIXED_DT = 1/60;  // step in seconds
const REST     = 1.0;   // restitution (1 = perfectly elastic)
const VMAX     = 600;   // px/s velocity clamp
const EPS      = 1e-3;  // separation slop
```

## 🗺️ Roadmap and Planned Features

- Optional **batched rendering** (by type) for higher entity counts.
- Toggleable **debug overlay** (grid, FPS, pair count).
- Poisson/jittered **low-overlap spawn** mode.
- UI editor for custom beats maps.

## 📝 License

Released under the [MIT License](LICENSE).  

You are free to use, modify, and distribute this software for personal or commercial purposes, provided that the copyright notice is included.
