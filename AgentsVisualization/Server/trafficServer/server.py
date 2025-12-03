from trafficBase.agent import *
from trafficBase.model import CityModel
from mesa.visualization import (
    CommandConsole,
    Slider,
    SolaraViz,
    SpaceRenderer,
)
from mesa.visualization.components import AgentPortrayalStyle


def random_portrayal(agent):
    if agent is None:
        return None

    portrayal = AgentPortrayalStyle(
        size=50,
        marker="o",
        zorder=2,
    )

    if isinstance(agent, Car):
        portrayal.color = "blue"
        portrayal.size = 50
        portrayal.marker = "o"
        portrayal.zorder = 2

    elif isinstance(agent, Obstacle):
        portrayal.color = "gray"
        portrayal.marker = "s"
        portrayal.size = 125
        portrayal.zorder = 1

    elif isinstance(agent, Traffic_Light):
        portrayal.color = "green" if agent.is_green else "red"
        portrayal.size = 50
        portrayal.marker = "o"
        portrayal.zorder = 3

    elif isinstance(agent, Road):
        portrayal.color = "white"
        portrayal.size = 50
        portrayal.marker = "s"
        portrayal.zorder = 0

    elif isinstance(agent, Destination):
        portrayal.color = "yellow"
        portrayal.size = 50
        portrayal.marker = "D"
        portrayal.zorder = 2

    else:
        # fallback for any other agent
        portrayal.color = "black"
        portrayal.size = 25
        portrayal.marker = "o"
        portrayal.zorder = 2

    return portrayal

model_params = {
    "seed": {
        "type": "InputText",
        "value": 42,
        "label": "Random Seed",
    },
    "num_agents": Slider("Number of agents", 10, 1, 50),
}


# Create the model using the initial parameters from the settings
model = CityModel(
    num_agents=model_params["num_agents"].value,
    seed=model_params["seed"]["value"]
)

renderer = SpaceRenderer(
    model,
    backend="matplotlib",
)
renderer.draw_agents(random_portrayal)

page = SolaraViz(
    model,
    renderer,
    components=[CommandConsole],
    model_params=model_params,
    name="Random Model",
)