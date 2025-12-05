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
import { Light3D } from '../libs/light3d.js';
import { getRotationByDirection, getTrafficLightRotation} from './objects.js';
import { cubeTextured } from '../libs/shapes';

// Traffic Lights
import trafficLightsObj from '../assets/models/stoplight_1.obj?raw';
import trafficLightsMtl from '../assets/models/stoplight_1.mtl?raw';

// Destination
import destinationObj from '../assets/models/SlimCat.obj?raw';
import destinationMtl from '../assets/models/SlimCat.mtl?raw';

// Obstacles 
import buildingOneObj from '../assets/models/building_1.obj?raw';
import buildingOneMtl from '../assets/models/building_1.mtl?raw';
import buildingTwoObj from '../assets/models/building_1.obj?raw';
import buildingTwoMtl from '../assets/models/building_1.mtl?raw';
import buildingThreeObj from '../assets/models/building_2.obj?raw';
import buildingThreeMtl from '../assets/models/building_2.mtl?raw';

// Cars
import car1Obj from '../assets/models/car-2023-textures.obj?raw';
import car1Mtl from '../assets/models/car-2023-textures.mtl?raw';

// Roads
import roadObj from '../assets/models/cube_normals.obj?raw';

// Functions and arrays for the communication with the API
import {
  agents, obstacles, roads, destinations, trafficLights, initAgentsModel, 
  update, getAgents, getObstacles, getRoads, getDestinations, getTrafficLights
} from '../libs/api_connection.js';

// Define the shader code, using GLSL 3.00
import vsGLSL from '../assets/shaders/vs_multi_lights_attenuation.glsl?raw';
import fsGLSL from '../assets/shaders/fs_multi_lights_attenuation.glsl?raw';

// Shaders for skybox
import vsSkyboxGLSL from '../assets/shaders/vs_color.glsl?raw';
import fsSkyboxGLSL from '../assets/shaders/fs_color.glsl?raw';

const scene = new Scene3D();

// Global variables
let colorProgramInfo = undefined;
let skyboxProgramInfo = undefined;
let carTexture;
let greenTexture, redTexture;
let gl = undefined;

// Interpolación
const duration = 300; // ms por paso
let elapsed = 0;
let then = 0;

// Store car model data globally for new car spawning
let carArrays = undefined;
let carBufferInfo = undefined;
let carVAO = undefined;

// Store light cubes for traffic lights
const trafficLightCubes = [];

// Car color palette - vibrant, varied colors
const carColors = [
  [0.9, 0.1, 0.1, 1.0],  // Red
  [0.1, 0.3, 0.9, 1.0],  // Blue
  [0.1, 0.8, 0.2, 1.0],  // Green
  [0.95, 0.8, 0.1, 1.0], // Yellow
  [0.9, 0.4, 0.1, 1.0],  // Orange
  [0.6, 0.1, 0.8, 1.0],  // Purple
  [0.1, 0.8, 0.8, 1.0],  // Cyan
  [0.9, 0.1, 0.5, 1.0],  // Pink
  [0.2, 0.2, 0.2, 1.0],  // Dark Gray
  [0.9, 0.9, 0.9, 1.0],  // White
  [0.5, 0.3, 0.1, 1.0],  // Brown
  [0.3, 0.6, 0.3, 1.0],  // Forest Green
  [0.8, 0.0, 0.0, 1.0],  // Dark Red
  [0.0, 0.2, 0.6, 1.0],  // Navy Blue
  [0.7, 0.5, 0.0, 1.0],  // Gold
];

// Helpers
function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(x, min, max) {
  return Math.max(min, Math.min(max, x));
}

function getRandomCarColor() {
  return carColors[Math.floor(Math.random() * carColors.length)];
}

async function main() {
  const canvas = document.querySelector('canvas');
  gl = canvas.getContext('webgl2');
  twgl.resizeCanvasToDisplaySize(gl.canvas);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  // Shaders
  colorProgramInfo = twgl.createProgramInfo(gl, [vsGLSL, fsGLSL]);
  skyboxProgramInfo = twgl.createProgramInfo(gl, [vsSkyboxGLSL, fsSkyboxGLSL]);
  
  // Modelo de Mesa
  await initAgentsModel();
  await update();

  await getAgents();
  await getObstacles();
  await getRoads();
  await getDestinations();
  await getTrafficLights();

  console.log("=== Initial Load ===");
  console.log("Agents loaded:", agents.length);
  console.log("Obstacles loaded:", obstacles.length);
  console.log("Roads loaded:", roads.length);
  console.log("Destinations loaded:", destinations.length);
  console.log("Traffic lights loaded:", trafficLights.length);

  setupScene();
  await setupObjects(scene, gl, colorProgramInfo);
  setupUI();
  drawScene();
}

