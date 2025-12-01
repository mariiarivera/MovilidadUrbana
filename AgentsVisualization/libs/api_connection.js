'use strict';

import { Object3D } from '../libs/object3d';

// Server URL
const agent_server_uri = "http://localhost:8585/";

// Arrays for each type
const agents = [];
const obstacles = [];
const trafficLights = [];
const road = [];
const destination = [];
const sidewalks = [];

// Initial config
const initData = {
    NAgents: 20,
    width: 28,
    height: 28
};

async function initAgentsModel() { //1
    try {
        let response = await fetch(agent_server_uri + "init", {
            method: 'POST',
            headers: { 'Content-Type':'application/json' },
            body: JSON.stringify(initData)
        });

        if (response.ok) {
            let result = await response.json();
            console.log(result.message);
        }

    } catch (error) {
        console.log(error);
    }
}

async function getAgents() {
    try {
        // Realiza una solicitud GET al servidor para obtener las posiciones de los agentes
        let response = await fetch(agent_server_uri + "getAgents");

        // Verifica si la respuesta fue exitosa
        if (response.ok) {
            // Parsea la respuesta como JSON
            let result = await response.json();

            // Verifica si el array de agentes está vacío
            if (agents.length == 0) {
                // Si está vacío, crea nuevos agentes y agréguelos al array de agentes
                for (const agent of result.positions) {
                    const newAgent = new Object3D(agent.id, [agent.x, agent.y, agent.z]);
                    // Almacena la posición inicial en oldPosArray
                    newAgent['oldPosArray'] = [...newAgent.posArray];
                    agents.push(newAgent);
                }
                // Log de los agentes
                console.log("Agentes iniciales:", agents);

            } else {
                // Si ya existen agentes, actualiza sus posiciones
                for (const agent of result.positions) {
                    // Busca el agente actual en el array de agentes
                    let current_agent = agents.find(o => o.id == agent.id);

                    if (!current_agent) {
                        // Si no existe, crea un nuevo agente y lo agrega
                        const newAgent = new Object3D(agent.id, [agent.x, agent.y, agent.z]);
                        newAgent.oldPosArray = [...newAgent.posArray];
                        agents.push(newAgent);
                    } else {
                        // Si existe, actualiza la posición
                        current_agent.oldPosArray = [...current_agent.posArray];
                        current_agent.position = { x: agent.x, y: agent.y, z: agent.z };
                        // Log de actualización
                        console.log(`Agente actualizado: id = ${current_agent.id}, posición antigua =`, current_agent.oldPosArray, "nueva posición =", current_agent.posArray);
                    }
                }
            }
        }

    } catch (error) {
        // Si ocurre un error, lo imprime
        console.log("Error al obtener los agentes:", error);
    }
}


async function getObstacles() {
    try {
        let response = await fetch(agent_server_uri + "getObstacles");

        if (response.ok) {
            let result = await response.json();
            for (const o of result.positions) {
                obstacles.push(new Object3D(o.id, [o.x, o.y, o.z]));
            }
        }

    } catch (error) {
        console.log(error);
    }
}

async function getTrafficLights() {
    try {
        let response = await fetch(agent_server_uri + "getTrafficLights");

        if (response.ok) {
            let result = await response.json();
            for (const t of result.positions) {
                trafficLights.push(new Object3D(t.id, [t.x, t.y, t.z]));
            }
        }

    } catch (error) {
        console.log(error);
    }
}

async function getRoad() {
    try {
        let response = await fetch(agent_server_uri + "getRoad");

        if (response.ok) {
            let result = await response.json();
            for (const r of result.positions) {
                road.push(new Object3D(r.id, [r.x, r.y, r.z]));
            }
        }

    } catch (error) {
        console.log(error);
    }
}

async function getDestination() {
    try {
        let response = await fetch(agent_server_uri + "getDestination");

        if (response.ok) {
            let result = await response.json();
            for (const d of result.positions) {
                destination.push(new Object3D(d.id, [d.x, d.y, d.z]));
            }
        }

    } catch (error) {
        console.log(error);
    }
}

async function getSideWalks() {
    try {
        let response = await fetch(agent_server_uri + "getSideWalks");

        if (response.ok) {
            let result = await response.json();
            for (const s of result.positions) {
                sidewalks.push(new Object3D(s.id, [s.x, s.y, s.z]));
            }
        }

    } catch (error) {
        console.log(error);
    }
}

async function update() {
    try {
        let response = await fetch(agent_server_uri + "update");

        if (response.ok) {
            await getAgents();
            //await getObstacles();
            await getTrafficLights();
            //await getRoad();
            //await getDestination();
        }

    } catch (error) {
        console.log(error);
    }
}

export {
    agents, obstacles, destination, road, trafficLights, sidewalks,
    initAgentsModel, update, getAgents, getObstacles,
    getDestination, getRoad, getTrafficLights, getSideWalks
};
