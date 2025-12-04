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

        dataDictionary = json.load(open("city_files/mapDictionary.json"))

        with open("city_files/2022_base.txt") as baseFile:
            lines = baseFile.readlines()
            self.width = len(lines[0].strip())
            self.height = len(lines)
            
            self.grid = OrthogonalMooreGrid(
                [self.width, self.height],
                capacity=100,
                torus=False,
                random=self.random_gen
            )

            # Parse map - single pass, create roads for traffic lights
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
                        # Infer direction
                        direction = "Right"
                        if c > 0 and row_str[c-1] in ['>', 's', 'S']:
                            direction = "Right"
                        elif c < len(row_str) - 1 and row_str[c+1] in ['>', 's', 'S']:
                            direction = "Right"
                        elif r > 0 and c < len(lines[r-1].strip()) and lines[r-1].strip()[c] == 'v':
                            direction = "Down"
                        elif r < len(lines) - 1 and c < len(lines[r+1].strip()) and lines[r+1].strip()[c] == '^':
                            direction = "Up"
                        
                        # Create road
                        road = Road(self, cell, direction)
                        cell.agents.append(road)
                        
                        # Create traffic light
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

        print(f"📏 Map: {self.width}x{self.height}")
        print(f"🎯 Destinations: {len(self.destinations)}")
        print(f"🚦 Traffic lights: {len(self.traffic_lights)}")
        
        self.corners = [
            (0, 0),
            (self.width - 1, 0),
            (0, self.height - 1),
            (self.width - 1, self.height - 1)
        ]

        self.running = True

    def spawnCars(self):
        """Spawn cars at corners with reachable destinations."""
        print(f"\n🚗 Spawning at step {self.steps}")
        
        if not self.destinations:
            return
        
        spawned = 0
        
        for corner in self.corners:
            cell = self.grid[corner]
            
            if any(isinstance(a, Car) for a in cell.agents):
                continue
            
            if not any(isinstance(a, Road) for a in cell.agents):
                continue
            
            # Try all destinations shuffled
            shuffled = self.destinations.copy()
            self.random_gen.shuffle(shuffled)
            
            for dest in shuffled:
                self.car_counter += 1
                car = Car(self, cell, unique_id=self.car_counter, dest=dest.cell)
                
                if car.path:
                    cell.agents.append(car)
                    self._agents[car.unique_id] = car
                    spawned += 1
                    print(f"   ✅ Car {car.unique_id} at {corner} → {dest.cell.coordinate}")
                    break
        
        print(f"   Spawned: {spawned}/{len(self.corners)}")

    def step(self):
        """Advance model by one step."""
        if self.steps % 10 == 0:
            self.spawnCars()
        
        # Update all agents
        self.agents.shuffle_do("step")
        
        # Clean up cars marked for removal AFTER shuffle_do completes
        cars_to_remove = [agent for agent in list(self.agents) 
                         if isinstance(agent, Car) and hasattr(agent, '_should_remove')]
        
        for car in cars_to_remove:
            # Double-check car is removed from grid cell
            if car.cell and car in car.cell.agents:
                car.cell.agents.remove(car)
            
            # Remove from _agents dict
            self._agents.pop(car.unique_id, None)
            
            # Remove from agents AgentSet
            try:
                self.agents.remove(car)
            except:
                pass  # Already removed
        
        if cars_to_remove:
            print(f"   🧹 Cleaned up {len(cars_to_remove)} cars")