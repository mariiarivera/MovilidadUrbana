from mesa.discrete_space import CellAgent, FixedAgent
import heapq


class Road(FixedAgent):
    """Road cell with allowed movement direction."""
    def __init__(self, model, cell, direction="Left"):
        super().__init__(model)
        self.cell = cell
        self.direction = direction


class Traffic_Light(FixedAgent):
    """Traffic light."""
    def __init__(self, model, cell, state=False, timeToChange=10):
        super().__init__(model)
        self.cell = cell
        self.state = state
        self.timeToChange = timeToChange

    def step(self):
        if self.model.steps % self.timeToChange == 0:
            self.state = not self.state

    @property
    def is_green(self):
        return self.state


class Destination(FixedAgent):
    """Destination agent."""
    def __init__(self, model, cell):
        super().__init__(model)
        self.cell = cell


class Obstacle(FixedAgent):
    """Obstacle agent."""
    def __init__(self, model, cell):
        super().__init__(model)
        self.cell = cell


class Car(CellAgent):
    """Car agent using A* pathfinding adapted from your original code."""
    
    def __init__(self, model, cell, unique_id=None, dest=None):
        super().__init__(model)
        self.cell = cell
        self.unique_id = unique_id
        self.dest = dest
        self.path = []
        self.compute_path()

    def heuristic(self, a, b):
        """Manhattan distance."""
        return abs(a[0] - b[0]) + abs(a[1] - b[1])

    def get_neighbors(self, pos):
        """
        Get neighbors using MOORE neighborhood and filter by road direction.
        Adapted from your original get_neighbors code.
        """
        x, y = pos
        neighbors = []
        
        # Get current cell contents
        current_cell = self.model.grid[pos]
        current_direction = None
        
        # Find road direction at current position
        for agent in current_cell.agents:
            if isinstance(agent, Road):
                current_direction = agent.direction
                break
        
        if current_direction:
            # Get all Moore neighbors
            all_neighbors = []
            for dx in [-1, 0, 1]:
                for dy in [-1, 0, 1]:
                    if dx == 0 and dy == 0:
                        continue
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < self.model.width and 0 <= ny < self.model.height:
                        all_neighbors.append((nx, ny))
            
            # Filter based on direction (like your original code)
            if current_direction == 'Left':
                neighbors = [(nx, ny) for nx, ny in all_neighbors if nx < x]
            elif current_direction == 'Right':
                neighbors = [(nx, ny) for nx, ny in all_neighbors if nx > x]
            elif current_direction == 'Up':
                neighbors = [(nx, ny) for nx, ny in all_neighbors if ny > y]
            elif current_direction == 'Down':
                neighbors = [(nx, ny) for nx, ny in all_neighbors if ny < y]
            else:
                neighbors = all_neighbors
        else:
            # No road - get all Moore neighbors
            for dx in [-1, 0, 1]:
                for dy in [-1, 0, 1]:
                    if dx == 0 and dy == 0:
                        continue
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < self.model.width and 0 <= ny < self.model.height:
                        neighbors.append((nx, ny))
        
        return neighbors

    def is_path_clear(self, current, neighbor):
        """
        Check if path from current to neighbor is clear.
        Adapted from your es_camino_despejado method.
        """
        neighbor_cell = self.model.grid[neighbor]
        
        # Check for obstacles
        for agent in neighbor_cell.agents:
            if isinstance(agent, Obstacle):
                return False
        
        # Check for wrong destinations
        for agent in neighbor_cell.agents:
            if isinstance(agent, Destination) and neighbor != self.dest.coordinate:
                return False
        
        return True

    def compute_path(self):
        """A* search adapted from your original a_star_search."""
        start = self.cell.coordinate
        goal = self.dest.coordinate
        
        open_set = []
        heapq.heappush(open_set, (0, start))
        came_from = {}
        g_score = {start: 0}
        f_score = {start: self.heuristic(start, goal)}
        
        max_iterations = 50000
        iterations = 0
        
        while open_set and iterations < max_iterations:
            iterations += 1
            current = heapq.heappop(open_set)[1]
            
            if current == goal:
                # Reconstruct path
                path = []
                while current in came_from:
                    path.append(current)
                    current = came_from[current]
                path.reverse()
                self.path = path
                print(f"Car {self.unique_id}: Path {len(path)} steps")
                return
            
            for neighbor in self.get_neighbors(current):
                if not self.is_path_clear(current, neighbor):
                    continue
                
                tentative_g = g_score[current] + 1
                
                if neighbor not in g_score or tentative_g < g_score[neighbor]:
                    came_from[neighbor] = current
                    g_score[neighbor] = tentative_g
                    f = tentative_g + self.heuristic(neighbor, goal)
                    f_score[neighbor] = f
                    heapq.heappush(open_set, (f, neighbor))
        
        self.path = []

    def step(self):
        """Move one step along path."""
        # Check if already at destination
        if self.cell.coordinate == self.dest.coordinate:
            print(f"Car {self.unique_id} arrived at {self.dest.coordinate}!")
            self._should_remove = True  # Mark for removal when the car has reached its destination
            return
        
        if not self.path:
            return
        
        next_pos = self.path[0]
        next_cell = self.model.grid[next_pos]
        
        # Check traffic light
        for agent in next_cell.agents:
            if isinstance(agent, Traffic_Light) and not agent.is_green:
                return
        
        # Check other cars
        if any(isinstance(a, Car) for a in next_cell.agents):
            return
        
        # Move
        if self in self.cell.agents:
            self.cell.agents.remove(self)
        next_cell.agents.append(self)
        self.cell = next_cell
        self.path.pop(0)
