/*
 * Copyright (c) 2024 by Rock de Vocht
 *
 * All rights reserved. No part of this publication may be reproduced, distributed, or
 * transmitted in any form or by any means, including photocopying, recording, or other
 * electronic or mechanical methods, without the prior written permission of the publisher,
 * except in the case of brief quotations embodied in critical reviews and certain other
 * noncommercial uses permitted by copyright law.
 *
 */

// graphics holders
let lander_svg = null;
let star_svg = null;
let arrow_svg = null;
let star_scape = [];
let explosion_svg = null;
const flames_svg = [];
const pi = 3.1415926

// main data structure for vehicle
let lander = {}
let explosion_counter = -1;
const explosion_init_size = 5;
const max_explosion_size = 200;
const explosion_increment = 5;

// game state;  one of {game over, running, landed}
let game_state = "game over";

// landscape and stars
const num_stars = 100;
const num_hills = 20;
let landscape_polygon = [];
// where the platform is located inside the landscape (offset into landscape_polygon)
let platform_index = 0

// screen size
const w = 1920;
const h = 1080;
const lander_size = 64

// game constants - like gravity and wind
const gravity = 0.1;
const max_gravity = 5.0;
const max_horizontal = 3.0;

let wind_strength = 0.0
const max_wind_strength = 0.5
const max_wind_influence_height = h * 0.5
let wind_height_adjust = 1.0
let wind_direction = -1
let wind_counter = 0

// audio
let title_track = null;

/////////////////////////////////////////////////////////////////////////////////////
// set up

function play_title_track() {
  if (!title_track) {
    title_track = new Audio('./music/little-tune.mp3'); 
    if (typeof title_track.loop == 'boolean') {
        title_track.loop = true;
    } else {
        title_track.addEventListener('ended', function() {
            this.currentTime = 0;
            this.play();
        }, false);
    }
    title_track.play();
  }
}

function stop_title_track() {
  if (title_track) {
    title_track.pause();
    title_track = null;
  }
}

// p5.js callback: load all graphics and set up
function preload(){
  lander_svg = loadImage("./assets/lander.svg");
  star_svg = loadImage("./assets/star.svg");
  arrow_svg = loadImage("./assets/arrow.svg");
  flames_svg.push(loadImage("./assets/flame1.svg"));
  flames_svg.push(loadImage("./assets/flame2.svg"));
  flames_svg.push(loadImage("./assets/flame3.svg"));
  explosion_svg = loadImage("./assets/explosion.svg")
}

// helper - return random int
function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

// p5.js callback: set up the game size and modes
function setup() {
  createCanvas(w, h);
  imageMode(CENTER);
  angleMode(DEGREES);
  frameRate(30);
  reset_stars();
  reset_lander();
  reset_landscape();
}

// reset the starry night
function reset_stars() {
  star_scape = [];
  for (i = 0; i < num_stars; i++) {
    star_scape.push({
      x: getRandomInt(w),
      y: getRandomInt(h),
      s: (getRandomInt(10) + 10),
      spin_speed: Math.random() + 0.2,
      r: getRandomInt(360)});
  }
}

// reset the status of the player's lander
function reset_lander() {
  lander = {
    x: w / 2,
    y: 50,
    r: 0.0,
    // delta x and y
    dx: 0.0,
    dy: 0.0,
    // fuel
    fuel: 100.0,
    fuel_usage: 0.1,
    // flame animation
    main_flame_on: false,
    left_flame_on: false,
    right_flame_on: false,
    flame: 0,
  }
}

// create a new landscape to land in
function reset_landscape() {
  landscape_polygon = [];
  let x = 0;
  platform_index = (num_hills / 4) + getRandomInt(num_hills - (num_hills / 2))
  const width = w / (num_hills + 1)
  for (let i = 0; i < num_hills + 1; i++) {
    const height = h - ((h / 7) + getRandomInt((h / 5)))
    landscape_polygon.push({x: x, y: height})
    x += width
    if (i === platform_index) {
      landscape_polygon.push({x: x, y: height})
      x += width
    }
  }
  // add the rest to close the n-gon
  landscape_polygon.push({x: x, y: h})
  landscape_polygon.push({x: 0, y: h})
  landscape_polygon.push({x: 0, y: landscape_polygon[0].y})
}

/////////////////////////////////////////////////////////////////////////////////////
// draw

// draw a fixed star field
function draw_stars() {
  for (i = 0; i < num_stars; i++) {
    const star = star_scape[i];
    push();
    translate(star.x, star.y);
    rotate(star.r);
    const size = (star.s + (star.s * Math.cos((star.r / 180) * pi))) * 0.5
    image(star_svg, 0, 0, size, size);
    star.r += star.spin_speed
    pop();
  }
}

