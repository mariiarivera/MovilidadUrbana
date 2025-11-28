'use strict';

import * as twgl from 'twgl-base.js';
import GUI from 'lil-gui';
import { M4 } from '../libs/3d-lib';
import { Scene3D } from '../libs/scene3d';
import { Object3D } from '../libs/object3d';
import { Camera3D } from '../libs/camera3d';

// API communication
import {
  agents, obstacles, initAgentsModel,
  update, getAgents, getObstacles, trafficLights, road, destination,
  getTrafficLights, getRoad, getDestination 
} from '../libs/api_connection.js';

// Shaders
import vsColor from '../assets/shaders/vs_color.glsl?raw';
import fsColor from '../assets/shaders/fs_color.glsl?raw';
import vsPhong from '../assets/shaders/vs_phong.glsl?raw';
import fsPhong from '../assets/shaders/fs_phong.glsl?raw';

// OBJ models
import trafficLightOBJ from '../assets/models/trafficlight.obj?raw';
import roadOBJ from '../assets/models/road.obj?raw';
import carOBJ from '../../objs/free_car_001.obj?raw';

const scene = new Scene3D();
let gl;
let colorProgramInfo;
let phongProgramInfo;

const duration = 1000;
let elapsed = 0;
let then = 0;

async function main() {
  const canvas = document.querySelector('canvas');
  gl = canvas.getContext('webgl2');
  twgl.resizeCanvasToDisplaySize(gl.canvas);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  colorProgramInfo = twgl.createProgramInfo(gl, [vsColor, fsColor]);
  phongProgramInfo = twgl.createProgramInfo(gl, [vsPhong, fsPhong]);

  await initAgentsModel();
  await getAgents();
  await getObstacles();
  await getTrafficLights();
  await getRoad();
  await getDestination();

  setupScene();
  setupObjects(scene, gl);
  setupUI();
  drawScene();
}

function setupScene() {
  const camera = new Camera3D(0, 10, 4, 0.8, [0, 0, 10], [0, 0, 0]);
  camera.panOffset = [0, 8, 0];
  scene.setCamera(camera);
  scene.camera.setupControls();
}

function setupObjects(scene, gl) {
  // Base cube for obstacles, roads, destinations
  const baseCube = new Object3D(-1);
  baseCube.prepareVAO(gl, colorProgramInfo);

  // Car OBJ model
  const carModel = new Object3D(-2);
  carModel.prepareVAO(gl, phongProgramInfo, carOBJ);

  // Building OBJ model (traffic lights)
  const trafficLightModel = new Object3D(-3);
  trafficLightModel.prepareVAO(gl, phongProgramInfo, trafficLightOBJ);

  const roadModel = new Object3D(-4);
  roadModel.prepareVAO(gl, phongProgramInfo, roadOBJ);

  // AGENTS → Car OBJ
  for (const agent of agents) {
    agent.arrays = carModel.arrays;
    agent.bufferInfo = carModel.bufferInfo;
    agent.vao = carModel.vao;
    agent.scale = { x: 1.5, y: 1.5, z: 1.5 }; 
    agent.posArray = agent.posArray || [0,0,0]; 
    agent.rotRad = agent.rotRad || {x:0, y:0, z:0};

    // Phong material
    agent.ambientColor = [0.1, 0.1, 0.1, 1];
    agent.diffuseColor = [0.8, 0.1, 0.1, 1];
    agent.specularColor = [1, 1, 1, 1];
    agent.shininess = 50;

    scene.addObject(agent);
  }

  // OBSTACLES → Cubes
  for (const ob of obstacles) {
    ob.arrays = baseCube.arrays;
    ob.bufferInfo = baseCube.bufferInfo;
    ob.vao = baseCube.vao;
    ob.scale = { x: 0.5, y: 0.5, z: 0.5 };
    ob.color = [0.7, 0.7, 0.7, 1];
    scene.addObject(ob);
  }

  // TRAFFIC LIGHTS → Building OBJ
  for (const tl of trafficLights) {
    tl.arrays = trafficLightModel.arrays;
    tl.bufferInfo = trafficLightModel.bufferInfo;
    tl.vao = trafficLightModel.vao;
    tl.scale = { x: 0.2, y: 0.09, z: 0.2 };

    tl.ambientColor = [0.1, 0.1, 0.1, 1];
    tl.diffuseColor = [1, 1, 0, 1];
    tl.specularColor = [1, 1, 1, 1];
    tl.shininess = 30;

    scene.addObject(tl);
  }

  // ROADS → road OBJ
  for (const rd of road) {
    rd.arrays = roadModel.arrays;
    rd.bufferInfo = roadModel.bufferInfo;
    rd.vao = roadModel.vao;
    rd.scale = { x: 1.0, y: 0.1, z: 1.0 };
    rd.ambientColor = [0.1, 0.1, 0.1, 1];
    rd.diffuseColor = [1, 1, 0, 1];
    rd.specularColor = [1, 1, 1, 1];
    rd.shininess = 30;


    scene.addObject(rd);
  }

  // DESTINATIONS → Cubes
  for (const dst of destination) {
    dst.arrays = baseCube.arrays;
    dst.bufferInfo = baseCube.bufferInfo;
    dst.vao = baseCube.vao;
    dst.scale = { x: 0.6, y: 0.6, z: 0.6 };
    dst.color = [0, 1, 0, 1];
    scene.addObject(dst);
  }
}

