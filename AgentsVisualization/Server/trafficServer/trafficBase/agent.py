from mesa.discrete_space import CellAgent, FixedAgent
import heapq


# ============================================================
# ROAD
# ============================================================
class Road(FixedAgent):
    """Road cell with allowed movement direction."""
    def __init__(self, model, cell, direction="Left"):
        super().__init__(model)
        self.cell = cell
        self.direction = direction


# ============================================================
# TRAFFIC LIGHT
# ============================================================
class Traffic_Light(FixedAgent):
    """Traffic light."""
    def __init__(self, model, cell, state=False, timeToChange=10):
        super().__init__(model)
        self.cell = cell
        self.state = state
        self.timeToChange = timeToChange

    def step(self):
        """Toggle state every timeToChange steps."""
        if self.model.steps % self.timeToChange == 0:
            self.state = not self.state

    @property
    def is_green(self):
        return self.state


# ============================================================
# DESTINATION
# ============================================================
class Destination(FixedAgent):
    """Destination agent."""
    def __init__(self, model, cell):
        super().__init__(model)
        self.cell = cell


# ============================================================
# OBSTACLE
# ============================================================
class Obstacle(FixedAgent):
    """Obstacle agent."""
    def __init__(self, model, cell):
        super().__init__(model)
        self.cell = cell


# ============================================================
# CAR - FIXED FOR ONE-WAY STREETS WITH LANE CHANGES
# ============================================================
class Car(CellAgent):
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
        Get valid neighbors following traffic rules:
        - Follow current road direction to move
        - Can move to Roads, Traffic Lights, AND Destinations
        - Destinations are reachable endpoints
        """
        x, y = pos
        current_cell = self.model.grid[pos]
        
        # Find what's in current cell
        current_road = None
        is_destination = False
        
        for agent in current_cell.agents:
            if isinstance(agent, Road):
                current_road = agent
            if isinstance(agent, Destination):
                is_destination = True
        
        # Special case: if we're AT a destination without a road, we've arrived - no moves
        if is_destination and not current_road:
            return []
        
        # If no road at current position and not at destination, we're stuck
        if not current_road:
            return []
        
        # We have a road - follow its direction
        direction = current_road.direction
        moves = {
            "Right": (1, 0),
            "Left": (-1, 0),
            "Up": (0, 1),
            "Down": (0, -1)
        }
        
        neighbors = []
        
        # Follow current road direction
        if direction in moves:
            dx, dy = moves[direction]
            nx, ny = x + dx, y + dy
            
            # Check bounds
            if not (0 <= nx < self.model.width and 0 <= ny < self.model.height):
                return neighbors
            
            neighbor_cell = self.model.grid[(nx, ny)]
            
            # Skip if obstacle - but don't return, just skip
            if any(isinstance(a, Obstacle) for a in neighbor_cell.agents):
                return neighbors  # No valid neighbor in this direction
            
            # Accept: Roads, Traffic Lights, OR Destinations
            has_road = any(isinstance(a, Road) for a in neighbor_cell.agents)
            has_light = any(isinstance(a, Traffic_Light) for a in neighbor_cell.agents)
            has_dest = any(isinstance(a, Destination) for a in neighbor_cell.agents)
            
            if has_road or has_light or has_dest:
                neighbors.append((nx, ny))
        
        return neighbors

    def compute_path(self):
        """BFS pathfinding - guaranteed to find shortest path if it exists."""
        from collections import deque
        
        start = self.cell.coordinate
        goal = self.dest.coordinate
        
        # BFS queue: each element is a position
        queue = deque([start])
        came_from = {start: None}
        
        max_iterations = 10000  # Much higher limit
        iterations = 0
        
        while queue and iterations < max_iterations:
            iterations += 1
            current = queue.popleft()
            
            # Goal reached
            if current == goal:
                # Reconstruct path
                path = []
                while came_from[current] is not None:
                    path.append(current)
                    current = came_from[current]
                path.reverse()
                self.path = path
                print(f"✅ Car {self.unique_id}: Found path with {len(path)} steps (explored {iterations})")
                return
            
            # Explore neighbors
            for neighbor in self.get_neighbors(current):
                if neighbor not in came_from:
                    came_from[neighbor] = current
                    queue.append(neighbor)
        
        # No path found
        self.path = []
        print(f"❌ Car {self.unique_id}: No path from {start} to {goal}")
        print(f"   Explored {len(came_from)} cells with BFS")

    def step(self):
        """Move one step along the path."""
        if not self.path:
            return
        
        next_pos = self.path[0]
        next_cell = self.model.grid[next_pos]
        
        # Check for red traffic light
        for agent in next_cell.agents:
            if isinstance(agent, Traffic_Light) and not agent.is_green:
                return
        
        # Check for other cars
        if any(isinstance(a, Car) for a in next_cell.agents):
            return
        
        # Move the car
        if self in self.cell.agents:
            self.cell.agents.remove(self)
        next_cell.agents.append(self)
        self.cell = next_cell
        
        # Remove this position from path
        self.path.pop(0)