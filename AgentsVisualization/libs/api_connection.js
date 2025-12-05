// ==========================================
// api_connection.js
// Comunicación entre WebGL y Flask
// ==========================================

const API_URL = "http://localhost:8585";

export let agents = [];
export let obstacles = [];
export let roads = [];
export let destinations = [];
export let trafficLights = [];


// ================================
// INIT MODEL
// ================================
export async function initAgentsModel() {
    console.log("→ Initializing model...");

    const body = {
        NAgents: 10,
        width: 28,
        height: 28
    };

    const response = await fetch(`${API_URL}/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

    return response.json();
}


// ================================
// GET AGENTS
// ================================
export async function getAgents() {
    const res = await fetch(`${API_URL}/getAgents`);
    const data = await res.json();

    agents.length = 0;

    for (let a of data.positions) {
        agents.push({
            id: a.id,
            position: { x: a.x, y: a.y, z: a.z },
            direction: a.direction ?? "Right"   // OPTIONAL
        });
    }

    return agents;
}


// ================================
// GET OBSTACLES
// ================================
export async function getObstacles() {
    const res = await fetch(`${API_URL}/getObstacles`);
    const data = await res.json();

    obstacles.length = 0;

    for (let o of data.positions) {
        obstacles.push({
            id: o.id,
            position: { x: o.x, y: o.y, z: o.z }
        });
    }

    return obstacles;
}


// ================================
// GET ROADS
// ================================
export async function getRoads() {
    const res = await fetch(`${API_URL}/getRoads`);
    const data = await res.json();

    roads.length = 0;

    for (let r of data.positions) {
        roads.push({
            id: r.id,
            position: { x: r.x, y: r.y, z: r.z },
            direction: r.direction
        });
    }

    return roads;
}


// ================================
// GET DESTINATIONS
// ================================
export async function getDestinations() {
    const res = await fetch(`${API_URL}/getDestinations`);
    const data = await res.json();

    destinations.length = 0;

    for (let d of data.positions) {
        destinations.push({
            id: d.id,
            position: { x: d.x, y: d.y, z: d.z }
        });
    }

    return destinations;
}


// ================================
// GET TRAFFIC LIGHTS
// ================================
export async function getTrafficLights() {
    const res = await fetch(`${API_URL}/getTrafficLights`);
    const data = await res.json();

    trafficLights.length = 0;

    for (let tl of data.positions) {
        trafficLights.push({
            id: tl.id,
            position: { x: tl.x, y: tl.y, z: tl.z },
            state: tl.state,
            direction: tl.direction
        });
    }

    return trafficLights;
}


// ================================
// UPDATE MODEL
// ================================
export async function update() {
    await fetch(`${API_URL}/update`);

    // Después de actualizar: traer nuevas posiciones
    await getAgents();
    await getTrafficLights();
}
