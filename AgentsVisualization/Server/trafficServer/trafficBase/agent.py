from mesa.discrete_space import CellAgent, FixedAgent

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
    """
    Car agent that moves in the direction of the Road cell it's on.
    """
    def __init__(self, model, cell):
        super().__init__(model)
        self.cell = cell

    def move(self):
        x, y = self.cell.coordinate
        current_cell = self.model.grid[x, y]
    
        #saber donde esta la road 
        road = next((agent for agent in current_cell.agents if isinstance(agent, Road)), None)

        if road is None:
            return 
        # mover segun la direccion 

        direction = road.direction
        dx, dy = 0, 0
        if direction == "Up":
            dy = 1
        elif direction == "Down":
            dy = -1
        elif direction == "Left":
            dx = -1
        elif direction == "Right":
            dx = 1

        next_pos = (x + dx, y + dy)

        # no pasar por obstaculos
        next_cell = self.model.grid[next_pos]
        if any(isinstance(a, Obstacle) for a in next_cell.agents):
            return

        # moverse 
        next_cell = self.model.grid[next_pos]
        self.cell = next_cell
        print(f"Car {self.unique_id} moved to {next_pos}")

    def step(self):

        self.move()