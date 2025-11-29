/*
 * Script to read a model stored in Wavefront OBJ format
 * Handles positive and negative indices
 *
 * Gilberto Echeverria
 * 2025-07-29 (fixed 2025-11-29)
 */

'use strict';

// Global variable for all materials loaded
let materials = {};
let materialInUse = undefined;

/**
 * Parse a face line (f ...) and push data into arrays
 */
function parseFace(parts, objData, arrays) {
    // Each vertex in the face
    let faceVerts = parts.slice(1).map(face => face.split('/'));

    faceVerts.forEach(vert => {
        // vert = [vertexIndex, texCoordIndex, normalIndex]
        let vIndex = parseInt(vert[0]);
        let tIndex = vert[1] !== undefined && vert[1] !== "" ? parseInt(vert[1]) : undefined;
        let nIndex = vert[2] !== undefined && vert[2] !== "" ? parseInt(vert[2]) : undefined;

        // Convert negative indices
        if (vIndex < 0) vIndex = objData.vertices.length + vIndex;
        if (tIndex !== undefined && tIndex < 0) tIndex = objData.textures.length + tIndex;
        if (nIndex !== undefined && nIndex < 0) nIndex = objData.normals.length + nIndex;

        // Push vertex position
        if (objData.vertices[vIndex]) {
            arrays.a_position.data.push(...objData.vertices[vIndex]);
        } else {
            console.warn(`Invalid vertex index: ${vert[0]}`);
            arrays.a_position.data.push(0, 0, 0);
        }

        // Push texture coordinate
        if (tIndex !== undefined && objData.textures[tIndex]) {
            arrays.a_texCoord.data.push(...objData.textures[tIndex]);
        } else if (arrays.a_texCoord.numComponents === 2) {
            arrays.a_texCoord.data.push(0, 0);
        }

        // Push normal
        if (nIndex !== undefined && objData.normals[nIndex]) {
            arrays.a_normal.data.push(...objData.normals[nIndex]);
        } else if (arrays.a_normal.numComponents === 3) {
            arrays.a_normal.data.push(0, 0, 0);
        }

        // Push color from material
        if (materialInUse && materialInUse['Kd']) {
            arrays.a_color.data.push(...materialInUse['Kd'], 1);
        } else {
            arrays.a_color.data.push(0.4, 0.4, 0.4, 1);
        }

        // Store face info
        objData.faces.push({ v: vert[0], t: vert[1], n: vert[2] });
    });
}

/**
 * Load OBJ string
 */
function loadObj(objString) {
    let objData = {
        vertices: [[0, 0, 0]],  // dummy
        normals: [[0, 0, 0]],   // dummy
        textures: [[0, 0]],     // dummy
        faces: []
    };

    let arrays = {
        a_position: { numComponents: 3, data: [] },
        a_color: { numComponents: 4, data: [] },
        a_normal: { numComponents: 3, data: [] },
        a_texCoord: { numComponents: 2, data: [] }
    };

    let lines = objString.split('\n');
    lines.forEach(line => {
        let parts = line.trim().split(/\s+/);
        if (parts.length === 0 || parts[0] === '' || parts[0].startsWith('#')) return;

        switch (parts[0]) {
            case 'v':
                let vert = parts.slice(1).map(Number);
                objData.vertices.push(vert);
                break;
            case 'vn':
                let norm = parts.slice(1).map(Number);
                objData.normals.push(norm);
                break;
            case 'vt':
                let tex = parts.slice(1).map(Number);
                objData.textures.push(tex);
                break;
            case 'f':
                parseFace(parts, objData, arrays);
                break;
            case 'usemtl':
                if (materials.hasOwnProperty(parts[1])) {
                    materialInUse = materials[parts[1]];
                }
                break;
        }
    });

    return arrays;
}

/**
 * Load MTL string
 */
function loadMtl(mtlString) {
    let currentMtl = {};
    let lines = mtlString.split('\n');
    lines.forEach(line => {
        let parts = line.trim().split(/\s+/);
        if (parts.length === 0 || parts[0] === '' || parts[0].startsWith('#')) return;

        switch (parts[0]) {
            case 'newmtl':
                materials[parts[1]] = {};
                currentMtl = materials[parts[1]];
                break;
            case 'Ns':
                currentMtl['Ns'] = Number(parts[1]);
                break;
            case 'Kd':
                currentMtl['Kd'] = parts.slice(1).map(Number);
                break;
        }
    });

    return materials;
}

export { loadObj, loadMtl };
