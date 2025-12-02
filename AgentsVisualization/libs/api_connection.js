/*
 * Functions to connect to an external API to get the coordinates of agents
 *
 * Gilberto Echeverria
 * 2025-11-08
 */

'use strict';

import { Object3D } from '../libs/object3d';

// Define the agent server URI
const agent_server_uri = "http://localhost:8585/";

// Initialize arrays to store agents and obstacles
const agents = [];
const obstacles = [];

// Define the data object
const initData = {
    NAgents: 20,
    width: 28,
    height: 28
};


/* FUNCTIONS FOR THE INTERACTION WITH THE MESA SERVER */

/*
 * Initializes the agents model by sending a POST request to the agent server.
 */
async function initAgentsModel() {
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

/*
 * Retrieves the current positions of all agents from the agent server.
 */
async function getAgents() {
    try {
        let response = await fetch(agent_server_uri + "getAgents");

        if (response.ok) {
            let result = await response.json();
            const positions = result.positions || [];

            // Si no hay agentes en el servidor, no hacemos nada raro
            if (positions.length === 0) {
                // console.log("No hay agentes en el servidor todavía");
                return;
            }

            // Primer frame: crear todos los Object3D
            if (agents.length === 0) {
                for (const agent of positions) {
                    const newAgent = new Object3D(agent.id, [agent.x, agent.y, agent.z]);
                    // Guardar posición anterior = actual (para interpolación)
                    newAgent.oldPosArray = [...newAgent.posArray];
                    agents.push(newAgent);
                }
                console.log("Agentes creados:", agents);

            } else {
                // Frames siguientes: actualizar o crear nuevos si aparecen
                for (const agent of positions) {
                    let current_agent = agents.find((object3d) => object3d.id == agent.id);

                    if (current_agent !== undefined) {
                        // Actualizar posición: mover oldPosArray -> posArray
                        current_agent.oldPosArray = [...current_agent.posArray];
                        current_agent.position = { x: agent.x, y: agent.y, z: agent.z };
                    } else {
                        // Apareció un agente nuevo que antes no existía
                        const newAgent = new Object3D(agent.id, [agent.x, agent.y, agent.z]);
                        newAgent.oldPosArray = [...newAgent.posArray];
                        agents.push(newAgent);
                        console.log("Nuevo agente agregado:", newAgent.id);
                    }
                }
            }
        }

    } catch (error) {
        console.log(error);
    }
}

/*
 * Retrieves the current positions of all obstacles from the agent server.
 */
async function getObstacles() {
    try {
        let response = await fetch(agent_server_uri + "getObstacles");

        if (response.ok) {
            let result = await response.json();

            for (const obstacle of result.positions) {
                const newObstacle = new Object3D(obstacle.id, [obstacle.x, obstacle.y, obstacle.z]);
                obstacles.push(newObstacle);
            }
            // console.log("Obstacles:", obstacles);
        }

    } catch (error) {
        console.log(error);
    }
}

/*
 * Updates the agent positions by sending a request to the agent server.
 */
async function update() {
    try {
        let response = await fetch(agent_server_uri + "update");

        if (response.ok) {
            // Después de avanzar un step en Mesa, volvemos a pedir las posiciones
            await getAgents();
            // console.log("Updated agents");
        }

    } catch (error) {
        console.log(error);
    }
}

export { agents, obstacles, initAgentsModel, update, getAgents, getObstacles };
