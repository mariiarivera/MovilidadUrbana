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
import { getRotationByDirection, getTrafficLightRotation, updateTrafficLights } from './objects.js';

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
import car1Obj from '../assets/models/car-2024-301.obj?raw';
import car1Mtl from '../assets/models/car-2024-301.mtl?raw';

// Roads
import roadObj from '../assets/models/untitled.obj?raw';
import roadMtl from '../assets/models/untitled.mtl?raw';

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
  skyboxProgramInfo = twgl.createProgramInfo(gl, [vsSkyboxGLSL, fsSkyboxGLSL]);

  // Initialize the agents model (Mesa)
  await initAgentsModel();

  // ⚠ IMPORTANTE: avanzar al menos un step para que spawneen carros
  await update();

  // Get the agents and obstacles (por si quieres forzar uno más)
  await getAgents();
  await getObstacles();
  await getRoads();
  await getDestinations();
  await getTrafficLights();

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

let light = new Light3D(
  [14, 40, 14],                // Posición alta, efecto de luna
  [0.9, 0.9, 0.9, 1.0],        // Ambient azulada (SimCity vibe)
  [0.9, 0.9, 1.0, 1.0],        // Difusa muy clara
  [1.0, 1.0, 1.0, 1.0]         // Especular brillante
);
scene.addLight(light);
}

