from mesa import Model
from mesa.discrete_space import OrthogonalMooreGrid
from .agent import *
import json

class CityModel(Model):
    """
    Creates a model based on a city map.
    """

    def __init__(self, N, seed=42):

        super().__init__(seed=seed)

        # Load the map dictionary
        dataDictionary = json.load(open("city_files/mapDictionary.json"))

        self.num_agents = N
        self.traffic_lights = []
        self.steps = 0

        # Load the map file
        with open("city_files/2022_base.txt") as baseFile:
            lines = [line.rstrip("\n") for line in baseFile]
            self.width = len(lines[0])
            self.height = len(lines)

            self.grid = OrthogonalMooreGrid(
                self.width,
                self.height,
                torus=False
            )

            # Crear agentes del mapa
            for r, row in enumerate(lines):
                for c, col in enumerate(row):

                    pos = (c, self.height - r - 1)
                    cell = self.grid[pos]

                    if col in ["v", "^", ">", "<"]:
                        agent = Road(self, cell, dataDictionary[col])
                        self.grid.place_agent(agent, pos)

                    elif col in ["S", "s"]:
                        agent = Traffic_Light(
                            self,
                            cell,
                            False if col == "S" else True,
                            int(dataDictionary[col]),
                        )
                        self.grid.place_agent(agent, pos)
                        self.traffic_lights.append(agent)

                    elif col == "#":
                        agent = Obstacle(self, cell)
                        self.grid.place_agent(agent, pos)

                    elif col == "D":
                        agent = Destination(self, cell)
                        self.grid.place_agent(agent, pos)

        # crear carros en el road 
        road_cells = []

        for x in range(self.width):
            for y in range(self.height):
                cell = self.grid[(x, y)]
                if any(isinstance(a, Road) for a in cell.agents):
                    road_cells.append((x, y))

        for i in range(self.num_agents):
            pos = self.random.choice(road_cells)
            new_car = Car(self)         
            self.grid.place_agent(new_car, pos)

        self.running = True

    def step(self):
        """Advance the model by one step."""
        self.steps += 1
        self.agents.shuffle_do("step")
