from mesa import Model
from mesa.discrete_space import OrthogonalMooreGrid
import json
import random

from .agent import Road, Traffic_Light, Destination, Obstacle, SideWalk, Car


class CityModel(Model):
    """
    Creates a model based on a city map.
    """
    def __init__(self, N, seed=42):
        super().__init__(seed=seed)

        self.random_gen = random.Random(seed)
        self.num_agents = N
        self.traffic_lights = []
        self.destinations = []

        dataDictionary = json.load(open("city_files/mapDictionary.json"))

        # Cargar mapa
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

            for r, row in enumerate(lines):
                for c, col in enumerate(row.strip()):
                    pos = (c, self.height - r - 1)
                    cell = self.grid[pos]

                    if col in [">", "<", "v", "^"]:
                        direction = dataDictionary[col]  # "Right", "Left", "Down", "Up"
                        road = Road(self, cell, direction)
                        cell.agents.append(road)

                    elif col in ["S", "s"]:
                        state = False if col == "S" else True
                        timeToChange = dataDictionary[col]  # 15 o 7
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

        # Esquinas del mapa (coinciden con tu grid)
        self.corners = [
            (0, 0),
            (self.width - 1, 0),
            (0, self.height - 1),
            (self.width - 1, self.height - 1)
        ]

        self.running = True

    # ----------------------------------------------------
    # SPAWN CARS: se agregan vehículos cada 10 pasos
    # ----------------------------------------------------
    def spawnCars(self):
        print(f"\n🚗 spawnCars en step {self.steps}")

        if not self.destinations:
            print("⚠ No hay destinos disponibles")
            return

        for corner in self.corners:
            cell = self.grid[corner]

            # Si ya hay un carro válido ahí, lo saltamos
            if any(isinstance(a, Car) for a in cell.agents):
                continue

            # Intentamos asignar un destino que no esté ocupado
            valid_destinations = [dest for dest in self.destinations if not any(isinstance(a, Car) for a in dest.cell.agents)]
            if valid_destinations:
                chosen_dest = self.random_gen.choice(valid_destinations)
                dest_cell = chosen_dest.cell
            else:
                # Si no hay destinos libres, elegimos un destino más cercano
                dest_cell = self.get_closest_destination(corner)
            
            car = Car(
                self, cell,
                unique_id=self.random_gen.randint(10000, 99999),
                dest=dest_cell
            )

            # Si no encontró ruta, lo mantenemos pero lo reintentamos
            if not car.path:
                print(f"  ✗ Car {car.unique_id} no encontró ruta desde {corner} -> {dest_cell.coordinate}")
                continue

            cell.agents.append(car)
            # Importante: lo registramos en el modelo
            self._agents[car.unique_id] = car
            print(f"  ✓ Car {car.unique_id} spawn en {corner} con ruta de {len(car.path)} pasos")

    def get_closest_destination(self, corner):
        """Encuentra el destino más cercano a una esquina si no hay destinos libres."""
        min_distance = float('inf')
        closest_dest = None
        for dest in self.destinations:
            distance = abs(dest.cell.coordinate[0] - corner[0]) + abs(dest.cell.coordinate[1] - corner[1])
            if distance < min_distance:
                min_distance = distance
                closest_dest = dest
        return closest_dest.cell

    # ----------------------------------------------------
    def step(self):
        """Advance the model by one step."""
        if self.steps == 0 or self.steps == 1:
            self.spawnCars()

        # Spawnear cada 10 pasos
        if self.steps % 10 == 0:
            self.spawnCars()

        self.agents.shuffle_do("step")
