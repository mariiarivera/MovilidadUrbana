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
const roads = [];
const destinations = [];
const trafficLights = [];

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
 * Calculate rotation based on movement direction
 */
function calculateRotation(oldPos, newPos) {
    const dx = newPos[0] - oldPos[0];
    const dz = newPos[2] - oldPos[2];
    
    // No movement
    if (dx === 0 && dz === 0) return null;
    
    // Calculate angle in radians
    // Right = 0, Up = -90°, Left = 180°, Down = 90°
    if (dx > 0) return 0;                    // Moving right (positive X)
    if (dx < 0) return Math.PI;              // Moving left (negative X)
    if (dz > 0) return -Math.PI / 2;         // Moving up (positive Z)
    if (dz < 0) return Math.PI / 2;          // Moving down (negative Z)
    
    return null;
}

/*
 * Retrieves the current positions of all agents from the agent server.
 */
async function getAgents() {
    try {
        // Send a GET request to the agent server to retrieve the agent positions
        let response = await fetch(agent_server_uri + "getAgents");

        // Check if the response was successful
        if (response.ok) {
            // Parse the response as JSON
            let result = await response.json();

            // Log the agent positions
            //console.log("getAgents positions: ", result.positions)

            // Check if the agents array is empty
            if (agents.length == 0) {
                // Create new agents and add them to the agents array
                for (const agent of result.positions) {
                    const newAgent = new Object3D(agent.id, [agent.x, agent.y, agent.z]);
                    // Store the initial position
                    newAgent['oldPosArray'] = newAgent.posArray;
                    agents.push(newAgent);
                }
                // Log the agents array
                console.log("Agents:", agents);

            } else {
                // Update the positions of existing agents
                for (const agent of result.positions) {
                    let current_agent = agents.find(o => o.id == agent.id);

                    if (!current_agent) {
                        const newAgent = new Object3D(agent.id, [agent.x, agent.y, agent.z]);
                        newAgent.oldPosArray = newAgent.posArray;
                        agents.push(newAgent);
                    } else {
                        // Regular update
                        current_agent.oldPosArray = current_agent.posArray;
                        //console.log("Current agent id:", current_agent.id, "oldPosArray:", current_agent.oldPosArray);
                        current_agent.position = { x: agent.x, y: agent.y, z: agent.z };
                        //console.log("Updated agent id:", current_agent.id, "new posArray:", current_agent.posArray);
                    }
                }
            }
        }

    } catch (error) {
        // Log any errors that occur during the request
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

async function getRoads() {
    try {
        let response = await fetch(agent_server_uri + "getRoads");

        if (response.ok) {
            let result = await response.json();

            for (const roadData of result.positions) {
                const newRoad = new Object3D(roadData.id, [roadData.x, roadData.y, roadData.z]);
                newRoad.direction = roadData.direction; // Store direction
                roads.push(newRoad); 
            }
        }

    } catch (error) {
        console.log(error);
    }
}

async function getDestinations() {
    try {
        let response = await fetch(agent_server_uri + "getDestinations");

        if (response.ok) {
            let result = await response.json();

            for (const dest of result.positions) {   // <- changed name
                const newDestination = new Object3D(dest.id, [dest.x, dest.y, dest.z]);
                destinations.push(newDestination);   // <- outer array
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

            for (const tl of result.positions) {
                const newTrafficLight = new Object3D(tl.id, [tl.x, tl.y, tl.z]);
                newTrafficLight.state = tl.state;       // Store state (true = green, false = red)
                newTrafficLight.direction = tl.direction; // Store direction
                trafficLights.push(newTrafficLight);
            }
            console.log("Traffic lights loaded:", trafficLights.length);
        }

    } catch (error) {
        console.log(error);
    }
}

/*
 * Updates traffic light states by fetching latest data
 */
async function updateTrafficLights() {
    try {
        let response = await fetch(agent_server_uri + "getTrafficLights");

        if (response.ok) {
            let result = await response.json();

            for (const tlData of result.positions) {
                const existingTL = trafficLights.find(tl => tl.id == tlData.id);
                if (existingTL) {
                    existingTL.state = tlData.state;
                }
            }
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
            await updateTrafficLights(); // Update traffic light states
            // console.log("Updated agents");
        }

    } catch (error) {
        console.log(error);
    }
}

export { agents, obstacles, roads, destinations, trafficLights, initAgentsModel, update, getAgents, getObstacles, getRoads, getDestinations, getTrafficLights, updateTrafficLights };