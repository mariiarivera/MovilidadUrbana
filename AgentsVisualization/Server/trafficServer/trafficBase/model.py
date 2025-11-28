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

        # Load the map dictionary. The dictionary maps the characters in the map file to the corresponding agent.
        dataDictionary = json.load(open("city_files/mapDictionary.json"))

        self.num_agents = N
        self.cars = []
        self.traffic_lights = []
        self.buildings = []
        self.spawnSteps = 5  # Steps between spawning new cars

        self.grid = None

        # Load the map file. The map file is a text file where each character represents an agent.
        with open("city_files/2022_base.txt") as baseFile:
            lines = baseFile.readlines()
            self.width = len(lines[0])
            self.height = len(lines)

            self.grid = OrthogonalMooreGrid(
                [self.width, self.height], capacity=100, torus=False
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
        
        corner_index = self.random.randint(0, 3)
        corner_coords = corners[corner_index]
        #corner_names = ["Top-Left", "Top-Right", "Bottom-Left", "Bottom-Right"]
        
        #print(f"Attempting to spawn car in {corner_names[corner_index]} corner")
        
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
               # print(f"Error checking cell {coord}: {e}")
                continue
        
        if empty_roads:
            
            
            car = Car(self, self.random.choice(empty_roads))
            #print(f"Car {car.unique_id} spawned at {corner_names[corner_index]} corner position: {spawn_cell.coordinate}")
            #print(f"Car {car.unique_id} assigned destination: {destination_cell.coordinate}")
        #else:
         #   if not self.destinations:
               # print(f"No destinations available in the map!")
          #  else:
                #print(f"No available spawn points in {corner_names[corner_index]} corner")

    def step(self):
        """Advance the model by one step."""
        if self.steps == 0 or self.steps == 1: 
            self.spawnCars() # porque por alguna razón no pone nada en step 0
        if self.steps % self.spawnSteps == 0:
            self.spawnCars()
       # print(f"\n--- Step {self.steps} - Total agents: {len(self.agents)} ---")
        cars = [a for a in self.agents if isinstance(a, Car)]
        #print(f"Active cars: {len(cars)}")
        
        self.agents.shuffle_do("step")
