/*
    Set directions of objects that require it 
    like traffic lights and cars. Dictionary of our imports to have 
    a cleaner code.
 */

'use strict';

// Imports
import * as twgl from 'twgl-base.js';
import { Object3D } from '../libs/object3d.js';
import { loadMtl, loadObj } from '../libs/obj_loader.js';

// Utils
export function createTexture(gl, src) {
  return twgl.createTexture(gl, {
    min: gl.LINEAR,
    mag: gl.LINEAR,
    src: src,
  });
}

// Buildings
import buildingOneObj from '../assets/models/building_1.obj?raw';
import buildingOneMtl from '../assets/models/building_1.mtl?raw';
import buildingTwoObj from '../assets/models/building_1.obj?raw';
import buildingTwoMtl from '../assets/models/building_1.mtl?raw';
import buildingThreeObj from '../assets/models/building_2.obj?raw';
import buildingThreeMtl from '../assets/models/building_2.mtl?raw';
import buildingFourObj from '../assets/models/Building,.obj?raw';
import buildingFourMtl from '../assets/models/Building,.mtl?raw';
import buildingFiveObj from '../assets/models/Cyprys_House.obj?raw';
import buildingFiveMtl from '../assets/models/Cyprys_House.mtl?raw';
import buildingSixObj from '../assets/models/Building,.obj?raw';
import buildingSixMtl from '../assets/models/Building,.mtl?raw';

// Destination
import destinationObj from '../assets/models/Tree.obj?raw';
import destinationMtl from '../assets/models/Tree.mtl?raw';

// Traffic Lights
import trafficLightsObj from '../assets/models/stoplight_1.obj?raw';
import trafficLightsMtl from '../assets/models/stoplight_1.mtl?raw';

// Roads
import roadObj from '../assets/models/untitled.obj?raw';
import roadMtl from '../assets/models/untitled.mtl?raw';

// Cars
import car1Obj from '../assets/models/car.obj?raw';
import car1Mtl from '../assets/models/car.mtl?raw';


// Model Dictionaries

export const buildingModels = {
  0: { obj: buildingOneObj, mtl: buildingOneMtl, type: 'texture' },
  1: { obj: buildingTwoObj, mtl: buildingTwoMtl, type: 'texture' },
  2: { obj: buildingThreeObj, mtl: buildingThreeMtl, type: 'texture' },
  3: { obj: buildingFourObj, mtl: buildingFourMtl, type: 'texture' },
  4: { obj: buildingFiveObj, mtl: buildingFiveMtl, type: 'texture' },
  5: { obj: buildingSixObj, mtl: buildingSixMtl, type: 'texture' },
};

export const destinationModel = { obj: destinationObj, mtl: destinationMtl, type: 'texture' };

export const carModels = {
  0: { obj: car1Obj, mtl: car1Mtl, type: 'texture' },
};

export const trafficLightModel = { obj: trafficLightsObj, mtl: trafficLightsMtl, type: 'texture' };
export const roadModel = { obj: roadObj, mtl: roadMtl, type: 'texture' };

// Textures
let skyboxTexture, sidewalkTexture, BuildingTextureOne, BuildingTextureTwo, BuildingTextureThree, 
carOneTexture, greenTexture, redTexture, destinationTexture, plant, BuildingTextureFour;

export function initTextures(gl) {
  skyboxTexture = createTexture(gl, '../assets/textures/Skyboxes/Cubemap_Sky_08-512x512.png');
  sidewalkTexture = createTexture(gl, '../assets/textures/Road/render.png');
  BuildingTextureOne = createTexture(gl, '../assets/textures/Building/building_albedo.png');
  BuildingTextureTwo = createTexture(gl, '../assets/textures/Building/building_albedo.png');
  BuildingTextureThree = createTexture(gl, '../assets/textures/Building/building_normals.png');
  destinationTexture = createTexture(gl, '../assets/textures/Destination/bishop.jpg')
  carOneTexture = createTexture(gl, '../assets/textures/Cars/Tyre.png');
  greenTexture = createTexture(gl, '../assets/textures/Trafficlights/green.png');
  redTexture = createTexture(gl, '../assets/textures/Trafficlights/red.png'); 
  plant = createTexture(gl, '../assets/textures/Destination/indoorplant_2_vl.jpg');
  BuildingTextureFour = createTexture(gl, '../assets/textures/Building/BrickSmallBrown0155_1_S.jpg');
}

export {
  skyboxTexture, sidewalkTexture, BuildingTextureOne,
  BuildingTextureTwo, BuildingTextureThree,
  carOneTexture, greenTexture, redTexture, destinationTexture,
  plant, BuildingTextureFour
};

