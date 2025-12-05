#Model.py 

from mesa import Model
from mesa.discrete_space import OrthogonalMooreGrid
import json
import random
from .agent import Road, Traffic_Light, Destination, Obstacle, Car

class CityModel(Model):
    """Creates a model based on a city map."""
    
    def __init__(self, N, seed=42):
        super().__init__(seed=seed)

        self.random_gen = random.Random(seed)
        self.num_agents = N
        self.traffic_lights = []
        self.destinations = []
        self.car_counter = 0
        self.total_spawned = 0  # Track total cars spawned

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

        # FIX: Spawn initial cars immediately
        self.spawnCars()
        
        self.running = True

    def spawnCars(self):
        """Spawn cars at corners with reachable destinations."""
        # FIX: Reduce console spam
        
        if not self.destinations:
            return
        
        spawned = 0
        
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
                    spawned += 1
                    self.total_spawned += 1
                    break
        
    def step(self):
        """Advance model by one step."""
        self.spawnCars()
        self.agents.shuffle_do("step")
        
        cars_to_remove = [agent for agent in list(self.agents) 
                         if isinstance(agent, Car) and hasattr(agent, '_should_remove')]
        
        for car in cars_to_remove:
            if car.cell and car in car.cell.agents:
                car.cell.agents.remove(car)
            self.agents.remove(car)