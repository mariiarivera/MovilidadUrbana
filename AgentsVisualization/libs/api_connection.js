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
        let response = await fetch(agent_server_uri + "getAgents");

        if (response.ok) {
            let result = await response.json();

            if (agents.length === 0) {
                console.log("carros creados", agents, result);
                for (const agent of result.positions) {
                    const newAgent = new Object3D(agent.id, [agent.x, agent.y, agent.z]);
                    newAgent.oldPosArray = newAgent.posArray;
                    agents.push(newAgent);
                }
            } else {
                for (const agent of result.positions) {
                    const current_agent = agents.find(a => a.id == agent.id);

                    if (current_agent) {
                        current_agent.oldPosArray = current_agent.posArray;
                        current_agent.position = { x: agent.x, y: agent.y, z: agent.z };
                    }
                }
            }
        }

    } catch (error) {
        console.log(error);
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
