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
// import roadMtl from '../assets/models/cube_normals.mtl?raw';

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
const duration = 100; // ms - increased for smoother animation
let elapsed = 0;
let then = 0;

// Plantilla para copiar VAO/buffers a los agentes
let baseCube = undefined;

// Store car model data globally for new car spawning
let carArrays = undefined;
let carBufferInfo = undefined;
let carVAO = undefined;

// Store light cubes for traffic lights
const trafficLightCubes = [];

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

  console.log("=== Initial Load ===");
  console.log("Agents loaded:", agents.length);
  console.log("Obstacles loaded:", obstacles.length);
  console.log("Roads loaded:", roads.length);
  console.log("Destinations loaded:", destinations.length);
  console.log("Traffic lights loaded:", trafficLights.length);

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
  //set up obj and mtl for traffic lights
  function createTexture(gl, src) {
    return twgl.createTexture(gl, {
      min: gl.LINEAR,
      mag: gl.LINEAR,
      src: src,
    });
  }

  greenTexture = createTexture(gl, '../assets/textures/Trafficlights/green.png');
  redTexture = createTexture(gl, '../assets/textures/Trafficlights/red.png');

 // Create a texture from your PNG
  const skyTexture = twgl.createTexture(gl, {
    src: '../assets/models/skybox.png',
    min: gl.LINEAR,
    mag: gl.LINEAR
  });

  // Create a base cube for skybox
  const baseCubeTex = new Object3D(3);
  baseCubeTex.arrays = cubeTextured(2);
  baseCubeTex.bufferInfo = twgl.createBufferInfoFromArrays(gl, baseCubeTex.arrays);
  baseCubeTex.vao = twgl.createVAOFromBufferInfo(gl, programInfo, baseCubeTex.bufferInfo);

  // Make it huge and centered to wrap around entire scene
  baseCubeTex.position = { x: 14, y: 0, z: 14 };  // Center on grid (28x28)
  baseCubeTex.scale = { x: -30, y: -30, z: -30 };  // Very large, negative to see inside
  baseCubeTex.programType = 'texture';
  baseCubeTex.texture = skyTexture;
  baseCubeTex.isSkybox = true;
  scene.addObject(baseCubeTex);

const whiteTexture = twgl.createTexture(gl, {
    src: [255,255,255,255],  // RGBA white pixel
    width: 1,
    height: 1
});

const grayTexture = twgl.createTexture(gl, {
    src: [51, 51, 51, 255],  // RGBA dark gray pixel
    width: 1,
    height: 1
});



  // Create VAO for the base cube
  baseCube = new Object3D(-1);
  baseCube.prepareVAO(gl, programInfo);

  carTexture = createTexture(gl, '../assets/textures/Cars/car.jpg');
  const carMaterials = loadMtl(car1Mtl);
  carArrays = loadObj(car1Obj);  // Store globally
  const carObj3D = new Object3D(-10);
  carObj3D.arrays = carArrays;
  carObj3D.bufferInfo = twgl.createBufferInfoFromArrays(gl, carArrays);
  carObj3D.vao = twgl.createVAOFromBufferInfo(gl, colorProgramInfo, carObj3D.bufferInfo);
  
  // Store globally for new car spawning
  carBufferInfo = carObj3D.bufferInfo;
  carVAO = carObj3D.vao;

  // Copiar propiedades a los agentes (carros)
for (const agent of agents) {
    agent.arrays = carArrays;
    agent.bufferInfo = carBufferInfo;
    agent.vao = carVAO;
    agent.scale = { x: 0.5, y: 0.5, z: 0.5 }; 
    agent.texture = carTexture;
    agent.programType = 'texture';

    // Initialize rotation tracking
    agent.oldRotY = 0;
    agent.targetRotY = 0;

    // Random color
    agent.color = [
        Math.random(), // R
        Math.random(), // G
        Math.random(), // B
        1.0            // Alpha
    ];

    scene.addObject(agent);
    console.log("Initial car added:", agent.id);
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

  // Fixed x and z, random y (height)
  const height = 0.5 + Math.random() * 1; // y-scale from 0.5 → 2.0
  obstacle.scale = { x: 0.5, y: height, z: 0.5 };

  obstacle.texture = chosen.texture;

  // Random tint color
  obstacle.color = [
    0.5 + Math.random() * 0.5, // R
    0.5 + Math.random() * 0.5, // G
    0.5 + Math.random() * 0.5, // B
    1.0
  ];

  obstacle.programType = 'texture';
  obstacle.shininess = 32;

  scene.addObject(obstacle);
}


const roadArrays = loadObj(roadObj);     // cube_normals.obj
const roadObj3D = new Object3D(-20);
roadObj3D.arrays = roadArrays;
roadObj3D.bufferInfo = twgl.createBufferInfoFromArrays(gl, roadArrays);
roadObj3D.vao = twgl.createVAOFromBufferInfo(gl, colorProgramInfo, roadObj3D.bufferInfo);