function setupScene() {
  let camera = new Camera3D(
    0,
    30,             // Distance to target
    4,              // Azimut
    0.8,            // Elevation
    [0, 0, 10],
    [14, 0, 14]     // Centro del grid 28x28
  );
  camera.panOffset = [0, 10, 0];
  scene.setCamera(camera);
  scene.camera.setupControls();

  // Brighter sun-like light for daytime look
  let light = new Light3D(
    [14, 40, 14],                // High position, sun-like
    [0.3, 0.3, 0.3, 1.0],        // Ambient - brighter
    [1.0, 0.98, 0.9, 1.0],       // Diffuse - warm sunlight
    [1.0, 1.0, 1.0, 1.0]         // Specular
  );
  scene.addLight(light);
}

async function setupObjects(scene, gl, programInfo) {

  function createTexture(src) {
    return twgl.createTexture(gl, {
      min: gl.LINEAR,
      mag: gl.LINEAR,
      src: src,
    });
  }

  greenTexture = createTexture('../assets/textures/Trafficlights/green.png');
  redTexture = createTexture('../assets/textures/Trafficlights/red.png');

  // Skybox
  const skyTexture = createTexture('../assets/models/skybox.png');

  const baseCubeTex = new Object3D(3);
  baseCubeTex.arrays = cubeTextured(2);
  baseCubeTex.bufferInfo = twgl.createBufferInfoFromArrays(gl, baseCubeTex.arrays);
  baseCubeTex.vao = twgl.createVAOFromBufferInfo(gl, skyboxProgramInfo, baseCubeTex.bufferInfo);

  baseCubeTex.position = { x: 14, y: 0, z: 14 };
  baseCubeTex.scale = { x: 80, y: 80, z: 80 }; // Positive scale, we'll handle inside with disable culling
  baseCubeTex.programType = 'skybox';
  baseCubeTex.texture = skyTexture;
  baseCubeTex.color = [1.0, 1.0, 1.0, 1.0]; // White color to not tint
  baseCubeTex.isSkybox = true;
  baseCubeTex.isCar = false;
  scene.addObject(baseCubeTex);

  const grayTexture = twgl.createTexture(gl, {
    src: [51,51,51,255],
    width: 1,
    height: 1
  });

  // Car model
  carTexture = createTexture('../assets/textures/Cars/car.jpg');
  const carMaterials = loadMtl(car1Mtl);
  carArrays = loadObj(car1Obj);
  const carObj3D = new Object3D(-10);
  carObj3D.arrays = carArrays;
  carObj3D.bufferInfo = twgl.createBufferInfoFromArrays(gl, carArrays);
  carObj3D.vao = twgl.createVAOFromBufferInfo(gl, colorProgramInfo, carObj3D.bufferInfo);
  
  carBufferInfo = carObj3D.bufferInfo;
  carVAO = carObj3D.vao;

  for (const agent of agents) {
    agent.arrays = carArrays;
    agent.bufferInfo = carBufferInfo;
    agent.vao = carVAO;
    agent.scale = { x: 0.5, y: 0.5, z: 0.5 }; 
    agent.texture = carTexture;
    agent.programType = 'texture';
    
    // Random color for each car
    agent.color = getRandomCarColor();
    agent.shininess = 32;

    // Interpolación de posición
    const p = [agent.position.x, agent.position.y, agent.position.z];
    agent.oldPos = [...p];
    agent.newPos = [...p];
    agent.interpolateStart = Date.now();

    // Rotación
    agent.rotRad = { x: 0, y: 0, z: 0 };
    agent.oldRotY = 0;
    agent.targetRotY = 0;

    // FLAG para no tocar edificios/calles/etc
    agent.isCar = true;

    scene.addObject(agent);
    console.log("Initial car added:", agent.id, "with color:", agent.color);
  }

  const buildingModels = [
    { obj: buildingOneObj,   mtl: buildingOneMtl,   tex: '../assets/textures/Building/building_albedo.png' },
    { obj: buildingTwoObj,   mtl: buildingTwoMtl,   tex: '../assets/textures/Building/building_albedo.png' },
    { obj: buildingThreeObj, mtl: buildingThreeMtl, tex: '../assets/textures/Building/building_albedo.png' },
  ];

  const loadedBuildings = [];

  for (let i = 0; i < buildingModels.length; i++) {
    const materials = loadMtl(buildingModels[i].mtl);
    const arrays = loadObj(buildingModels[i].obj);

    const vaoObj = new Object3D(-(100 + i));
    vaoObj.arrays = arrays;
    vaoObj.bufferInfo = twgl.createBufferInfoFromArrays(gl, vaoObj.arrays);
    vaoObj.vao = twgl.createVAOFromBufferInfo(gl, colorProgramInfo, vaoObj.bufferInfo);

    const texture = twgl.createTexture(gl, {
      min: gl.LINEAR,
      mag: gl.LINEAR,
      src: buildingModels[i].tex
    });

    loadedBuildings.push({
      arrays: arrays,
      bufferInfo: vaoObj.bufferInfo,
      vao: vaoObj.vao,
      texture: texture
    });
  }

  // Traditional building colors palette
  const buildingColors = [
    [0.85, 0.75, 0.65, 1.0], // Beige/Tan
    [0.75, 0.70, 0.65, 1.0], // Light Brown
    [0.65, 0.60, 0.55, 1.0], // Gray-Brown
    [0.80, 0.80, 0.75, 1.0], // Off-White
    [0.70, 0.65, 0.60, 1.0], // Warm Gray
    [0.60, 0.55, 0.50, 1.0], // Medium Gray
    [0.75, 0.65, 0.55, 1.0], // Terracotta
    [0.85, 0.80, 0.70, 1.0], // Cream
    [0.55, 0.50, 0.45, 1.0], // Dark Gray
    [0.70, 0.60, 0.50, 1.0], // Brown
  ];

  for (const obstacle of obstacles) {
    const rand = Math.floor(Math.random() * loadedBuildings.length);
    const chosen = loadedBuildings[rand];

    obstacle.arrays = chosen.arrays;
    obstacle.bufferInfo = chosen.bufferInfo;
    obstacle.vao = chosen.vao;

    // Keep the building texture
    obstacle.texture = chosen.texture;
    obstacle.programType = 'texture';
    obstacle.shininess = 32;

    const height = 0.5 + Math.random() * 0.5;
    obstacle.scale = { x: 0.5, y: height, z: 0.5 };

    // Assign random traditional building color - this will tint the texture
    obstacle.color = buildingColors[Math.floor(Math.random() * buildingColors.length)];

    obstacle.isCar = false;
    obstacle.oldPos = null;
    obstacle.newPos = null;

    scene.addObject(obstacle);
  }

  const roadArrays = loadObj(roadObj);
  const roadObj3D = new Object3D(-20);
  roadObj3D.arrays = roadArrays;
  roadObj3D.bufferInfo = twgl.createBufferInfoFromArrays(gl, roadObj3D.arrays);
  roadObj3D.vao = twgl.createVAOFromBufferInfo(gl, colorProgramInfo, roadObj3D.bufferInfo);

  for (const road of roads) {
    road.arrays = roadArrays;
    road.bufferInfo = roadObj3D.bufferInfo;
    road.vao = roadObj3D.vao;

    road.scale = { x: 1, y: 0.1, z: 1 };
    road.programType = "color";
    road.texture = grayTexture;
    road.color = [0.4, 0.4, 0.4, 1.0];
    road.shininess = 8;
    road.rotRad = getRotationByDirection(road.direction);

    road.isCar = false;
    road.oldPos = null;
    road.newPos = null;

    scene.addObject(road);
  }

  const catArrays = loadObj(destinationObj);
  const catMaterials = loadMtl(destinationMtl);

  const catObj3D = new Object3D(-5);
  catObj3D.arrays = catArrays;
  catObj3D.bufferInfo = twgl.createBufferInfoFromArrays(gl, catArrays);
  catObj3D.vao = twgl.createVAOFromBufferInfo(gl, colorProgramInfo, catObj3D.bufferInfo);

  const catTexture = createTexture('../assets/textures/Destination/fatCat.png');

  for (const destination of destinations) {
    destination.arrays = catArrays;
    destination.bufferInfo = catObj3D.bufferInfo;
    destination.vao = catObj3D.vao;
    destination.scale = { x: 0.05, y: 0.1, z: 0.05 };
    destination.texture = catTexture;
    destination.programType = 'texture';
    destination.shininess = 32;
    destination.color = [1, 1, 1, 1];

    destination.isCar = false;
    destination.oldPos = null;
    destination.newPos = null;

    scene.addObject(destination);
  }

  const tlMaterials = loadMtl(trafficLightsMtl);
  const tlArrays = loadObj(trafficLightsObj);

  const trafficBuffer = twgl.createBufferInfoFromArrays(gl, tlArrays);
  const trafficVAO = twgl.createVAOFromBufferInfo(gl, colorProgramInfo, trafficBuffer);

  for (const trafficL of trafficLights) {
    trafficL.arrays = tlArrays;
    trafficL.bufferInfo = trafficBuffer;
    trafficL.vao = trafficVAO;
    trafficL.scale = { x: 1, y: 1, z: 1 };

    trafficL.texture = null;
    trafficL.color = [1, 1, 1, 1];
    trafficL.programType = "color"; 
    trafficL.rotRad = getTrafficLightRotation(trafficL.direction);

    trafficL.isCar = false;
    trafficL.oldPos = null;
    trafficL.newPos = null;

    scene.addObject(trafficL);
  }

  // Luces físicas para cada semáforo
  for (const tl of trafficLights) {
    const pos = tl.position;
    const heightOffset = pos.y + 0.5;

    let offsetX = 0;
    let offsetZ = 0;

    switch (tl.direction) {
      case "Right":
      case "Left":
        offsetZ = 0.5;
        break;
      case "Up":
      case "Down":
        offsetX = -0.5;
        break;
    }

    const lightColor = tl.state
      ? [0.0, 0.8, 0.0, 1.0]
      : [0.8, 0.0, 0.0, 1.0];

    let light = new Light3D(
      [pos.x + offsetX, heightOffset, pos.z + offsetZ],
      [0.1, 0.1, 0.1, 1.0], 
      lightColor, 
      lightColor, 
    );

    tl.light = light;
    scene.addLight(light);
  }

  // Cubitos de textura para los semáforos
  for (const tl of trafficLights) {
    const lightCube = new Object3D(1000 + parseInt(tl.id));
    const pos = tl.position;
    const heightOffset = pos.y + 1;

    let offsetX = 0;
    let offsetZ = 0;

    switch (tl.direction) {
      case "Right":
      case "Left":
        offsetZ = 0.1;
        break;
      case "Up":
      case "Down":
        offsetX = -0.1;
        break;
    }

    lightCube.position = { x: pos.x + offsetX, y: heightOffset, z: pos.z + offsetZ };
    lightCube.scale = { x: 0.05, y: 0.5, z: 0.05 };
    lightCube.shininess = 16.0;
    lightCube.programType = 'texture';
    lightCube.color = [1.0, 1.0, 1.0, 1.0];

    lightCube.prepareVAO(gl, programInfo);

    if (tl.state) {
      lightCube.texture = greenTexture;
    } else {
      lightCube.texture = redTexture;
    }

    lightCube.trafficLightId = tl.id;
    lightCube.isCar = false;
    lightCube.oldPos = null;
    lightCube.newPos = null;

    trafficLightCubes.push(lightCube);
    scene.addObject(lightCube);
  }
}

