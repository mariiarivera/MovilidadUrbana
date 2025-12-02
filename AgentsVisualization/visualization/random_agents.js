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

// Functions and arrays for the communication with the API
import {
  agents, obstacles, initAgentsModel,
  update, getAgents, getObstacles
} from '../libs/api_connection.js';

// Define the shader code, using GLSL 3.00
import vsGLSL from '../assets/shaders/vs_color.glsl?raw';
import fsGLSL from '../assets/shaders/fs_color.glsl?raw';

const scene = new Scene3D();

// Global variables
let colorProgramInfo = undefined;
let gl = undefined;
const duration = 10; // ms
let elapsed = 0;
let then = 0;

// Plantilla para copiar VAO/buffers a los agentes
let baseCube = undefined;

// Main function is async to be able to make the requests
async function main() {
  // Setup the canvas area
  const canvas = document.querySelector('canvas');
  gl = canvas.getContext('webgl2');
  twgl.resizeCanvasToDisplaySize(gl.canvas);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  // Prepare the program with the shaders
  colorProgramInfo = twgl.createProgramInfo(gl, [vsGLSL, fsGLSL]);

  // Initialize the agents model (Mesa)
  await initAgentsModel();

  // ⚠️ IMPORTANTE: avanzar al menos un step para que spawneen carros
  await update();

  // Get the agents and obstacles (por si quieres forzar uno más)
  await getAgents();
  await getObstacles();

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
  let camera = new Camera3D(
    0,
    30,             // Distance to target un poco más lejos
    4,              // Azimut
    0.8,            // Elevation
    [0, 0, 10],
    [14, 0, 14]     // Mirar más o menos al centro del grid 28x28
  );
  camera.panOffset = [0, 10, 0];
  scene.setCamera(camera);
  scene.camera.setupControls();
}

function setupObjects(scene, gl, programInfo) {
  // Create VAO for the base cube
  baseCube = new Object3D(-1);
  baseCube.prepareVAO(gl, programInfo);

  // Copiar propiedades a los agentes (carros)
  for (const agent of agents) {
    agent.arrays = baseCube.arrays;
    agent.bufferInfo = baseCube.bufferInfo;
    agent.vao = baseCube.vao;
    agent.scale = { x: 0.5, y: 0.5, z: 0.5 };
    // Color por default (blanco)
    agent.color = [0.1, 0.8, 0.2, 1.0];
    scene.addObject(agent);
  }

  // Copiar propiedades a los obstáculos
  for (const obstacle of obstacles) {
    obstacle.arrays = baseCube.arrays;
    obstacle.bufferInfo = baseCube.bufferInfo;
    obstacle.vao = baseCube.vao;
    obstacle.scale = { x: 0.5, y: 0.5, z: 0.5 };
    obstacle.color = [0.7, 0.7, 0.7, 1.0];
    scene.addObject(obstacle);
  }
}

// Sincronizar nuevos agentes que aparezcan después del primer frame
function syncNewAgentsInScene() {
  if (!baseCube) return;

  for (const agent of agents) {
    const exists = scene.objects.find(obj => obj.id === agent.id);
    if (!exists) {
      agent.arrays = baseCube.arrays;
      agent.bufferInfo = baseCube.bufferInfo;
      agent.vao = baseCube.vao;
      agent.scale = { x: 0.5, y: 0.5, z: 0.5 };
      agent.color = [0.1, 0.8, 0.2, 1.0];
      scene.addObject(agent);
      console.log("Agente agregado a la escena:", agent.id);
    }
  }
}

// Draw an object with its corresponding transformations
function drawObject(gl, programInfo, object, viewProjectionMatrix, fract) {
  // Asegurar oldPosArray para interpolación
  if (!object.oldPosArray) {
    object.oldPosArray = [...object.posArray];
  }

  // Interpolar posición entre oldPosArray y posArray
  let v3_tra = [
  object.oldPosArray[0] + (object.position.x - object.oldPosArray[0]) * fract,
  object.oldPosArray[1] + (object.position.y - object.oldPosArray[1]) * fract,
  object.oldPosArray[2] + (object.position.z - object.oldPosArray[2]) * fract,
  ];

  // Escala
  let v3_sca = object.scaArray || [1, 1, 1];

  // Create the individual transform matrices
  const scaMat = M4.scale(v3_sca);
  const rotXMat = M4.rotationX(object.rotRad.x);
  const rotYMat = M4.rotationY(object.rotRad.y);
  const rotZMat = M4.rotationZ(object.rotRad.z);
  const traMat = M4.translation(v3_tra);

  // Composite matrix
  let transforms = M4.identity();
  transforms = M4.multiply(scaMat, transforms);
  transforms = M4.multiply(rotXMat, transforms);
  transforms = M4.multiply(rotYMat, transforms);
  transforms = M4.multiply(rotZMat, transforms);
  transforms = M4.multiply(traMat, transforms);

  object.matrix = transforms;

  const wvpMat = M4.multiply(viewProjectionMatrix, transforms);

  // Model uniforms
  let objectUniforms = {
    u_transforms: wvpMat,
    // Si tu fs_color.glsl usa color, puedes pasar el color aquí:
    u_color: object.color || [1.0, 1.0, 1.0, 1.0],
  };
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

  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);

  scene.camera.checkKeys();
  const viewProjectionMatrix = setupViewProjection(gl);

  // Revisar si hay agentes nuevos desde el servidor
  syncNewAgentsInScene();

  // Draw the objects
  gl.useProgram(colorProgramInfo.program);
  for (let object of scene.objects) {
    drawObject(gl, colorProgramInfo, object, viewProjectionMatrix, fract);
  }

  // Update the scene after the elapsed duration
  if (elapsed >= duration) {
    elapsed = 0;
    await update();   // avanza un step en Mesa y actualiza posiciones
  }

  requestAnimationFrame(drawScene);
}

function setupViewProjection(gl) {
  const fov = 60 * Math.PI / 180;
  const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;

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
  // GUI desactivado por ahora
}

main();
