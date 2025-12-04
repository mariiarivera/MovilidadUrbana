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

        # Load map
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

            # Parse map - SINGLE PASS with explicit road creation for traffic lights
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
                        # Traffic lights MUST have roads - use simple heuristic
                        # Look at neighbors to determine direction
                        direction = None
                        
                        # Priority 1: Check left for >
                        if c > 0 and row_str[c-1] == '>':
                            direction = "Right"
                        # Priority 2: Check right for <
                        elif c < len(row_str) - 1 and row_str[c+1] == '>':
                            direction = "Right"
                        # Priority 3: Check above for v
                        elif r > 0 and c < len(lines[r-1].strip()) and lines[r-1].strip()[c] == 'v':
                            direction = "Down"
                        # Priority 4: Check below for ^
                        elif r < len(lines) - 1 and c < len(lines[r+1].strip()) and lines[r+1].strip()[c] == '^':
                            direction = "Up"
                        # Default: Right
                        else:
                            direction = "Right"
                        
                        # CREATE ROAD FIRST - this is critical!
                        road = Road(self, cell, direction)
                        cell.agents.append(road)
                        print(f"   Created road at TL {pos} with direction {direction}")
                        
                        # Then traffic light
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

        print(f"📏 Map loaded: {self.width}x{self.height}")
        print(f"🎯 Destinations: {len(self.destinations)} found")
        print(f"🚦 Traffic lights: {len(self.traffic_lights)} found")
        
        # Verify traffic lights have roads
        tl_without_roads = 0
        for tl in self.traffic_lights:
            has_road = any(isinstance(a, Road) for a in tl.cell.agents)
            if not has_road:
                tl_without_roads += 1
                print(f"   ⚠️  Traffic light at {tl.cell.coordinate} has NO ROAD!")
        
        if tl_without_roads == 0:
            print(f"   ✅ All traffic lights have roads underneath")
        
        # Define corners
        self.corners = [
            (0, 0),
            (self.width - 1, 0),
            (0, self.height - 1),
            (self.width - 1, self.height - 1)
        ]
        
        print(f"📍 Corners: {self.corners}")
        
        # Verify corners
        for corner in self.corners:
            cell = self.grid[corner]
            road = next((a for a in cell.agents if isinstance(a, Road)), None)
            if road:
                print(f"   Corner {corner}: {road.direction}")

        self.running = True

    def spawnCars(self):
        """Spawn one car at each corner (if possible)."""
        print(f"\n🚗 Spawning cars at step {self.steps}")
        
        if not self.destinations:
            print("⚠️  No destinations available!")
            return
        
        spawned = 0
        
        for corner in self.corners:
            cell = self.grid[corner]
            
            # Skip if corner already has a car
            if any(isinstance(a, Car) for a in cell.agents):
                continue
            
            # Check if corner has a road
            has_road = any(isinstance(a, Road) for a in cell.agents)
            if not has_road:
                print(f"   ⚠️  Corner {corner} has no road")
                continue
            
            # Try MULTIPLE random destinations until we find one that works
            shuffled_dests = self.destinations.copy()
            self.random_gen.shuffle(shuffled_dests)
            
            car_created = False
            for dest in shuffled_dests:
                # Create car with this destination
                self.car_counter += 1
                car = Car(self, cell, unique_id=self.car_counter, dest=dest.cell)
                
                # If path was found, add the car
                if car.path:
                    cell.agents.append(car)
                    self._agents[car.unique_id] = car
                    spawned += 1
                    print(f"   ✅ Car {car.unique_id} at {corner} → {dest.cell.coordinate}")
                    car_created = True
                    break  # Found a valid destination, stop trying
            
            if not car_created:
                print(f"   ❌ No reachable destination from {corner}")
        
        print(f"   Total spawned: {spawned}/{len(self.corners)}")

    def step(self):
        """Advance the model by one step."""
        
        # Spawn cars every 10 steps
        if self.steps % 10 == 0:
            self.spawnCars()
        
        # Update all agents
        self.agents.shuffle_do("step")
        
        # Remove cars that reached their destination
        to_remove = []
        for agent in list(self._agents.values()):
            if isinstance(agent, Car):
                if agent.cell.coordinate == agent.dest.coordinate:
                    to_remove.append(agent)
        
        for car in to_remove:
            self._agents.pop(car.unique_id)
            if car in car.cell.agents:
                car.cell.agents.remove(car)
            print(f"   🎯 Car {car.unique_id} reached destination!")