// =======================================================
// SYNC DE AGENTES (SOLO CARROS)
// =======================================================
function syncNewAgentsInScene() {
  for (const agent of agents) {
    let exists = scene.objects.find(obj => obj.id === agent.id);

    if (exists) {
      if (!exists.isCar) continue; // No tocar edificios, etc.

      // Posición actual base
      const currentPos = exists.newPos || exists.oldPos || [
        exists.position.x,
        exists.position.y,
        exists.position.z
      ];

      exists.oldPos = currentPos;
      exists.newPos = [agent.position.x, agent.position.y, agent.position.z];
      exists.interpolateStart = Date.now();

      // Sincronizar position también (por si se usa en otros lados)
      exists.position.x = agent.position.x;
      exists.position.y = agent.position.y;
      exists.position.z = agent.position.z;

      // Rotación
      const dx = exists.newPos[0] - exists.oldPos[0];
      const dz = exists.newPos[2] - exists.oldPos[2];

      if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
        if (exists.targetRotY === undefined) exists.targetRotY = 0;
        exists.oldRotY = exists.targetRotY;
        exists.targetRotY = Math.atan2(dx, dz);
      }

      continue;
    }

    // Carro nuevo - assign random color
    agent.arrays = carArrays;
    agent.bufferInfo = carBufferInfo;
    agent.vao = carVAO;
    agent.scale = { x: 0.5, y: 0.5, z: 0.5 };
    agent.texture = carTexture;
    agent.programType = "texture";

    agent.rotRad = { x: 0, y: 0, z: 0 };
    agent.oldRotY = 0;
    agent.targetRotY = 0;

    const p = [agent.position.x, agent.position.y, agent.position.z];
    agent.oldPos = [...p];
    agent.newPos = [...p];
    agent.interpolateStart = Date.now();

    // Random color for new car
    agent.color = getRandomCarColor();
    agent.shininess = 32;
    agent.isCar = true;

    scene.addObject(agent);
    console.log("New car added to scene:", agent.id, "with color:", agent.color);
  }
  
  // Quitar carros que ya no existen en el modelo de Mesa
  const agentIds = new Set(agents.map(a => a.id));
  const carsToRemove = scene.objects.filter(obj => 
    obj.isCar && !agentIds.has(obj.id)
  );
  
  for (const car of carsToRemove) {
    const index = scene.objects.indexOf(car);
    if (index > -1) {
      scene.objects.splice(index, 1);
      console.log("Removed car from scene:", car.id);
    }
  }
}


