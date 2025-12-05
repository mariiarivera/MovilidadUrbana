from trafficBase.agent import *
from trafficBase.model import CityModel
from mesa.visualization import CommandConsole, Slider, SolaraViz, SpaceRenderer, make_space_component, make_plot_component
from mesa.visualization.components import AgentPortrayalStyle
import matplotlib.pyplot as plt

# Definición de la representación visual de los agentes (simulación)
def random_portrayal(agent):
    """Defines how each agent is portrayed visually."""
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

    return portrayal

def plot_simulation(model):
    """Generates the simulation grid."""
    renderer = SpaceRenderer(
        model,
        backend="matplotlib",
    )
    renderer.draw_agents(random_portrayal)
    plt.title("Simulation of the City Model")
    plt.show()

def plot_cars_in_simulation(model):
    """Generates the 'Cars in Simulation' bar chart."""
    model_data = model.datacollector.get_model_vars_dataframe()
    
    if "Cars_in_model" in model_data.columns:
        cars_in_model = model_data["Cars_in_model"]
        plt.figure()
        plt.bar(range(len(cars_in_model)), cars_in_model, color='blue')
        plt.xlabel("Steps")
        plt.ylabel("Number of Cars")
        plt.title("Number of Cars in Simulation")
        plt.show()

def plot_cars_arrived(model):
    """Generates the 'Cars Arrived' bar chart."""
    model_data = model.datacollector.get_model_vars_dataframe()
    
    if "Cars_arrived" in model_data.columns:
        cars_arrived = model_data["Cars_arrived"]
        
        # Graficar el número de autos que han llegado en cada paso
        plt.figure()
        plt.bar(range(len(cars_arrived)), cars_arrived, color='green')
        plt.xlabel("Steps")
        plt.ylabel("Number of Cars Arrived")
        plt.title("Number of Cars that Arrived at Destination")
        plt.show()


# Model parameters for simulation
model_params = {
    "seed": {
        "type": "InputText",
        "value": 42,
        "label": "Random Seed",
    },
    "N": Slider("Number of agents", 10, 1, 50),
}

# Create the CityModel
model = CityModel(
    N=model_params["N"].value,
    seed=model_params["seed"]["value"]
)

# Show the simulation
plot_simulation(model)

# Generate the graph for cars in simulation
plot_cars_in_simulation(model)

# Generate the graph for cars that arrived
plot_cars_arrived(model)

# Create the Solara app to display the simulation
page = SolaraViz(
    model,
    components=[
        make_space_component(
            random_portrayal,
            draw_grid=True,  # Allows visualizing the grid cells
            post_process=lambda ax: ax.set_aspect("equal")
        ),
        make_plot_component({"Cars_in_model": "blue"}),
        make_plot_component({"Cars_arrived": "green"})
    ],
    model_params=model_params,
    name="City Model Simulation",
)
