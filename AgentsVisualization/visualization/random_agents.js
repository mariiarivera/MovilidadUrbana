/*
 * Base program for a 3D scene that connects to an API to get the movement
 * of agents.
 * The scene shows colored cubes
 *
 * Gilberto Echeverria
 * 2025-11-08
 */


'use strict';

import * as twgl from 'twgl-base.js';
import GUI from 'lil-gui';
import { M4 } from '../libs/3d-lib';
import { Scene3D } from '../libs/scene3d';
import { Object3D } from '../libs/object3d';
import { Camera3D } from '../libs/camera3d';
import { loadMtl, loadObj } from '../libs/obj_loader.js';

// Functions and arrays for the communication with the API
import {
  agents, obstacles, trafficLights, road, destination, initAgentsModel,
  update, getAgents, getTrafficLights, getDestination, getRoad, getObstacles
} from '../libs/api_connection.js';


// Define the shader code, using GLSL 3.00
import vsGLSL from '../assets/shaders/vs_color.glsl?raw';
import fsGLSL from '../assets/shaders/fs_color.glsl?raw';

// Import OBJ and MTL 
import buildingOneObj from '../assets/models/Rv_Building_3.obj?raw';
import buildingOneMtl from '../assets/models/Rv_Building_3.mtl?raw';
import buildingTwoObj from '../assets/models/building_1.obj?raw';
import buildingTwoMtl from '../assets/models/building_1.mtl?raw';
import buildingThreeObj from '../assets/models/building_2.obj?raw';
import buildingThreeMtl from '../assets/models/building_2.mtl?raw';
import buildingFourObj from '../assets/models/LibertStatue.obj?raw';
import buildingFourMtl from '../assets/models/LibertStatue.mtl?raw';
import buildingFiveObj from '../assets/models/wooden.obj?raw';
import buildingFiveMtl from '../assets/models/wooden.mtl?raw';
import buildingSixObj from '../assets/models/teddy_normals_uv.obj?raw';
import buildingSixMtl from '../assets/models/teddy_normals_uv.mtl?raw';
import tree1Obj from '../assets/models/Lowpoly_tree_sample.obj?raw';
import tree1Mtl from '../assets/models/Lowpoly_tree_sample.mtl?raw';

import trafficLightsObj from '../assets/models/stoplight_1.obj?raw';
import trafficLightsMtl from '../assets/models/stoplight_1.mtl?raw';

import ObstacleOneObj from '../assets/models/streetlight.obj?raw';
import ObstacleOneMtl from '../assets/models/streetlight.mtl?raw';

import CarOneObj from '../assets/models/car.obj?raw';
import CarOneMtl from '../assets/models/car.mtl?raw';

const scene = new Scene3D();

/*
// Variable for the scene settings
const settings = {
    // Speed in degrees
    rotationSpeed: {
        x: 0,
        y: 0,
        z: 0,
    },
};
*/


// Global variables
let colorProgramInfo = undefined;
let gl = undefined;
const duration = 10; // ms
let elapsed = 0;
let then = 0;


// Main function is async to be able to make the requests
async function main() {
  // Setup the canvas area
  const canvas = document.querySelector('canvas');
  gl = canvas.getContext('webgl2');
  twgl.resizeCanvasToDisplaySize(gl.canvas);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  // Prepare the program with the shaders
  colorProgramInfo = twgl.createProgramInfo(gl, [vsGLSL, fsGLSL]);

  // Initialize the agents model
  await initAgentsModel();

  // Get the agents and obstacles
  await getAgents();
  await getObstacles();
  await getTrafficLights();
  await getRoad();
  await getDestination();


  // Initialize the scene
  setupScene();

  // Position the objects in the scene
  setupObjects(scene, gl, colorProgramInfo);

  // Prepare the user interface
  setupUI();

  // Fisrt call to the drawing loop
  drawScene();
}



function setupScene() {
  let camera = new Camera3D(0,
    10,             // Distance to target
    4,              // Azimut
    0.8,              // Elevation
    [0, 0, 10],
    [0, 0, 0]);
  // These values are empyrical.
  // Maybe find a better way to determine them
  camera.panOffset = [0, 8, 0];
  scene.setCamera(camera);
  scene.camera.setupControls();
}

