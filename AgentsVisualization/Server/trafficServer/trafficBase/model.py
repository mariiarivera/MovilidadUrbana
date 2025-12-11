# Model.py 

from mesa import Model
from mesa.discrete_space import OrthogonalMooreGrid
import json
import random
from mesa.datacollection import DataCollector
from .agent import Road, Traffic_Light, Destination, Obstacle, Car


class CityModel(Model):
    """Creates a model based on a city map."""
    
    def __init__(self, N, seed=42, spawn_rate=1):
        super().__init__(seed=seed)

        self.random_gen = random.Random(seed)
        self.num_agents = N
        self.spawn_rate = spawn_rate            # ← cada cuántos steps salen carros
        self.spawn_counter = 0                  # ← contador interno
        self.traffic_lights = []
        self.destinations = []
        self.car_counter = 0
        self.total_spawned = 0
        self.total_arrived = 0

        dataDictionary = json.load(open("city_files/mapDictionary.json"))

        with open("city_files/2025_base.txt") as baseFile:
            lines = baseFile.readlines()
            self.width = len(lines[0].strip())
            self.height = len(lines)
            
            self.grid = OrthogonalMooreGrid(
                [self.width, self.height],
                capacity=100,
                torus=False,
                random=self.random_gen
            )

            # Parse map
            for r, row in enumerate(lines):
                row_str = row.strip()
                for c, col in enumerate(row_str):
                    pos = (c, self.height - r - 1)
                    cell = self.grid[pos]

                    if col in [">", "<", "v", "^"]:
                        direction = dataDictionary[col]
                        road = Road(self, cell, direction)
                        cell.agents.append(road)

                    elif col in ["S", "s"]:
                        direction = "Right"
                        if c > 0 and row_str[c-1] in ['>', 's', 'S']:
                            direction = "Right"
                        elif c < len(row_str) - 1 and row_str[c+1] in ['>', 's', 'S']:
                            direction = "Right"
                        elif r > 0 and c < len(lines[r-1].strip()) and lines[r-1].strip()[c] == 'v':
                            direction = "Down"
                        elif r < len(lines) - 1 and c < len(lines[r+1].strip()) and lines[r+1].strip()[c] == '^':
                            direction = "Up"
                        
                        road = Road(self, cell, direction)
                        cell.agents.append(road)
                        
                        state = False if col == "S" else True
                        timeToChange = dataDictionary[col]
                        tl = Traffic_Light(self, cell, state, timeToChange)
                        cell.agents.append(tl)
                        self.traffic_lights.append(tl)

                    elif col == "#":
                        obs = Obstacle(self, cell)
                        cell.agents.append(obs)

                    elif col == "D":
                        dest = Destination(self, cell)
                        cell.agents.append(dest)
                        self.destinations.append(dest)

        
        self.corners = [
            (0, 0),
            (self.width - 1, 0),
            (0, self.height - 1),
            (self.width - 1, self.height - 1)
        ]

        # Spawn inicial
        self.spawnCars()

        # ---------------------------------------------------
        #       DATA COLLECTOR
        # ---------------------------------------------------
        self.datacollector = DataCollector(
            model_reporters={
                "Cars_in_model": lambda m: len([a for a in m.agents if isinstance(a, Car)]),
                "Cars_spawned": lambda m: m.total_spawned,
                "Cars_arrived": lambda m: m.total_arrived,
            }
        )

        self.datacollector.collect(self)
        self.running = True


    # -------------------------------------------------------
    # SPAWN
    # -------------------------------------------------------
    def spawnCars(self):
        """Spawn cars at corners."""
        if not self.destinations:
            return
        
        available_corners = self.corners.copy()
        self.random_gen.shuffle(available_corners)
        
        for corner in available_corners:
            cell = self.grid[corner]
            
            if any(isinstance(a, Car) for a in cell.agents):
                continue
            
            if not any(isinstance(a, Road) for a in cell.agents):
                continue
            
            shuffled = self.destinations.copy()
            self.random_gen.shuffle(shuffled)
            
            for dest in shuffled:
                self.car_counter += 1
                car = Car(self, cell, unique_id=self.car_counter, dest=dest)
                
                if car.path:
                    cell.agents.append(car)
                    self.agents.add(car)
                    self.total_spawned += 1
                    break


    # -------------------------------------------------------
    # STEP
    # -------------------------------------------------------
    def step(self):

        # Control de spawn según spawn_rate
        if self.spawn_counter % self.spawn_rate == 0:
            self.spawnCars()

        self.spawn_counter += 1

        # Avanzar agentes
        self.agents.shuffle_do("step")

        # Eliminar agentes que llegaron
        cars_to_remove = [
            agent for agent in list(self.agents)
            if isinstance(agent, Car) and hasattr(agent, '_should_remove')
        ]
        
        for car in cars_to_remove:
            if car.cell and car in car.cell.agents:
                car.cell.agents.remove(car)
            self.agents.remove(car)

        # Registrar datos
        self.datacollector.collect(self)