// draw the game control panel showing where it is at
function draw_control_panel() {
  // panel width and height
  const pw = 280
  const ph = 130
  const gauge_width = 140
  // grey panel color
  fill(100, 100, 100)
  rect(w - ((pw / 2) + 10), (ph / 2) + 10, pw, ph, 10)
  fill(255)
  // draw text
  textSize(14)
  text("fuel", w - pw, ph - 80)
  text("safe", w - pw, ph - 50)
  text("wind", w - pw, ph - 20)

  // draw fuel gauge
  const fuel_multiplier = (lander.fuel / 100)
  const fuel_offset = (gauge_width * (1 - fuel_multiplier)) * 0.5
  fill(255, 0, 0)
  rect(w - ((pw / 2) + 30), (ph / 2) - 20, gauge_width, 10)
  fill(20, 20, 200)
  rect(w - ((pw / 2) + 30 + fuel_offset), (ph / 2) - 20, gauge_width *  fuel_multiplier, 10)

  // draw safe light
  fill(0)
  if (lander_safe()) {
    fill(20, 200, 20)
  } else {
    fill(200, 20, 20)
  }
  circle(w - ((pw / 2) + 90), (ph / 2) + 10, 15)

  // draw the wind speed
  const wind_size = Math.abs(wind_strength * 10 * wind_height_adjust);
  if (wind_size > 0) {
    push()
    translate(w - ((pw / 2) + 70), (ph / 2) + 40)
    if (wind_direction < 0) {
      rotate(180)
    }
    image(arrow_svg, 0, 0, 10 + wind_size, 20)
    pop()
  }
}

function draw_explosion() {
  if (explosion_counter < 0)
    return
  if (explosion_counter < max_explosion_size) {
    const half_point = max_explosion_size * 0.5
    const size = (explosion_counter < half_point) ?
        explosion_counter :
        (half_point - (explosion_counter - half_point));
    explosion_counter += explosion_increment
    if (explosion_counter < half_point) {
      draw_lander()
    }
    push();
    translate(lander.x, lander.y);
    rotate(lander.r);
    lander.r += 5
    image(explosion_svg, 0, 0, explosion_init_size + size, explosion_init_size + size);
    pop()
  }
}

// draw our lunar lander with engines etc.
function draw_lander() {
  if (lander) {
    push();
    translate(lander.x, lander.y);
    rotate(lander.r);
    image(lander_svg, 0, 0, lander_size, lander_size);

    const big_flame_offset = lander_size * 0.625;
    const big_flame_width = lander_size * 0.25;
    const big_flame_height = lander_size * 0.375;
    if (lander.main_flame_on) {
      push();
      rotate(180);
      translate(0, -big_flame_offset);
      image(flames_svg[lander.flame % flames_svg.length], 0, 0, big_flame_width, big_flame_height);
      pop();
    }

    const little_flame_offset = lander_size * 0.3125;
    const little_flame_width = lander_size * 0.125;
    const little_flame_height = lander_size * 0.1875;
    if (lander.right_flame_on) {
      push();
      translate(-little_flame_offset, -little_flame_offset);
      rotate(-90);
      image(flames_svg[lander.flame % flames_svg.length], 0, 0, little_flame_width, little_flame_height);
      pop();
    }

    if (lander.left_flame_on) {
      push();
      translate(little_flame_offset, -little_flame_offset);
      rotate(90);
      image(flames_svg[lander.flame % flames_svg.length], 0, 0, little_flame_width, little_flame_height);
      pop();
    }

    pop();
  }
}

// draw the mountainous landscape
function draw_landscape() {
  color(81,43,27)
  fill(81,43,27);
  beginShape();
  for (const v of landscape_polygon) {
    vertex(v.x, v.y);
  }
  endShape(CLOSE);

  fill(50, 50, 50)
  const pos = get_platform_position()
  rect(pos.x + pos.w / 2, pos.y, pos.w, pos.h, 2)
}

/////////////////////////////////////////////////////////////////////////////////////
// main logic and draw

// get the position of the platform on the map
function get_platform_position() {
  const px_1 = landscape_polygon[platform_index].x;
  const px_2 = landscape_polygon[platform_index + 1].x;
  const pw = (px_2 - px_1)
  const py = landscape_polygon[platform_index].y;
  return {x: px_1, y: py, w: pw, h: 10}
}

function lander_safe() {
  const la = (lander.r % 360)
  return (lander.dx > -0.4 && lander.dx < 0.4 && lander.dy < 1.0 && la > -5 && la < 5)
}

// is the lander ont he platform?
function lander_on_platform() {
  const platform = get_platform_position()
  const x1 = platform.x - (platform.w / 10)
  const x2 = platform.x + platform.w + (platform.w / 10)
  const y1 = platform.y
  const lander_bottom = lander.y + (lander_size * 0.5);
  return lander.x > x1 && lander.x < x2 &&
      lander_bottom >= y1 && lander_bottom < (y1 + (platform.h * 0.5));
}