function setupObjects(scene, gl, programInfo) {
  loadMtl(CarOneMtl);
  // Base cube
  const baseCube = new Object3D(-1);
  baseCube.prepareVAO(gl, programInfo);

  const carModel = new Object3D(-100);
  carModel.prepareVAO(gl, programInfo, CarOneObj);

  // Agents
  for (const agent of agents) {
    agent.arrays = carModel.arrays;
    agent.bufferInfo = carModel.bufferInfo;
    agent.vao = carModel.vao;
    agent.scale = { x: 0.5, y: 0.5, z: 0.5 };
    scene.addObject(agent);
  }

  loadMtl(ObstacleOneMtl);

  const obstacleModel = new Object3D(-15);
  obstacleModel.prepareVAO(gl, programInfo, ObstacleOneObj);
  // Obstacles
  for (const obstacle of obstacles) {
    obstacle.arrays = obstacleModel.arrays;
    obstacle.bufferInfo = obstacleModel.bufferInfo;
    obstacle.vao = obstacleModel.vao;
    obstacle.scale = { x: 0.5, y: 0.5, z: 0.5 };
    obstacle.color = [0.7, 0.7, 0.7, 1.0]; // gray
    obstacle.useVertexColor = true;
    scene.addObject(obstacle);
  }

loadMtl(trafficLightsMtl);
  // Prepare traffic light model
const trafficLightModel = new Object3D(-20);
trafficLightModel.prepareVAO(gl, programInfo, trafficLightsObj);

// Recommended scale for a stoplight OBJ
const trafficLightScale = { x: 0.5, y: 0.5, z: 0.5 };

  // Traffic Lights
// Traffic Lights using OBJ model
for (const light of trafficLights) {
    // Copy VAO + buffers from the loaded OBJ model
    light.arrays = trafficLightModel.arrays;
    light.bufferInfo = trafficLightModel.bufferInfo;
    light.vao = trafficLightModel.vao;
    light.useVertexColor = true;
    // Apply OBJ scale
    light.scale = { ...trafficLightScale };

    // trafficLights API provides "pos" already
    // but ensure it sits on the ground correctly
    light.pos = [
        0,
        light.scale.y / 2,   // lift it so it sits correctly
        0
    ];

    // Use red/green material color for now
    light.color = light.state === 'red' ? [1, 0, 0, 1] : [0, 1, 0, 1];

    scene.addObject(light);
}

  // Roads
for (const r of road) {
    r.arrays = baseCube.arrays;
    r.bufferInfo = baseCube.bufferInfo;
    r.vao = baseCube.vao;
    r.scale = { x: 1.0, y: 0.1, z: 1.0 }; // flat cube
    r.pos = [0, r.scale.y / 2, 0];
    r.color = [0.2, 0.2, 0.2, 1.0]; // gray
    r.useTexture = false;            // IMPORTANT
    scene.addObject(r);
}


  // Load all materials
loadMtl(buildingOneMtl);
loadMtl(buildingTwoMtl);
loadMtl(buildingThreeMtl);
loadMtl(buildingFourMtl);
loadMtl(buildingFiveMtl);
loadMtl(buildingSixMtl);
loadMtl(tree1Mtl);

// Prepare Object3D instances for each building model
const buildingObjects = [
    { obj: new Object3D(-2), rawObj: buildingOneObj, defaultScale: { x: 0.05, y: 0.1, z: 0.1 } },
    { obj: new Object3D(-3), rawObj: buildingTwoObj, defaultScale: { x: 0.5, y: 0.5, z: 0.5 } },
    { obj: new Object3D(-4), rawObj: buildingThreeObj, defaultScale: { x: 0.5, y: 0.5, z: 0.5 } },
    { obj: new Object3D(-5), rawObj: buildingFourObj, defaultScale: { x: 3, y: 5, z: 0.5 } },
    { obj: new Object3D(-6), rawObj: buildingFiveObj, defaultScale: { x: 0.5, y: 0.5, z: 0.1 } },
    { obj: new Object3D(-7), rawObj: buildingSixObj, defaultScale: { x: 0.5, y: 0.5, z: 0.5 } },
    { obj: new Object3D(-8), rawObj: tree1Obj, defaultScale: { x: 0.1, y: 0.1, z: 0.1 } },
];

// Prepare VAOs for each building
buildingObjects.forEach(b => b.obj.prepareVAO(gl, colorProgramInfo, b.rawObj));

// Assign a random building to each destination
for (const d of destination) {
    const randIndex = Math.floor(Math.random() * buildingObjects.length);
    const buildingBase = buildingObjects[randIndex].obj;

    d.arrays = buildingBase.arrays;
    d.bufferInfo = buildingBase.bufferInfo;
    d.vao = buildingBase.vao;
    d.useVertexColor = true;

    // Assign scale from the building object
    d.scale = { ...buildingObjects[randIndex].defaultScale };

    // Optional: store building index if needed
    d.buildingIndex = randIndex;

    // Optional: use material color
    d.color = [1, 1, 1, 1];

    scene.addObject(d);
}
}