for (const road of roads) {
  road.arrays = roadArrays;
  road.bufferInfo = roadObj3D.bufferInfo;
  road.vao = roadObj3D.vao;

  road.scale = { x: 1, y: 0.1, z: 1 };  // Adjust height as needed
  road.programType = "color";           // IMPORTANT → no texture shader
  road.texture = grayTexture;                  // No texture
  road.color = [0.4, 0.4, 0.4, 1.0];
  road.shininess = 8;                   // Small shininess
  road.rotRad = getRotationByDirection(road.direction);

  scene.addObject(road);
}
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
  destination.scale = { x: 0.05, y: 0.1, z: 0.05 };
  destination.texture = catTexture;
  destination.programType = 'texture';
  destination.shininess = 32;
  destination.color = [1, 1, 1, 1];
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

    trafficL.texture = null; // usa solo color
    trafficL.color = [1, 1, 1, 1];
    trafficL.programType = "color"; 
    trafficL.rotRad = getTrafficLightRotation(trafficL.direction);

    scene.addObject(trafficL);
  }

  // Create lights for each traffic light
  for (const tl of trafficLights) {
    const pos = tl.position;
    const heightOffset = pos.y + 1;  // Position at top of traffic light model

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

  // Create light indicator cubes for traffic lights
  for (const tl of trafficLights) {
    const lightCube = new Object3D(1000 + parseInt(tl.id));
    const pos = tl.position;
    const heightOffset = pos.y +0.3;  // Match light position

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

    // Create VAO for light cube
    lightCube.prepareVAO(gl, programInfo);

    // Set initial texture based on state
    if (tl.state) {
      lightCube.texture = greenTexture;
    } else {
      lightCube.texture = redTexture;
    }

    // Store reference to traffic light
    lightCube.trafficLightId = tl.id;

    trafficLightCubes.push(lightCube);
    scene.addObject(lightCube);
  }

}

// Sincronizar nuevos agentes que aparezcan después del primer frame
function syncNewAgentsInScene() {

    for (const agent of agents) {

        const exists = scene.objects.find(obj => obj.id === agent.id);
        if (exists) continue;

        agent.arrays = carArrays;
        agent.bufferInfo = carBufferInfo;
        agent.vao = carVAO;
        agent.scale = { x: 0.5, y: 0.5, z: 0.5 };
        agent.texture = carTexture;
        agent.programType = "texture";

        // FIX #1: rotation struct
        agent.rotRad = { x: 0, y: 0, z: 0 };

        // FIX #2: interpolation arrays
        agent._posArray = [
            agent.position.x,
            agent.position.y,
            agent.position.z
        ];
        agent._oldPosArray = [...agent._posArray];

        agent.oldRotY = 0;
        agent.targetRotY = 0;

        agent.color = [Math.random(), Math.random(), Math.random(), 1];

        scene.addObject(agent);

        console.log("New car added to scene:", agent.id);
    }
}

// Update traffic light visuals based on state
function updateTrafficLightVisuals() {
  for (const lightCube of trafficLightCubes) {
    const tl = trafficLights.find(t => t.id === lightCube.trafficLightId);
    if (tl) {
      // Update texture based on state
      if (tl.state) {
        lightCube.texture = greenTexture;
      } else {
        lightCube.texture = redTexture;
      }

      // Update light color if light exists
      if (tl.light) {
        const lightColor = tl.state
          ? [0.0, 0.8, 0.0, 1.0] // Green
          : [0.8, 0.0, 0.0, 1.0]; // Red
        
        tl.light.diffuse = lightColor;
        tl.light.specular = lightColor;
      }
    }
  }
}


// Draw an object with its corresponding transformations
function drawObject(gl, programInfo, object, viewProjectionMatrix, fract) {

    // --- Ensure interpolation arrays exist ---
    if (!object._posArray) {
        object._posArray = [object.position.x, object.position.y, object.position.z];
    }
    if (!object._oldPosArray) {
        object._oldPosArray = [...object._posArray];
    }

    // --- Position interpolation ---
    const x = object._oldPosArray[0] + (object._posArray[0] - object._oldPosArray[0]) * fract;
    const y = object._oldPosArray[1] + (object._posArray[1] - object._oldPosArray[1]) * fract;
    const z = object._oldPosArray[2] + (object._posArray[2] - object._oldPosArray[2]) * fract;

    // --- Rotation interpolation ---
    let rotY = object.rotRad.y;

    if (object.oldRotY !== undefined && object.targetRotY !== undefined) {

        let delta = ((object.targetRotY - object.oldRotY + Math.PI) % (2 * Math.PI)) - Math.PI;

        rotY = object.oldRotY + delta * fract;
    }

    // --- Build transform ---
    const scaMat = M4.scale(object.scale ? [object.scale.x, object.scale.y, object.scale.z] : [1,1,1]);
    const rotXMat = M4.rotationX(object.rotRad.x);
    const rotYMat = M4.rotationY(rotY);
    const rotZMat = M4.rotationZ(object.rotRad.z);
    const traMat = M4.translation([x, y, z]);

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
        u_shininess: object.shininess
    };

    gl.bindVertexArray(object.vao);
    twgl.setUniforms(programInfo, uniforms);
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
    u_quadratic: 0.09,
  };

  // Draw objects
  gl.useProgram(colorProgramInfo.program);
  twgl.setUniforms(colorProgramInfo, uniforms);

  for (let object of scene.objects) {
      // Disable culling for skybox to prevent clipping
      if (object.isSkybox) {
        gl.disable(gl.CULL_FACE);
        gl.depthFunc(gl.LEQUAL); // Render skybox at maximum depth
      } else {
        gl.enable(gl.CULL_FACE);
        gl.depthFunc(gl.LESS);
      }
      
      drawObject(gl, colorProgramInfo, object, viewProjectionMatrix, fract);
  }
    // Update the scene after the elapsed duration
  if (elapsed >= duration) {
    elapsed = 0;
    await update();  
    syncNewAgentsInScene(); // avanza un step en Mesa y actualiza posiciones
    updateTrafficLightVisuals(); // Update traffic light colors/textures
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