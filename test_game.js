const fs = require('fs');
const content = fs.readFileSync('lunar-lander.js', 'utf8');
if (content.includes('function draw_control_panel() {')) {
  console.log("Success");
}