// Draw an object with its corresponding transformations
function drawObject(gl, programInfo, object, viewProjectionMatrix, fract) {
  // Prepare the vector for translation and scale
  let v3_tra = object.posArray;
  let v3_sca = object.scaArray;

  /*
  // Animate the rotation of the objects
  object.rotDeg.x = (object.rotDeg.x + settings.rotationSpeed.x * fract) % 360;
  object.rotDeg.y = (object.rotDeg.y + settings.rotationSpeed.y * fract) % 360;
  object.rotDeg.z = (object.rotDeg.z + settings.rotationSpeed.z * fract) % 360;
  object.rotRad.x = object.rotDeg.x * Math.PI / 180;
  object.rotRad.y = object.rotDeg.y * Math.PI / 180;
  object.rotRad.z = object.rotDeg.z * Math.PI / 180;
  */

  // Create the individual transform matrices
  const scaMat = M4.scale(v3_sca);
  const rotXMat = M4.rotationX(object.rotRad.x);
  const rotYMat = M4.rotationY(object.rotRad.y);
  const rotZMat = M4.rotationZ(object.rotRad.z);
  const traMat = M4.translation(v3_tra);

  // Create the composite matrix with all transformations
  let transforms = M4.identity();
  transforms = M4.multiply(scaMat, transforms);
  transforms = M4.multiply(rotXMat, transforms);
  transforms = M4.multiply(rotYMat, transforms);
  transforms = M4.multiply(rotZMat, transforms);
  transforms = M4.multiply(traMat, transforms);

  object.matrix = transforms;

  // Apply the projection to the final matrix for the
  // World-View-Projection
  const wvpMat = M4.multiply(viewProjectionMatrix, transforms);

  // Model uniforms
  let objectUniforms = {
    u_transforms: wvpMat,
    u_color: object.color || [1, 1, 1, 1],
    u_useTexture: object.useTexture || false,
    u_texture: object.texture || null,
    u_useVertexColor: object.useVertexColor || false
  }
  twgl.setUniforms(programInfo, objectUniforms);

  gl.bindVertexArray(object.vao);
  twgl.drawBufferInfo(gl, object.bufferInfo);
}

// Function to do the actual display of the objects
async function drawScene() {
  // Compute time elapsed since last frame
  let now = Date.now();
  let deltaTime = now - then;
  elapsed += deltaTime;
  let fract = Math.min(1.0, elapsed / duration);
  then = now;

  // Clear the canvas
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // tell webgl to cull faces
  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);

  scene.camera.checkKeys();
  //console.log(scene.camera);
  const viewProjectionMatrix = setupViewProjection(gl);

  // Draw the objects
  gl.useProgram(colorProgramInfo.program);
  for (let object of scene.objects) {
    drawObject(gl, colorProgramInfo, object, viewProjectionMatrix, fract);
  }

  // Update the scene after the elapsed duration
  if (elapsed >= duration) {
    elapsed = 0;
    await update();
  }

  requestAnimationFrame(drawScene);
}

function setupViewProjection(gl) {
  // Field of view of 60 degrees vertically, in radians
  const fov = 60 * Math.PI / 180;
  const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;

  // Matrices for the world view
  const projectionMatrix = M4.perspective(fov, aspect, 1, 200);

  const cameraPosition = scene.camera.posArray;
  const target = scene.camera.targetArray;
  const up = [0, 1, 0];

  const cameraMatrix = M4.lookAt(cameraPosition, target, up);
  const viewMatrix = M4.inverse(cameraMatrix);
  const viewProjectionMatrix = M4.multiply(projectionMatrix, viewMatrix);

  return viewProjectionMatrix;
}

// Setup a ui.
function setupUI() {
  /*
  const gui = new GUI();

  // Settings for the animation
  const animFolder = gui.addFolder('Animation:');
  animFolder.add( settings.rotationSpeed, 'x', 0, 360)
      .decimals(2)
  animFolder.add( settings.rotationSpeed, 'y', 0, 360)
      .decimals(2)
  animFolder.add( settings.rotationSpeed, 'z', 0, 360)
      .decimals(2)
  */
}

main();