function updateTrafficLightVisuals() {
  // Update traffic light visuals based on current state from API
  for (const lightCube of trafficLightCubes) {
    const tlData = trafficLights.find(t => t.id === lightCube.trafficLightId);
    if (tlData) {
      // Update cube texture
      if (tlData.state) {
        lightCube.texture = greenTexture;
      } else {
        lightCube.texture = redTexture;
      }

      // Find the traffic light object in scene to update its light
      const tlObject = scene.objects.find(obj => obj.id === tlData.id && !obj.isCar);
      if (tlObject && tlObject.light) {
        const lightColor = tlData.state
          ? [0.0, 0.8, 0.0, 1.0]
          : [0.8, 0.0, 0.0, 1.0];
        
        tlObject.light.diffuse = lightColor;
        tlObject.light.specular = lightColor;
      }
    }
  }
}

function drawObject(gl, programInfo, object, viewProjectionMatrix, fract) {

  // Parámetros de interpolación
  let t = 1.0;
  let smoothT = 1.0;

  let pos;

  // SOLO CARROS INTERPOLAN
  if (object.isCar && object.oldPos && object.newPos && object.interpolateStart) {
    t = clamp((Date.now() - object.interpolateStart) / duration, 0, 1);
    smoothT = t * t * (3 - 2 * t);   // smoothstep

    pos = [
      lerp(object.oldPos[0], object.newPos[0], smoothT),
      lerp(object.oldPos[1], object.newPos[1], smoothT),
      lerp(object.oldPos[2], object.newPos[2], smoothT)
    ];

    if (t >= 1) {
      object.oldPos = [...object.newPos];
    }
  } else if (object.position) {
    // Edificios, calles, destinos, semáforos, skybox…
    pos = [object.position.x, object.position.y, object.position.z];
  } else {
    pos = [0, 0, 0];
  }

  // Rotación
  if (!object.rotRad) {
    object.rotRad = { x: 0, y: 0, z: 0 };
  }

  let rotY = object.rotRad.y || 0;

  if (object.isCar && object.oldRotY !== undefined && object.targetRotY !== undefined) {
    let delta = ((object.targetRotY - object.oldRotY + Math.PI) % (2 * Math.PI)) - Math.PI;
    rotY = object.oldRotY + delta * smoothT;

    if (t >= 1) {
      object.oldRotY = object.targetRotY;
    }
  }

  object.rotRad.y = rotY;

  // MATRICES
  const sc = object.scale || { x: 1, y: 1, z: 1 };
  const scaMat = M4.scale([sc.x, sc.y, sc.z]);
  const rotXMat = M4.rotationX(object.rotRad.x || 0);
  const rotYMat = M4.rotationY(rotY);
  const rotZMat = M4.rotationZ(object.rotRad.z || 0);
  const traMat = M4.translation(pos);

  let modelMat = M4.identity();
  modelMat = M4.multiply(scaMat, modelMat);
  modelMat = M4.multiply(rotXMat, modelMat);
  modelMat = M4.multiply(rotYMat, modelMat);
  modelMat = M4.multiply(rotZMat, modelMat);
  modelMat = M4.multiply(traMat, modelMat);

  object.matrix = modelMat;

  const wvpMat = M4.multiply(viewProjectionMatrix, modelMat);
  const normalMat = M4.transpose(M4.inverse(modelMat));

  let uniforms = {
    u_world: modelMat,
    u_worldInverseTransform: normalMat,
    u_worldViewProjection: wvpMat,
    u_texture: object.texture,
    u_color: object.color || [1,1,1,1],
    u_shininess: object.shininess || 32
  };

  gl.bindVertexArray(object.vao);
  twgl.setUniforms(programInfo, uniforms);
  twgl.drawBufferInfo(gl, object.bufferInfo);
}