// check if the lander has crashed
function lander_crash() {
  const lander_bubble = lander_size * 0.5

  // out of side of screen?
  if (lander.x < lander_bubble || (lander.x + lander_bubble) > w) {
    return true
  }

  for (let i = 1; i < (landscape_polygon.length - 2); i++) {
    const px = landscape_polygon[i - 1].x;
    const py = landscape_polygon[i - 1].y;
    const nx = landscape_polygon[i].x;
    const ny = landscape_polygon[i].y;

    // to close to the terrain?
    if (lander.x >= px && lander.x < nx) {
      const segment_width = (nx - px)
      const percent_left = (lander.x - px) / segment_width
      const landscape_height = py + (ny - py) * percent_left
      if (Math.abs(landscape_height - lander.y) < lander_bubble) {
        return true
      }
    }

  }
  return false;
}

// check if the lander has landed
function has_landed() {
  return (lander_safe() && lander_on_platform())
}

// Player Move, Rocket force against gavity & fuel consumption
function game_logic() {
  if (game_state !== "running" && keyIsDown(ENTER)) {
    reset_lander();
    reset_stars();
    reset_landscape();
    play_title_track();
    game_state = "running";
  }

  if (game_state === "running" && keyIsDown(ESCAPE)) {
    game_state = "game over";
  }

  if (game_state === "running") {

    if (has_landed()) {
      game_state = "landed";
      lander.r = 0;
      lander.dx = 0;
      lander.dy = 0;
      const platform = get_platform_position()
      lander.y = platform.y - (lander_size * 0.5 + platform.h * 0.5);
      lander.left_flame_on = false;
      lander.right_flame_on = false;
      lander.main_flame_on = false;
      return
    }
    if (lander_crash()) {
      game_state = "game over";
      explosion_counter = 0;
      return
    }

    lander.main_flame_on = false;
    lander.left_flame_on = false;
    lander.right_flame_on = false;

    if (lander.fuel > 0.0 && (keyIsDown(UP_ARROW) || keyIsDown(DOWN_ARROW))) {
      lander.main_flame_on = true;

      lander.dy -= ((gravity * 0.7) * Math.cos((lander.r / 180) * pi));
      if (lander.dy < -0.5)
        lander.dy = -0.5;
      if (lander.dy > max_gravity)
        lander.dy = max_gravity;

      lander.dx += (0.1 * Math.sin((lander.r / 180) * pi));
      if (lander.dx < -max_horizontal)
        lander.dx = -max_horizontal;
      if (lander.dx > max_horizontal)
        lander.dx = max_horizontal;
    }
    if (keyIsDown(LEFT_ARROW)) {
      lander.r -= 1.0
      lander.left_flame_on = true;
    }
    if (keyIsDown(RIGHT_ARROW)) {
      lander.r += 1.0
      lander.right_flame_on = true;
    }
    if (lander.main_flame_on || lander.right_flame_on || lander.left_flame_on) {
      lander.fuel -= lander.fuel_usage
      lander.flame += 1;
    }

    if (lander.dy < max_gravity && !lander.main_flame_on) {
      lander.dy += gravity;
    }
    lander.y += lander.dy;
    lander.x += lander.dx;
    lander.dx += (wind_strength * wind_height_adjust * 0.1);
    lander.r += (wind_strength * wind_height_adjust);

    // set wind direction and strength

    // is it time to think about changing direction?
    wind_counter += 1
    if ((wind_counter % 30) === 0) {
      // change wind direction?
      if (Math.random() < 0.5) {
        if (wind_direction === -1)
          wind_direction = 1
        else
          wind_direction = -1
      }
    }

    // add to the strength
    if ((wind_counter % 3) === 0) {
      const strength = Math.random() * 0.2
      wind_strength += wind_direction * strength
    }
    if (wind_strength < -max_wind_strength)
      wind_strength = -max_wind_strength
    if (wind_strength > max_wind_strength)
      wind_strength = max_wind_strength

    // adjust for height - the lower we are on the landscape, the less influence the wind
    // will have
    if (lander.y < max_wind_influence_height) {
      wind_height_adjust = (max_wind_influence_height - lander.y) / max_wind_influence_height
    } else {
      wind_height_adjust = 0.0
    }

  }

}

// p5 js callback - draw the world
function draw() {
  background(0);
  rectMode(CENTER);
  stroke(255)
  draw_stars();

  if (game_state === "running") {
    draw_lander();
    draw_control_panel();
    draw_landscape();

  } else {
    fill(444)
    textSize(20)
    text("Rock's lunar lander v1.0", (w / 2) - 180, (h / 2) - 100)
    fill(555)

    textSize(30)
    if (game_state === "landed") {
      text("CONGRATULATIONS", (w / 2) - 210, (h / 2) - 200)
      text("you made it", (w / 2) - 150, (h / 2) - 160)

      draw_lander();
      draw_control_panel();

    } else {

      draw_explosion()
      text("G A M E   O V E R", (w / 2) - 200, (h / 2) - 200)
    }

    textSize(20)
    text("press [enter] to start", (w / 2) - 160, h / 2 - 60)
    text("use cursor keys to move", (w / 2) - 180, (h / 2) - 30)
    draw_landscape();

    stop_title_track();
  }
  game_logic();
}