function setupObjects(scene, gl, programInfo) {
    function createTexture(gl, src) {
      return twgl.createTexture(gl, {
        min: gl.LINEAR,
        mag: gl.LINEAR,
        src: src,
      });
    }

  // Create VAO for the base cube
  baseCube = new Object3D(-1);
  baseCube.prepareVAO(gl, programInfo);

  const skyboxTexture = createTexture(gl, '../assets/models/skyboxpic.jpg');
  let skybox = new Object3D(3);
  skybox.arrays = baseCube.arrays;
  skybox.bufferInfo = twgl.createBufferInfoFromArrays(gl, skybox.arrays);
  skybox.vao = twgl.createVAOFromBufferInfo(gl, skyboxProgramInfo, skybox.bufferInfo);
  skybox.scale = { x: -50, y: -50, z: -50 };
  skybox.programType = 'skybox';
  skybox.texture = skyboxTexture;
  scene.addObject(skybox);

  const carTexture = createTexture(gl, '../assets/textures/Wheels/wheel.jpg');
  const carMaterials = loadMtl(car1Mtl);
  const carArrays = loadObj(car1Obj);
  const carObj3D = new Object3D(-10);
  carObj3D.arrays = carArrays;
  carObj3D.bufferInfo = twgl.createBufferInfoFromArrays(gl, carArrays);
  carObj3D.vao = twgl.createVAOFromBufferInfo(gl, colorProgramInfo, carObj3D.bufferInfo);
  // Copiar propiedades a los agentes (carros)
  for (const agent of agents) {
    agent.arrays = carArrays;
    agent.bufferInfo = carObj3D.bufferInfo;
    agent.vao = carObj3D.vao;
    agent.scale = { x: 0.5, y: 0.5, z: 0.5 }; 
    agent.texture = carTexture;
    agent.programType = 'texture';
    agent.color = [1, 1, 1, 1];
    scene.addObject(agent);
  }


// Obstacles
const buildingModels = [
  { obj: buildingOneObj,   mtl: buildingOneMtl,   tex: '../assets/textures/Building/building_albedo.png' },
  { obj: buildingTwoObj,   mtl: buildingTwoMtl,   tex: '../assets/textures/Building/building_albedo.png' },
  { obj: buildingThreeObj, mtl: buildingThreeMtl, tex: '../assets/textures/Building/building_albedo.png' },
];

const loadedBuildings = [];

for (let i = 0; i < buildingModels.length; i++) {
  
  const materials = loadMtl(buildingModels[i].mtl); // load MTL data
  const arrays = loadObj(buildingModels[i].obj);   // load vertex data from OBJ


  const vaoObj = new Object3D(-(100 + i));        // unique ID
  // Assign OBJ arrays directly (do NOT call prepareVAO with no argument!)
  vaoObj.arrays = arrays;
  vaoObj.bufferInfo = twgl.createBufferInfoFromArrays(gl, vaoObj.arrays);
  vaoObj.vao = twgl.createVAOFromBufferInfo(gl, colorProgramInfo, vaoObj.bufferInfo);

  // Create texture
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


// Assign models to obstacles
for (const obstacle of obstacles) {
  const rand = Math.floor(Math.random() * loadedBuildings.length);
  const chosen = loadedBuildings[rand];
  obstacle.arrays = chosen.arrays;
  obstacle.bufferInfo = chosen.bufferInfo;
  obstacle.vao = chosen.vao;
  obstacle.scale = { x: 0.5, y: 1, z: 0.5 };
  obstacle.texture = chosen.texture;
  obstacle.color = [1, 1, 1, 1];
  obstacle.programType = 'texture';
  obstacle.shininess = 32;

  scene.addObject(obstacle);
}

// Load road geometry and materials
const roadArrays = loadObj(roadObj);
const roadMaterials = loadMtl(roadMtl);
const roadObj3D = new Object3D(-20);
roadObj3D.arrays = roadArrays;
roadObj3D.bufferInfo = twgl.createBufferInfoFromArrays(gl, roadArrays);
roadObj3D.vao = twgl.createVAOFromBufferInfo(gl, colorProgramInfo, roadObj3D.bufferInfo);

const roadTexture = createTexture(gl, '../assets/textures/Road/render.png'); // your road texture

// Assign models to roads
// for (const road of roads) {
//   road.arrays = roadArrays;
//   road.bufferInfo = roadObj3D.bufferInfo;
//   road.vao = roadObj3D.vao;
//   road.scale = { x: 1, y: 2, z: 1 }; // adjust as needed
//   road.texture = roadTexture;
//   road.color = [1, 1, 1, 1];
//   road.programType = 'texture';
//   road.rotRad = getRotationByDirection(road.direction);
//   scene.addObject(road);
// }

const catArrays = loadObj(destinationObj);
const catMaterials = loadMtl(destinationMtl);

const catObj3D = new Object3D(-5);
catObj3D.arrays = catArrays;
catObj3D.bufferInfo = twgl.createBufferInfoFromArrays(gl, catArrays);
catObj3D.vao = twgl.createVAOFromBufferInfo(gl, colorProgramInfo, catObj3D.bufferInfo);

const catTexture = createTexture(gl, '../assets/textures/Destination/fatCat.png');

for (const destination of destinations) {
  destination.arrays = catArrays;
  destination.bufferInfo = catObj3D.bufferInfo;
  destination.vao = catObj3D.vao;
  destination.scale = { x: 0.05, y: 0.3, z: 0.05 };
  destination.texture = catTexture;
  destination.programType = 'texture';
  destination.shininess = 32;
  destination.color = [1, 1, 1, 1];
  scene.addObject(destination);
}


//set up obj and mtl for traffic lights
const greenTexture = createTexture(gl, '../assets/textures/Trafficlights/green.png');
const redTexture = createTexture(gl, '../assets/textures/Trafficlights/red.png');
const tlMaterials = loadMtl(trafficLightsMtl);
const tlArrays = loadObj(trafficLightsObj);

const trafficBuffer = twgl.createBufferInfoFromArrays(gl, tlArrays);
const trafficVAO = twgl.createVAOFromBufferInfo(gl, colorProgramInfo, trafficBuffer);

  for (const tl of trafficLights) {
    tl.arrays = tlArrays;
    tl.bufferInfo = trafficBuffer;
    tl.vao = trafficVAO;
    tl.scale = { x: 1, y: 1, z: 1 };

    tl.texture = null; // usa solo color
    tl.color = [1, 1, 1, 1];
    tl.programType = "color"; 
    scene.addObject(tl);
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

    const lightColor = tl.state
      ? [0.0, 0.8, 0.0, 1.0] // Green
      : [0.8, 0.0, 0.0, 1.0]; // Red

    // Create the light
    let light = new Light3D(
      [pos.x + offsetX, heightOffset, pos.z + offsetZ],
      [0.1, 0.1, 0.1, 1.0], 
      lightColor, 
      lightColor, 
    );

    tl.light = light;
    scene.addLight(light);
  }

  for (const tl of trafficLights) {
    const lightCube = new Object3D(13);
    const pos = tl.position;
    const heightOffset = pos.y + 0.8;

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
    lightCube.scale = { x: 0.05, y: 0.5, z: 0.05 };
    lightCube.shininess = 16.0;
    lightCube.programType = 'texture';
    lightCube.color = [1.0, 1.0, 1.0, 1.0]; // White so texture shows properly

    if (tl.state) {
      lightCube.texture = greenTexture; // Green texture
    } else {
      lightCube.texture = redTexture; // Red texture
    }
  }

}

// Sincronizar nuevos agentes que aparezcan después del primer frame
function syncNewAgentsInScene() {
  /*
  for (const agent of agents) {
    const exists = scene.objects.find(obj => obj.id === agent.id);
    if (!exists) {
      agent.arrays = carArrays;
      agent.bufferInfo = car1Obj.bufferInfo;
      agent.vao = car1Obj.vao;
      agent.scale = { x: 0.5, y: 1.5, z: 0.5 };
      agent.texture = carTexture;
      agent.programType = 'texture';
      agent.color = [1, 1, 1, 1];
      scene.addObject(agent);
      console.log("New car added:", agent.id);
    }
  }
  */
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

  // interpolation for rotation

const newRot = object.targetRotY;
const oldRot = object.oldRotY;

// Default to current rotation
let rotY = object.rotRad.y;

if (newRot !== undefined && oldRot !== undefined) {
  // Compute shortest angular difference
  let deltaRot = ((newRot - oldRot + Math.PI) % (2 * Math.PI)) - Math.PI;

  // Interpolate rotation
  rotY = oldRot + deltaRot * fract;
}

  // Create the individual transform matrices
  const scaMat = M4.scale(v3_sca);
  const rotXMat = M4.rotationX(object.rotRad.x);
  const rotYMat = M4.rotationY(rotY);
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
  const normalMat = M4.transpose(M4.inverse(transforms));

  // Model uniforms
  let objectUniforms = {
    u_world: transforms,
    u_worldInverseTransform: normalMat,
    u_worldViewProjection: wvpMat,
    
    u_texture: object.texture,
    u_color: object.color || [1,1,1,1],
    u_shininess: object.shininess,
  };
  twgl.setUniforms(programInfo, objectUniforms);

  gl.bindVertexArray(object.vao);
  twgl.drawBufferInfo(gl, object.bufferInfo);
}

// Function to do the actual display of the objects
async function drawScene() {
      function createTexture(gl, src) {
      return twgl.createTexture(gl, {
        min: gl.LINEAR,
        mag: gl.LINEAR,
        src: src,
      });
    }
  const greenTexture = createTexture(gl, '../assets/textures/Trafficlights/green.png');
  const redTexture = createTexture(gl, '../assets/textures/Trafficlights/red.png');
  // Compute time elapsed since last frame
  let now = Date.now();
  let deltaTime = now - then;
  elapsed += deltaTime;
  let fract = Math.min(1.0, elapsed / duration);
  then = now;

  updateTrafficLights(trafficLights, greenTexture, redTexture);
  // Clear the canvas
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);

  scene.camera.checkKeys();
  const viewProjectionMatrix = setupViewProjection(gl);

   // Draw the skybox **first**
  gl.depthFunc(gl.LEQUAL);  // allow skybox behind everything
  gl.disable(gl.CULL_FACE); 

  gl.useProgram(skyboxProgramInfo.program);

  for (const object of scene.objects.filter(obj => obj.programType === 'skybox')) {
      const viewMatNoTranslation = [...viewProjectionMatrix];
      // Remove camera translation so skybox stays centered
      viewMatNoTranslation[12] = 0;
      viewMatNoTranslation[13] = 0;
      viewMatNoTranslation[14] = 0;

      const wvpMat = M4.multiply(viewMatNoTranslation, 
                                 M4.scale([object.scale.x, object.scale.y, object.scale.z]));
      
      twgl.setUniforms(skyboxProgramInfo, {
          u_worldViewProjection: wvpMat,
          u_texture: object.texture
      });

      gl.bindVertexArray(object.vao);
      twgl.drawBufferInfo(gl, object.bufferInfo);
  }

  gl.enable(gl.CULL_FACE);
  gl.depthFunc(gl.LESS);

  // Revisar si hay agentes nuevos desde el servidor
  syncNewAgentsInScene();

  // Draw the objects
  gl.useProgram(colorProgramInfo.program);

  const sceneLights = scene.lights.slice(1);

  function pad(arr, targetSize) {
  while (arr.length < targetSize * 4) {
    arr.push(0,0,0,0);
  }
  return arr;
}

  // Prepare light arrays for the shader
  let lightPositions = [];
  let diffuseLights = [];
  let specularLights = [];

  const globalLight = scene.lights[0];
  lightPositions.push(...globalLight.posArray);

  for (const light of sceneLights) {
    lightPositions.push(...light.posArray);
    diffuseLights.push(...light.diffuse);
    specularLights.push(...light.specular);
  }

diffuseLights = pad(diffuseLights, 27);
specularLights = pad(specularLights, 27);

while (lightPositions.length < 27 * 3) {
    lightPositions.push(0,0,0);
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
    u_linear: 0.4,
    u_quadratic: 0.01,
  };

  // Draw objects
  gl.useProgram(colorProgramInfo.program);
  twgl.setUniforms(colorProgramInfo, uniforms);

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
  console.log("Lights:", scene.lights.length);

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