async function drawScene() {
  let now = Date.now();
  let deltaTime = now - then;
  elapsed += deltaTime;
  let fract = Math.min(1.0, elapsed / duration);
  then = now;

  // Sky blue background instead of black
  gl.clearColor(0.53, 0.81, 0.92, 1); // Light sky blue
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);

  scene.camera.checkKeys();
  const viewProjectionMatrix = setupViewProjection(gl);

  // Lights limitadas
  const sceneLights = scene.lights.slice(1);
  const cameraPos = scene.camera.posArray;
  const sortedLights = sceneLights
    .map(light => ({
      light,
      distance: Math.sqrt(
        Math.pow(light.posArray[0] - cameraPos[0], 2) +
        Math.pow(light.posArray[1] - cameraPos[1], 2) +
        Math.pow(light.posArray[2] - cameraPos[2], 2)
      )
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 8)
    .map(item => item.light);

  let lightPositions = [];
  let diffuseLights = [];
  let specularLights = [];

  const globalLight = scene.lights[0];
  lightPositions.push(...globalLight.posArray);

  for (const light of sortedLights) {
    lightPositions.push(...light.posArray);
    diffuseLights.push(...light.diffuse);
    specularLights.push(...light.specular);
  }

  let uniforms = {
    u_viewWorldPosition: scene.camera.posArray,
    u_lightWorldPosition: lightPositions,
    u_ambientLight: scene.lights[0].ambient,
    u_globalDiffuseLight: globalLight.diffuse,
    u_globalSpecularLight: globalLight.specular,
    u_diffuseLight: diffuseLights,
    u_specularLight: specularLights,
    u_constant: 1.0,
    u_linear: 0.09,
    u_quadratic: 0.032,
  };

  // Objetos normales primero
  gl.useProgram(colorProgramInfo.program);
  twgl.setUniforms(colorProgramInfo, uniforms);
  gl.enable(gl.CULL_FACE);
  gl.depthFunc(gl.LESS);

  for (let object of scene.objects) {
    if (object.isSkybox) continue;
    drawObject(gl, colorProgramInfo, object, viewProjectionMatrix, fract);
  }

  // Skybox al final (como fondo)
  const skyboxObjects = scene.objects.filter(obj => obj.isSkybox);
  if (skyboxObjects.length > 0) {
    gl.useProgram(skyboxProgramInfo.program);
    gl.disable(gl.CULL_FACE);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(false); // Don't write to depth buffer
    
    for (let skybox of skyboxObjects) {
      drawObject(gl, skyboxProgramInfo, skybox, viewProjectionMatrix, 1.0);
    }
    
    gl.depthMask(true); // Re-enable depth writing
  }

  // Actualización lógica
  if (elapsed >= duration) {
    elapsed = 0;
    await update();  
    syncNewAgentsInScene();
    updateTrafficLightVisuals();
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