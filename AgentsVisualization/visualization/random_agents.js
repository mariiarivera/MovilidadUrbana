/*
 * Base program for a 3D scene that connects to an API to get the movement
 * of agents.
 * The scene shows a city model
 * Amilka Lopez and Maria RIvera
 * 2025-11-08
 */


'use strict';

import * as twgl from 'twgl-base.js';
import GUI from 'lil-gui';
import { M4 } from '../libs/3d-lib';
import { Scene3D } from '../libs/scene3d';
import { Object3D } from '../libs/object3d';
import { Camera3D } from '../libs/camera3d';
import { Light3D } from '../libs/light3d.js';
import { cubeTextured } from '../libs/shapes';

// Functions and arrays for the communication with the API
import {
  agents, obstacles, trafficLights, road, destination, sidewalks, initAgentsModel,
  update, getAgents, getTrafficLights, getDestination, getRoad, getObstacles, getSideWalks
} from '../libs/api_connection.js';


// Define the shader code, using GLSL 3.00
import vsGLSL from '../assets/shaders/vs_multi_lights_attenuation.glsl?raw';
import fsGLSL from '../assets/shaders/fs_multi_lights_attenuation.glsl?raw';

// Import OBJ and MTL and Textures
import {
  buildingModels,
  destinationModel,
  carModels,
  trafficLightModel,
  roadModel,
  skyboxTexture,
  sidewalkTexture,
  BuildingTextureOne,
  BuildingTextureTwo,
  BuildingTextureThree,
  carOneTexture,
  greenTexture,
  redTexture,
  destinationTexture,
  initTextures,
  getRotation,
  getRotationByDirection,
  getTrafficLightRotation,
  getTrafficLightOffset,
  updateTrafficLights,
  createBaseModelWithMtl,
  assignModelToAgents,
  plant
} from './objects.js';

console.log('carModels:', carModels);

const scene = new Scene3D();

// Global variables
let ProgramInfo = undefined;
let gl = undefined;
const duration = 10; // ms
let elapsed = 0;
let then = 0;
const numLights = 3


// Main function is async to be able to make the requests
async function main() {
  // Setup the canvas area
  const canvas = document.querySelector('canvas');
  gl = canvas.getContext('webgl2');
  twgl.resizeCanvasToDisplaySize(gl.canvas);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  initTextures(gl);

  // Prepare the program with the shaders
  ProgramInfo = twgl.createProgramInfo(gl, [vsGLSL, fsGLSL]);

  // Initialize the agents model
  await initAgentsModel();
  // Get the agents and obstacles
  await getAgents();
  await getObstacles();
  await getTrafficLights();
  await getRoad();
  await getDestination();
  await getSideWalks();

  // Initialize the scene
  setupScene();

  // Position the objects in the scene
  setupObjects(scene, gl, ProgramInfo);

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
  camera.panOffset = [0, 8, 0];
  scene.setCamera(camera);
  scene.camera.setupControls();

    // Create global light
  let light = new Light3D(
    [50, 4, 50],          // Position
    [0.4, 0.4, 1.0, 1.0], // Ambient
    [0.2, 0.2, 0.2, 1.0], // Diffuse
    [0.5, 0.5, 0.5, 1.0], // Specular
  );
  scene.addLight(light);
}

