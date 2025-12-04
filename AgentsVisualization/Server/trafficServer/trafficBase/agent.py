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
        self.direction = direction  # From dictionary: "Right", "Left", "Up", "Down"


# ============================================================
# TRAFFIC LIGHT
# ============================================================
class Traffic_Light(FixedAgent):
    """
    Traffic light. Where the traffic lights are in the grid.
    state = True  -> green
    state = False -> red
    """
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
    """Destination agent. Where each car should go."""
    def __init__(self, model, cell):
        super().__init__(model)
        self.cell = cell


# ============================================================
# OBSTACLE
# ============================================================
class Obstacle(FixedAgent):
    """Obstacle agent. Just to add obstacles to the grid."""
    def __init__(self, model, cell):
        super().__init__(model)
        self.cell = cell


# ============================================================
# SIDEWALK
# ============================================================
class SideWalk(FixedAgent):
    """Sidewalk agent."""
    def __init__(self, model, cell):
        super().__init__(model)
        self.cell = cell


# ============================================================
# CAR WITH INTERNAL A* (no astar.py, no MultiGrid)
# ============================================================
class Car(CellAgent):
    def __init__(self, model, cell, unique_id=None, dest=None):
        super().__init__(model)
        self.cell = cell           # Current cell (OrthogonalMooreGrid)
        self.unique_id = unique_id
        self.dest = dest           # dest is a Destination.cell

        self.path = []             # list of tuples (x, y)
        self.compute_path()        # Calculates path with A*

    # ----------------------------------------------------------
    # HEURISTIC (Manhattan Distance)
    # ----------------------------------------------------------
    def heuristic(self, a, b):
        return abs(a[0] - b[0]) + abs(a[1] - b[1])

    # ----------------------------------------------------------
    # GET NEIGHBORS (MOORE) AND FILTER BY ROAD DIRECTION
    # WITHOUT get_neighborhood
    # ----------------------------------------------------------
    def get_raw_neighbors(self, pos):
        """Moore neighbors within grid boundaries."""
        x, y = pos
        neighbors = []
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                if dx == 0 and dy == 0:
                    continue
                nx, ny = x + dx, y + dy
                if 0 <= nx < self.model.width and 0 <= ny < self.model.height:
                    neighbors.append((nx, ny))
        return neighbors

    def get_neighbors(self, pos):
        """Allowed neighbors based on the road direction in pos."""
        x, y = pos

        cell = self.model.grid[pos]
        road = next((a for a in cell.agents if isinstance(a, Road)), None)

        all_neighbors = self.get_raw_neighbors(pos)

        # If no Road, free navigation
        if not road:
            return all_neighbors

        direction = road.direction
        if direction == "Left":
            return [(nx, ny) for nx, ny in all_neighbors if nx < x]
        if direction == "Right":
            return [(nx, ny) for nx, ny in all_neighbors if nx > x]
        if direction == "Up":
            return [(nx, ny) for nx, ny in all_neighbors if ny > y]
        if direction == "Down":
            return [(nx, ny) for nx, ny in all_neighbors if ny < y]

        return all_neighbors

    # ----------------------------------------------------------
    # VALIDATION OF NEXT CELL
    # ----------------------------------------------------------
    def is_clear(self, nxt):
        """
        Checks if next cell is clear for pathfinding.
        (Obstacles, other cars, red traffic lights, wrong destinations)
        """
        contents = self.model.grid[nxt].agents

        for a in contents:
            if isinstance(a, Obstacle):
                return False
            if isinstance(a, Car):
                return False
            if isinstance(a, Traffic_Light) and not a.is_green:
                return False
            if isinstance(a, Destination) and a.cell != self.dest:
                return False

        return True

    # ----------------------------------------------------------
    # A* PATHFINDING
    # ----------------------------------------------------------
    def compute_path(self):
        start = self.cell.coordinate       # (x, y)
        goal = self.dest.coordinate        # (x, y)

        open_set = []
        heapq.heappush(open_set, (0, start))

        came_from = {}
        g_score = {start: 0}

        while open_set:
            _, current = heapq.heappop(open_set)

            if current == goal:
                # Reconstruct path
                path = []
                while current in came_from:
                    path.append(current)
                    current = came_from[current]
                path.reverse()
                self.path = path
                print(f"Car {self.unique_id} path OK ({len(self.path)} steps)")
                return

            for neighbor in self.get_neighbors(current):
                # In pathfinding, we already skip blocked paths
                if not self.is_clear(neighbor):
                    continue

                tentative = g_score[current] + 1
                if neighbor not in g_score or tentative < g_score[neighbor]:
                    g_score[neighbor] = tentative
                    f_score = tentative + self.heuristic(neighbor, goal)
                    heapq.heappush(open_set, (f_score, neighbor))
                    came_from[neighbor] = current

        self.path = []  # No path
        print(f"Car {self.unique_id} could not find a path")

    # ----------------------------------------------------------
    # STEP = ADVANCE ONE STEP IN THE PATH
    # ----------------------------------------------------------
    def step(self):
        """Moves the car one step along its path, respecting traffic lights and other cars."""
        if not self.path:
            return

        next_pos = self.path[0]
        next_cell = self.model.grid[next_pos]

        # 1. Traffic Light in the next cell
        tl = next((a for a in next_cell.agents if isinstance(a, Traffic_Light)), None)
        if tl and not tl.is_green:
            return

        # 2. Car in the next cell
        if any(isinstance(a, Car) for a in next_cell.agents):
            return

        # 3. Move physically: remove from current cell, add to next
        current_cell = self.cell
        if self in current_cell.agents:
            current_cell.agents.remove(self)
        next_cell.agents.append(self)
        self.cell = next_cell

        # 4. Advance in the path
        self.path.pop(0)
