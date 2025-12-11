# visualization.py
from mesa.visualization import Slider, SolaraViz, make_space_component, make_plot_component
from mesa.visualization.components import AgentPortrayalStyle
from trafficBase.model import CityModel
from trafficBase.agent import Car, Road, Traffic_Light, Destination, Obstacle

# Definición de la apariencia de los agentes
def city_portrayal(agent):
    if agent is None:
        return None
    portrayal = AgentPortrayalStyle(size=50, marker="o")
    
    if isinstance(agent, Car):
        portrayal.color = "blue"
    elif isinstance(agent, Obstacle):
        portrayal.color = "gray"
        portrayal.marker = "s"
        portrayal.size = 100
    elif isinstance(agent, Traffic_Light):
        portrayal.color = "green" if agent.is_green else "red"
        portrayal.marker = "o"
        portrayal.size = 50
    elif isinstance(agent, Road):
        portrayal.color = "white"
        portrayal.marker = "s"
        portrayal.size = 50
    elif isinstance(agent, Destination):
        portrayal.color = "yellow"
        portrayal.marker = "D"
        portrayal.size = 50

    return portrayal

def post_process(ax):
    ax.set_aspect("equal")

# Parámetros del modelo
model_params = {
    "seed": {"type": "InputText", "value": 42, "label": "Random Seed"},
    "N": Slider("Number of cars", 10, 1, 50),
}

# Crear instancia del modelo
NUM_STEPS = 300
model = CityModel(N=model_params["N"].value, seed=model_params["seed"]["value"])

# Componentes de visualización
space_component = make_space_component(
    city_portrayal,
    draw_grid=True,
    post_process=post_process
)

cars_plot = make_plot_component({"Cars_in_model": "blue"})
arrived_plot = make_plot_component({"Cars_arrived": "green"})
spawned_plot = make_plot_component({"Total_spawned": "orange"})

# Página SolaraViz
page = SolaraViz(
    model,
    components=[space_component, cars_plot, arrived_plot, spawned_plot],
    model_params=model_params,
    name="City Traffic Simulation"
)