function setupObjects(scene, gl, ProgramInfo) {
   // Used for skybox and sidewalks
  const baseCube = new Object3D(1);
  baseCube.arrays = cubeTextured(2);
  baseCube.bufferInfo = twgl.createBufferInfoFromArrays(gl, baseCube.arrays);
  baseCube.vao = twgl.createVAOFromBufferInfo(gl, ProgramInfo, baseCube.bufferInfo);

    // Road with texture
  const baseRoad = new Object3D(2);
  baseRoad.prepareVAO(gl, ProgramInfo);

    // Skybox
  let skybox = new Object3D(3);
  skybox.arrays = baseCube.arrays;
  skybox.bufferInfo = baseCube.bufferInfo;
  skybox.vao = baseCube.vao;
  skybox.scale = { x: -50, y: -100, z: -100 };
  skybox.programType = 'texture';
  skybox.texture = skyboxTexture;
  scene.addObject(skybox);

  const carOne = createBaseModelWithMtl(4, gl, ProgramInfo, carModels["0"].obj, carModels["0"].mtl);
  const carModelsArray = [carOne];
  const carTexturesArray = [carOneTexture];

    for (const agent of agents) {
    // Get random model
    const randomIndex = Math.floor(Math.random() * carModelsArray.length); 
    const car = carModelsArray[randomIndex];

    assignModelToAgents([agent], car, {
      scale: { x: 0.1, y: 0.1, z: 0.1 },
      color: [1.0, 1.0, 1.0, 1.0],
      shininess: 4.0,
      texture: carTexturesArray[randomIndex],
      programType: 'texture',
    });

    scene.addObject(agent);
  }

  // obstacles
  const ObstacleOne = createBaseModelWithMtl(5, gl, ProgramInfo, buildingModels["0"].obj, buildingModels["0"].mtl);
  const ObstacleTwo = createBaseModelWithMtl(6, gl, ProgramInfo, buildingModels["1"].obj, buildingModels["1"].mtl);
  const ObstacleThree = createBaseModelWithMtl(7, gl, ProgramInfo, buildingModels["2"].obj, buildingModels["2"].mtl);
  const ObstacleFour = createBaseModelWithMtl(8, gl, ProgramInfo, buildingModels["3"].obj, buildingModels["3"].mtl);
  const ObstacleFive = createBaseModelWithMtl(9, gl, ProgramInfo, buildingModels["4"].obj, buildingModels["4"].mtl);
  const ObstacleSix = createBaseModelWithMtl(10, gl, ProgramInfo, buildingModels["5"].obj, buildingModels["5"].mtl);

  const obstaclesArray = [ObstacleOne, ObstacleTwo, ObstacleThree, ObstacleFour, ObstacleFive, ObstacleSix];
  const buildingProperties = [
    { scale: { x: 0.5, y: 0.5, z: 0.5 }, shininess: 16.0, texture: BuildingTextureOne },
    { scale: { x: 0.5, y: 0.5, z: 0.5 }, shininess: 16.0, texture: BuildingTextureTwo },
    { scale: { x: 0.35, y: 0.5, z: 0.35 }, shininess: 32.0, texture: BuildingTextureThree },
    { scale: { x: 0.35, y: 0.5, z: 0.35 }, shininess: 32.0, texture: BuildingTextureTwo },
    { scale: { x: 0.09, y: 0.3, z: 0.05 }, shininess: 32.0, texture: BuildingTextureOne },
    { scale: { x: 0.005, y: 0.005, z: 0.005 }, shininess: 16.0, texture: BuildingTextureThree },
  ]
    for (const agent of obstacles) {
    const randomIndex = Math.floor(Math.random() * obstaclesArray.length); 
    const baseObstacle = obstaclesArray[randomIndex];
    const config = buildingProperties[randomIndex];

    assignModelToAgents([agent], baseObstacle, {
      ...config,
      color: [1.0, 1.0, 1.0, 1.0],
      programType: 'texture',
    });

    scene.addObject(agent);
  }

  // traffic lights

  const TrafficLight = createBaseModelWithMtl(12, gl, ProgramInfo, trafficLightModel.obj, trafficLightModel.mtl);

  for (const agent of trafficLights) {
    assignModelToAgents([agent], TrafficLight, {
      scale: { x: 0.5, y: 0.5, z: 0.5 },
      programType: 'texture',
      texture: null,
      rotRad: getTrafficLightRotation(agent.direction),
    });

    scene.addObject(agent);
  }

  // Create lights for each traffic light
  for (const tl of trafficLights) {
    const pos = tl.position;
    const heightOffset = pos.y + 0.8;

    // Get offset based on direction to align with semaphore
    let offsetX = 0;
    let offsetZ = 0;

    switch (tl.direction) {
      case "Right":
        offsetZ = 0.5;
        break;
      case "Left":
        offsetZ = 0.5;
        break;
      case "Up":
        offsetX = -0.5;
        break;
      case "Down":
        offsetX = -0.5;
        break;
    }

    // Select color based on state
    const lightColor = tl.state
      ? [0.0, 0.8, 0.0, 1.0] // Green
      : [0.8, 0.0, 0.0, 1.0]; // Red

    // Create the light
    let light = new Light3D(
      [pos.x + offsetX, heightOffset, pos.z + offsetZ],
      [0.1, 0.1, 0.1, 1.0], // Ambient
      lightColor, // Diffuse
      lightColor, // Specular
    );

    // Store reference to light in traffic light object
    tl.light = light;
    scene.addLight(light);
  }

  // Create light emitter cubes for each traffic light
  for (const tl of trafficLights) {
    const lightCube = new Object3D(13);
    const pos = tl.position;
    const heightOffset = pos.y + 0.8;

    // Get offset based on direction to align with semaphore
    let offsetX = 0;
    let offsetZ = 0;

    switch (tl.direction) {
      case "Right":
        offsetZ = 0.1;
        break;
      case "Left":
        offsetZ = 0.1;
        break;
      case "Up":
        offsetX = -0.1;
        break;
      case "Down":
        offsetX = -0.1;
        break;
    }

    lightCube.position = { x: pos.x + offsetX, y: heightOffset, z: pos.z + offsetZ };
    lightCube.scale = { x: 0.0005, y: 0.1, z: 0.0005 };

    // Set texture and color based on state
    lightCube.shininess = 16.0;
    lightCube.programType = 'texture';
    lightCube.color = [1.0, 1.0, 1.0, 1.0]; // White so texture shows properly

    if (tl.state) {
      lightCube.texture = greenTexture; // Green texture
    } else {
      lightCube.texture = redTexture; // Red texture
    }

    lightCube.arrays = baseCube.arrays;
    lightCube.bufferInfo = baseCube.bufferInfo;
    lightCube.vao = baseCube.vao;

    // Store reference to cube in traffic light
    tl.lightCube = lightCube;
    scene.addObject(lightCube);
  }

  // Roads
  const Road = createBaseModelWithMtl(14, gl, ProgramInfo, roadModel.obj, roadModel.mtl);

  for (const agent of road) {
    assignModelToAgents([agent], Road, {
      scale: { x: 0.5, y: 1, z: 0.5 },
      programType: 'texture',
      texture: sidewalkTexture,
      rotRad: getRotationByDirection(agent.direction),
    });

    scene.addObject(agent);
  }

  // Sidewalks
  for (const agent of sidewalks) {
    assignModelToAgents([agent], baseCube, {
      scale: { x: 0.25, y: 0.1, z: 0.25 },
      programType: 'texture',
      texture: sidewalkTexture,
    });

    scene.addObject(agent);
  }

  const baseDestination = createBaseModelWithMtl(16, gl, ProgramInfo, destinationModel.obj, destinationModel.mtl);

  for (const agent of destination) {
    assignModelToAgents([agent], baseDestination, {
      scale: { x: 0.5, y: 0.8, z: 0.5 },
      programType: 'texture',
      texture: plant,
    });

    scene.addObject(agent);
  }

}