// rotations, light positions and directions
export function getRotation(oldPos, newPos) {
  const dx = newPos[0] - oldPos[0];
  const dz = newPos[2] - oldPos[2];

  if (Math.abs(dx) === 0 && Math.abs(dz) === 0) return null;

  let direction = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? "Right" : "Left") : (dz > 0 ? "Up" : "Down");

  switch (direction) {
    case "Right": return Math.PI / 2;
    case "Left": return -Math.PI / 2;
    case "Up": return 0;
    case "Down": return Math.PI;
  }
}

export function getLightsCloseToCamera(numLights, scene) {
  const [cx, cy, cz] = scene.camera.posArray;
  const lightDistances = scene.lights.map((l, i) => {
    const [lx, ly, lz] = l.posArray;
    return { index: i, distance: Math.sqrt((lx-cx)**2 + (ly-cy)**2 + (lz-cz)**2) };
  });
  lightDistances.sort((a, b) => a.distance - b.distance);
  return lightDistances.slice(0, Math.min(numLights, lightDistances.length)).map(ld => scene.lights[ld.index]);
}

export function applyProperties(obj, props) {
  if (props.scale) obj.scale = props.scale;
  if (props.color) obj.color = props.color;
  if (props.shininess !== undefined) obj.shininess = props.shininess;
  if (props.texture) obj.texture = props.texture;
  if (props.programType) obj.programType = props.programType;
  if (props.rotRad) obj.rotRad = props.rotRad;
  if (props.position) obj.position = props.position;
}

export function assignModelToAgents(agents, baseModel, props = {}) {
  for (const agent of agents) {
    agent.arrays = baseModel.arrays;
    agent.bufferInfo = baseModel.bufferInfo;
    agent.vao = baseModel.vao;
    applyProperties(agent, props);
  }
}

export function createBaseModelWithMtl(id, gl, programInfo, modelObj, modelMtl) {
  if (modelMtl) loadMtl(modelMtl);
  const baseModel = new Object3D(id);
  baseModel.prepareVAO(gl, programInfo, modelObj);
  baseModel.programType = 'texture';
  return baseModel;
}

export function createBaseModels(gl, programInfo, models) {
  const baseModels = {};
  let id = 100;
  for (const [key, model] of Object.entries(models)) {
    if (model.mtl) loadMtl(model.mtl);
    const bm = new Object3D(id++);
    bm.prepareVAO(gl, programInfo, model.obj);
    bm.programType = 'texture';
    baseModels[key] = bm;
  }
  return baseModels;
}

export function getRotationByDirection(direction) {
  switch (direction) {
    case "Right": return { x: 0, y: Math.PI / 2, z: 0 };
    case "Left": return { x: 0, y: -Math.PI / 2, z: 0 };
    case "Up": return { x: 0, y: 0, z: 0 };
    case "Down": return { x: 0, y: Math.PI, z: 0 };
    default: return { x: 0, y: 0, z: 0 };
  }
}

export function getTrafficLightRotation(direction) {
  switch (direction) {
    case "Right":
    case "Left": return { x: 0, y: Math.PI * 3 / 2, z: 0 };
    case "Up":
    case "Down": return { x: 0, y: Math.PI, z: 0 };
    default: return { x: 0, y: 0, z: 0 };
  }
}

export function getTrafficLightOffset(direction, distance = 0.5) {
  let offsetX = 0, offsetZ = 0;
  switch (direction) {
    case "Right": case "Left": offsetZ = distance; break;
    case "Up": case "Down": offsetX = -distance; break;
  }
  return { offsetX, offsetZ };
}

export function getTrafficLightColor(state) {
  return state ? [0.0, 0.8, 0.0, 1.0] : [0.8, 0.0, 0.0, 1.0];
}

// update traffic lights based on state. ChatGPT function 
export function updateTrafficLights(trafficLights, greenTexture, redTexture) {
  for (const tl of trafficLights) {
    const pos = tl.position;
    const heightOffset = pos.y + 0.8;
    const lightColor = getTrafficLightColor(tl.state);
    if (tl.light) {
      const offset = getTrafficLightOffset(tl.direction, -0.65);
      tl.light.position = { x: pos.x + offset.offsetX, y: heightOffset, z: pos.z + offset.offsetZ };
      tl.light.diffuse = lightColor;
      tl.light.specular = lightColor;
    }
    if (tl.lightCube) {
      const offset = getTrafficLightOffset(tl.direction, -0.65);
      tl.lightCube.position = { x: pos.x + offset.offsetX, y: pos.y + 0.9, z: pos.z + offset.offsetZ };
      tl.lightCube.texture = tl.state ? greenTexture : redTexture;
    }
  }
}
