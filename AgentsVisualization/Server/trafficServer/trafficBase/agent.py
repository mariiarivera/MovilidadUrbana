from mesa.discrete_space import CellAgent, FixedAgent
import numpy as np
from .astar import find_path_with_directions


class Agent(CellAgent):
    """
    Agent that moves randomly.
    """
    def __init__(self, model, cell):
        """
        Creates a new random agent.
        Args:
            model: Model reference for the agent
            cell: The initial position of the agent
        """
        super().__init__(model)
        self.cell = cell

    def step(self):
        """ 
        Determines the new direction it will take, and then moves
        """
        pass

class Traffic_Light(FixedAgent):
    """
    Traffic light. Where the traffic lights are in the grid.
    """
    def __init__(self, model, cell, state = False, timeToChange = 10):
        """
        Creates a new Traffic light.
        Args:
            model: Model reference for the agent
            cell: The initial position of the agent
            state: Whether the traffic light is green or red
            timeToChange: After how many step should the traffic light change color 
        """
        super().__init__(model)
        self.cell = cell
        self.state = state
        self.timeToChange = timeToChange

    def step(self):
        """ 
        To change the state (green or red) of the traffic light in case you consider the time to change of each traffic light.
        """
        if self.model.steps % self.timeToChange == 0:
            self.state = not self.state

    @property
    def is_green(self):
        """Whether the traffic light is green."""
        return self.state
    
    @is_green.setter
    def is_green(self, value: bool) -> None:
        """Set traffic light state."""
        self.state = value

class Destination(FixedAgent):
    """
    Destination agent. Where each car should go.
    """
    def __init__(self, model, cell):
        """
        Creates a new destination agent
        Args:
            model: Model reference for the agent
            cell: The initial position of the agent
        """
        super().__init__(model)
        self.cell = cell

class Obstacle(FixedAgent):
    """
    Obstacle agent. Just to add obstacles to the grid.
    """
    def __init__(self, model, cell):
        """
        Creates a new obstacle.
        
        Args:
            model: Model reference for the agent
            cell: The initial position of the agent
        """
        super().__init__(model)
        self.cell = cell

class Road(FixedAgent):
    """
    Road agent. Determines where the cars can move, and in which direction.
    """
    def __init__(self, model, cell, direction= "Left"):
        """
        Creates a new road.
        Args:
            model: Model reference for the agent
            cell: The initial position of the agent
        """
        super().__init__(model)
        self.cell = cell
        self.direction = direction

class Car(CellAgent):
    def __init__(self, model, cell, unique_id=None, dest=None):
        super().__init__(model)
        self.cell = cell
        self.unique_id = unique_id
        self.dest = dest

        self.path = []
        self.path_index = 0

        self.compute_path()

    def compute_path(self):
        start = self.cell.coordinate
        goal = self.dest.coordinate

        dir_grid = self.model.get_direction_grid()

        path = find_path_with_directions(dir_grid, start, goal)

        if path:
            self.path = path
            self.path_index = 1
            print(f"Car {self.unique_id} path OK")
        else:
            print(f"Car {self.unique_id} could not find path")

    def move(self):
        if not self.path or self.path_index >= len(self.path):
            return

        next_pos = self.path[self.path_index]
        next_cell = self.model.grid[next_pos]

        # 1. Semáforo rojo
        tl = next((a for a in next_cell.agents if isinstance(a, Traffic_Light)), None)
        if tl and not tl.is_green:
            return

        # 2. Carro enfrente
        if any(isinstance(a, Car) for a in next_cell.agents):
            return

        # 3. Avanzar
        self.cell = next_cell
        self.path_index += 1

    def step(self):
        self.move()



class SideWalk(FixedAgent):
    """
    Sidewalk agent.
    """
    def __init__(self, model, cell):
        """
        Creates a new sidewalk.
        
        Args:
            model: Model reference for the agent
            cell: The initial position of the agent
        """
        super().__init__(model)
        self.cell = cell