function drawObject(gl, programInfo, object, viewProjectionMatrix) {
  const scaMat = M4.scale(object.scaArray || object.scale || {x:1,y:1,z:1});
  const rotXMat = M4.rotationX(object.rotRad?.x || 0);
  const rotYMat = M4.rotationY(object.rotRad?.y || 0);
  const rotZMat = M4.rotationZ(object.rotRad?.z || 0);
  const traMat = M4.translation(object.posArray || [0,0,0]);

  let transforms = M4.identity();
  transforms = M4.multiply(scaMat, transforms);
  transforms = M4.multiply(rotXMat, transforms);
  transforms = M4.multiply(rotYMat, transforms);
  transforms = M4.multiply(rotZMat, transforms);
  transforms = M4.multiply(traMat, transforms);

  object.matrix = transforms;
  const wvpMat = M4.multiply(viewProjectionMatrix, transforms);

  const usePhong = object.ambientColor !== undefined;
  const program = usePhong ? phongProgramInfo : colorProgramInfo;

  gl.useProgram(program.program);
  gl.bindVertexArray(object.vao);

  if (usePhong) {
    twgl.setUniforms(program, {
      u_lightWorldPosition: [10, 20, 10],
      u_viewWorldPosition: scene.camera.posArray,
      u_ambientLight: [0.2, 0.2, 0.2, 1],
      u_diffuseLight: [1, 1, 1, 1],
      u_specularLight: [1, 1, 1, 1],
      u_ambientColor: object.ambientColor,
      u_diffuseColor: object.diffuseColor,
      u_specularColor: object.specularColor,
      u_shininess: object.shininess,
      u_world: object.matrix,
      u_worldInverseTransform: M4.inverse(object.matrix),
      u_worldViewProjection: wvpMat
    });
  } else {
    twgl.setUniforms(program, { u_transforms: wvpMat, u_color: object.color });
  }

twgl.drawBufferInfo(gl, object.bufferInfo);

}


async function drawScene() {
  const now = Date.now();
  const deltaTime = now - then;
  elapsed += deltaTime;
  const fract = Math.min(1.0, elapsed / duration);
  then = now;

  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);

  scene.camera.checkKeys();
  const viewProjectionMatrix = setupViewProjection(gl);

  for (const object of scene.objects) {
    drawObject(gl, object.ambientColor ? phongProgramInfo : colorProgramInfo,
               object, viewProjectionMatrix, fract);
  }

  if (elapsed >= duration) {
    elapsed = 0;
    await update();
    updateSceneObj();
  }

  requestAnimationFrame(drawScene);
}

function setupViewProjection(gl) {
  const fov = 60 * Math.PI / 180;
  const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
  const projectionMatrix = M4.perspective(fov, aspect, 1, 200);

  const cameraMatrix = M4.lookAt(scene.camera.posArray, scene.camera.targetArray, [0, 1, 0]);
  const viewMatrix = M4.inverse(cameraMatrix);

  return M4.multiply(projectionMatrix, viewMatrix);
}

function setupUI() {
  // GUI can be added here if needed
}

main();
