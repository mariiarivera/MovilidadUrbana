# TC2008B. Sistemas Multiagentes y Gráficas Computacionales
# Python flask server to interact with WebGL.
# Octavio Navarro. 2024

from flask import Flask, request, jsonify
from flask_cors import CORS, cross_origin
from trafficBase.model import CityModel
from trafficBase.agent import Car, Agent, Traffic_Light, Destination, Obstacle, Road, SideWalk

# Simulation parameters
number_agents = 10
width = 28
height = 28

# IMPORTANT: instance variable, not the class itself
cityModel = None
currentStep = 0

# Flask application
app = Flask("Traffic example")
cors = CORS(app, origins=['http://localhost'])


@app.route('/init', methods=['POST'])
@cross_origin()
def initModel():
    global currentStep, cityModel, number_agents, width, height

    try:
        number_agents = int(request.json.get('NAgents'))
        width = int(request.json.get('width'))
        height = int(request.json.get('height'))
        currentStep = 0
    except Exception as e:
        print(e)
        return jsonify({"message": "Error initializing the model"}), 500

    print(f"Model parameters: {number_agents, width, height}")

    # Create the model instance
    cityModel = CityModel(number_agents, seed=42)

    return jsonify({
        "message": f"Parameters received. Model initiated. Size: {width}x{height}"
    })

@app.route('/getAgents', methods=['GET'])
@cross_origin()
def getAgents():
    global cityModel
    try:
        agentCells = cityModel.grid.all_cells.select(
            lambda cell: any(isinstance(obj, Car) for obj in cell.agents)
        ).cells

        agents = [
            (cell.coordinate, agent)
            for cell in agentCells
            for agent in cell.agents
            if isinstance(agent, Car)
        ]

        # print(agentCells)

        positions = [
            {"id": str(a.unique_id), "x": c[0], "y": 1, "z": c[1]}
            for (c, a) in agents
        ]

        return jsonify({'positions': positions})

    except Exception as e:
        print(e)
        return jsonify({"message": "Error with the agent positions"}), 500


@app.route('/getObstacles', methods=['GET'])
@cross_origin()
def getObstacles():
    global cityModel
    try:
        cells = cityModel.grid.all_cells.select(
            lambda cell: any(isinstance(obj, Obstacle) for obj in cell.agents)
        ).cells

        agents = [
            (cell.coordinate, agent)
            for cell in cells
            for agent in cell.agents
            if isinstance(agent, Obstacle)
        ]

        positions = [
            {"id": str(a.unique_id), "x": c[0], "y": 1, "z": c[1]}
            for (c, a) in agents
        ]

        return jsonify({'positions': positions})

    except Exception as e:
        print(e)
        return jsonify({"message": "Error with obstacle positions"}), 500

@app.route('/getTrafficLights', methods=['GET'])
@cross_origin()
def getTrafficLights():
    global cityModel
    try:
        cells = cityModel.grid.all_cells.select(
            lambda cell: any(isinstance(obj, Traffic_Light) for obj in cell.agents)
        ).cells

        agents = [
            (cell.coordinate, agent)
            for cell in cells
            for agent in cell.agents
            if isinstance(agent, Traffic_Light)
        ]

        positions = [
            {"id": str(a.unique_id), "x": c[0], "y": 1, "z": c[1]}
            for (c, a) in agents
        ]

        return jsonify({'positions': positions})

    except Exception as e:
        print(e)
        return jsonify({"message": "Error with traffic light positions"}), 500

@app.route('/getRoad', methods=['GET'])
@cross_origin()
def getRoad():
    global cityModel
    try:
        cells = cityModel.grid.all_cells.select(
            lambda cell: any(isinstance(obj, Road) for obj in cell.agents)
        ).cells

        agents = [
            (cell.coordinate, agent)
            for cell in cells
            for agent in cell.agents
            if isinstance(agent, Road)
        ]

        positions = [
            {"id": str(a.unique_id), "x": c[0], "y": 1, "z": c[1]}
            for (c, a) in agents
        ]

        return jsonify({'positions': positions})

    except Exception as e:
        print(e)
        return jsonify({"message": "Error with road positions"}), 500

@app.route('/getDestination', methods=['GET'])
@cross_origin()
def getDestination():
    global cityModel
    try:
        cells = cityModel.grid.all_cells.select(
            lambda cell: any(isinstance(obj, Destination) for obj in cell.agents)
        ).cells

        agents = [
            (cell.coordinate, agent)
            for cell in cells
            for agent in cell.agents
            if isinstance(agent, Destination)
        ]

        positions = [
            {"id": str(a.unique_id), "x": c[0], "y": 1, "z": c[1]}
            for (c, a) in agents
        ]

        return jsonify({'positions': positions})

    except Exception as e:
        print(e)
        return jsonify({"message": "Error with destination positions"}), 500
    
@app.route('/getSideWalks', methods=['GET'])
@cross_origin()
def getSideWalks():
    global cityModel
    try:
        cells = cityModel.grid.all_cells.select(
            lambda cell: any(isinstance(obj, SideWalk) for obj in cell.agents)
        ).cells

        agents = [
            (cell.coordinate, agent)
            for cell in cells
            for agent in cell.agents
            if isinstance(agent, SideWalk)
        ]

        positions = [
            {"id": str(a.unique_id), "x": c[0], "y": 1, "z": c[1]}
            for (c, a) in agents
        ]

        return jsonify({'positions': positions})

    except Exception as e:
        print(e)
        return jsonify({"message": "Error with road positions"}), 500

@app.route('/update', methods=['GET'])
@cross_origin()
def updateModel():
    global currentStep, cityModel
    try:
        cityModel.step()
        currentStep += 1
        return jsonify({
            'message': f'Model updated to step {currentStep}.',
            'currentStep': currentStep
        })
    except Exception as e:
        print(e)
        return jsonify({"message": "Error during model update"}), 500

    
if __name__ == '__main__':
    app.run(host="localhost", port=8585, debug=True)
