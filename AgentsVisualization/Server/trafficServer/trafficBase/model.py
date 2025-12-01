from mesa import Model
from mesa.discrete_space import OrthogonalMooreGrid
from .agent import *
import json
import random

class CityModel(Model):
    """
    Creates a model based on a city map.

    Args:
        N: Number of agents in the simulation
        seed: Random seed for the model
    """

    def __init__(self, N, seed=42):

        super().__init__(seed=seed)

        # Crea un generador de números aleatorios explícitamente
        self.random_gen = random.Random(seed)  # Usamos el `seed` para la reproducibilidad

        # Load the map dictionary. The dictionary maps the characters in the map file to the corresponding agent.
        dataDictionary = json.load(open("city_files/mapDictionary.json"))

        self.num_agents = N
        self.traffic_lights = []
        self.destinations = []
        self.spawnSteps = 10  # default spawn steps, can be customized

        # SuperMetricas (metrics to track simulation progress)
        self.carCounter = 0
        self.totCarsSpawned = 0
        self.totCarsArrived = 0
        self.totStepsTaken = 0
        self.totSemaforosFound = 0
        self.carsEnTrafico = 0
        self.embotellamientos = 0

        # Load the map file. The map file is a text file where each character represents an agent.
        with open("city_files/2022_base.txt") as baseFile:
            lines = baseFile.readlines()
            self.width = len(lines[0])
            self.height = len(lines)

            # Crear la cuadrícula de la simulación, pasando `self.random_gen` como generador de números aleatorios
            self.grid = OrthogonalMooreGrid(
                [self.width, self.height], capacity=100, torus=False, random=self.random_gen
            )

            # Goes through each character in the map file and creates the corresponding agent.
            for r, row in enumerate(lines):
                for c, col in enumerate(row):

                    cell = self.grid[(c, self.height - r - 1)]

                    if col in ["v", "^", ">", "<"]:
                        agent = Road(self, cell, dataDictionary[col])

                    elif col in ["S", "s"]:
                        agent = Traffic_Light(
                            self,
                            cell,
                            False if col == "S" else True,
                            int(dataDictionary[col]),
                        )
                        self.traffic_lights.append(agent)

                    elif col == "#":
                        agent = Obstacle(self, cell)

                    elif col == "D":
                        agent = Destination(self, cell)
                        self.destinations.append(agent)

        self.running = True

    def spawnCars(self): 
        """Spawn a new car at a random corner of the map with a random destination"""
        
        corner_size = 1 
        corners = [
            # Top-left 
            [(x, y) for x in range(corner_size) for y in range(self.height - corner_size, self.height)],
            # Top-right
            [(x, y) for x in range(self.width - corner_size, self.width) for y in range(self.height - corner_size, self.height)],
            # Bottom-left
            [(x, y) for x in range(corner_size) for y in range(corner_size)],
            # Bottom-right
            [(x, y) for x in range(self.width - corner_size, self.width) for y in range(corner_size)]
        ]

        corner_index = self.random_gen.randint(0, 3)
        corner_coords = corners[corner_index]

        empty_roads = []
        for coord in corner_coords:
            try:
                if coord[0] >= self.width or coord[1] >= self.height or coord[0] < 0 or coord[1] < 0:
                    continue
                cell = self.grid[coord]
                has_road = any(isinstance(obj, Road) for obj in cell.agents)
                has_car = any(isinstance(obj, Car) for obj in cell.agents)    
                if has_road and not has_car:
                    empty_roads.append(cell)
            except Exception as e:
                continue

        if empty_roads and self.destinations:
            spawn_cell = self.random_gen.choice(empty_roads)
            random_destination_agent = self.random_gen.choice(self.destinations)
            destination_cell = random_destination_agent.cell  

            car = Car(self, spawn_cell, self.carCounter, dest=destination_cell)
            self.carCounter += 1
            self.totCarsSpawned += 1

            # Asegúrate de que spawn_cell esté definido
            x, y = spawn_cell.coordinate
            self.grid[(x, y)].agents.append(car)

            # REGISTRARLO para que Mesa lo use en step()
            self._agents[car.unique_id] = car



    def step(self):
        """Advance the model by one step."""
        if self.steps == 0 or self.steps == 1: 
            self.spawnCars()  # because for some reason it doesn't spawn at step 0
        if self.steps % self.spawnSteps == 0:
            self.spawnCars()

        cars = [a for a in self.agents if isinstance(a, Car)]
        
        self.agents.shuffle_do("step")