function updateObject() {
  // Update the objects in the scene after a step
  

  
}

// Draw an object with its corresponding transformations
function drawObject(gl, programInfo, object, viewProjectionMatrix, fract) {
  const v3_tra = object.posArray;
  const v3_sca = object.scaArray;

  const scaMat = M4.scale(v3_sca);
  const rotXMat = M4.rotationX(object.rotRad.x);
  const rotYMat = M4.rotationY(object.rotRad.y);
  const rotZMat = M4.rotationZ(object.rotRad.z);
  const traMat = M4.translation(v3_tra);

  let transforms = M4.identity();
  transforms = M4.multiply(scaMat, transforms);
  transforms = M4.multiply(rotXMat, transforms);
  transforms = M4.multiply(rotYMat, transforms);
  transforms = M4.multiply(rotZMat, transforms);
  transforms = M4.multiply(traMat, transforms);

  object.matrix = transforms;

  const wvpMat = M4.multiply(viewProjectionMatrix, transforms);
  const normalMat = M4.transpose(M4.inverse(transforms));

  // Prepare light uniforms
  const lights = scene.lights;
const lightPositions = [];
const diffuseLights = [];
const specularLights = [];

for (const l of lights) {
  lightPositions.push(...l.posArray);  // flatten vec3
  diffuseLights.push(...l.diffuse);    // flatten vec4
  specularLights.push(...l.specular);  // flatten vec4
}


const uniforms = {
  u_world: transforms,
  u_worldInverseTransform: normalMat,
  u_worldViewProjection: wvpMat,
  u_texture: object.texture || null,
  u_shininess: object.shininess || 16.0,
  u_viewWorldPosition: scene.camera.posArray,
  u_lightWorldPosition: lightPositions,
  u_ambientLight: [0.4, 0.4, 0.4, 1.0],
  u_diffuseLight: diffuseLights,
  u_specularLight: specularLights,
  u_constant: 1.0,
  u_linear: 0.09,
  u_quadratic: 0.032
};

  twgl.setUniforms(programInfo, uniforms);
  gl.bindVertexArray(object.vao);
  twgl.drawBufferInfo(gl, object.bufferInfo);
}

// Function to do the actual display of the objects
async function drawScene() {
  const now = Date.now();
  const deltaTime = now - then;
  elapsed += deltaTime;
  const fract = Math.min(1.0, elapsed / duration);
  then = now;

  updateTrafficLights(trafficLights, greenTexture, redTexture);

  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);

  scene.camera.checkKeys();
  const viewProjectionMatrix = setupViewProjection(gl);

  
  // Only consider scene lights without global light
  const sceneLights = scene.lights.slice(1);

  // Prepare light arrays for the shader
  let lightPositions = [];
  let diffuseLights = [];
  let specularLights = [];

  // Get global light
  const globalLight = scene.lights[0];
  lightPositions.push(...globalLight.posArray);

  // Add the rest of the lights to the arrays
  for (const light of sceneLights) {
    lightPositions.push(...light.posArray);
    diffuseLights.push(...light.diffuse);
    specularLights.push(...light.specular);
  }

  let textureUniforms = {
    u_viewWorldPosition: scene.camera.posArray,
    u_lightWorldPosition: lightPositions,
 
    u_ambientLight: scene.lights[0].ambient,
    u_globalDiffuseLight: globalLight.diffuse,
    u_globalSpecularLight: globalLight.specular,
    u_diffuseLight: diffuseLights,
    u_specularLight: specularLights,
    
    // Attenuation parameters
    u_constant: 1.0,
    u_linear: 0.15,
    u_quadratic: 0.15,
  };

  gl.useProgram(ProgramInfo.program);
    twgl.setUniforms(ProgramInfo, textureUniforms);

  for (let object of scene.objects) {
    drawObject(gl, ProgramInfo, object, viewProjectionMatrix, fract);
  }

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