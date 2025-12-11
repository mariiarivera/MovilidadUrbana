"""
Solara server for the traffic simulation model.
Adaptado para mostrar:
 - Carros activos
 - Carros spawnados
 - Carros que llegan al destino
"""

from trafficBase.agent import *
from trafficBase.model import CityModel

from mesa.visualization import (
    Slider,
    CommandConsole,
    SolaraViz,
    make_space_component,
    make_plot_component,
)

from mesa.visualization.components import AgentPortrayalStyle
import solara


# -------------------------------------------------------------------
# PORTRAYAL
# -------------------------------------------------------------------
def agent_portrayal(agent):

    if agent is None:
        return

    portrayal = AgentPortrayalStyle(marker="o")

    if isinstance(agent, Road):
        portrayal.color = "white"
        portrayal.marker = "s"

    elif isinstance(agent, Traffic_Light):
        portrayal.color = "green" if agent.is_green else "red"

    elif isinstance(agent, Destination):
        portrayal.color = "yellow"
        portrayal.marker = "D"

    elif isinstance(agent, Obstacle):
        portrayal.color = "gray"
        portrayal.marker = "s"

    elif isinstance(agent, Car):
        portrayal.color = "blue"

    return portrayal


# -------------------------------------------------------------------
# PARAMETROS DEL MODELO
# -------------------------------------------------------------------
model_params = {
    "N": Slider("Max Cars", 10, 1, 50),
    "seed": {
        "type": "InputText",
        "value": 42,
        "label": "Seed",
    },
}


# Crear modelo
model = CityModel(
    N=model_params["N"].value,
    seed=model_params["seed"]["value"],
    spawn_rate=10,     # ← cada cuántos steps spawnean
)



# -------------------------------------------------------------------
# AJUSTES VISUALES
# -------------------------------------------------------------------
def post_process(ax):
    ax.set_aspect("equal")


# -------------------------------------------------------------------
# TRES GRÁFICAS SEPARADAS
# -------------------------------------------------------------------

# 1. Carros activos en el modelo
cars_active_component = make_plot_component(
    {"Cars_in_model": "tab:blue"}
)

# 2. Carros totales spawneados
cars_spawned_component = make_plot_component(
    {"Cars_spawned": "tab:orange"}
)

# 3. Carros que llegaron al destino
cars_arrived_component = make_plot_component(
    {"Cars_arrived": "tab:green"}
)


# -------------------------------------------------------------------
# GRID VISUALIZATION
# -------------------------------------------------------------------
space_component = make_space_component(
    agent_portrayal,
    draw_grid=True,
    post_process=post_process,
)


# -------------------------------------------------------------------
# SOLARA PAGE
# -------------------------------------------------------------------
page = SolaraViz(
    model,
    components=[
        CommandConsole,
        space_component,
        cars_active_component,
        cars_spawned_component,
        cars_arrived_component
    ],
    model_params=model_params,
    name="City Traffic Simulation",
)
