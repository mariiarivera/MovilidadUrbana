from typing import Tuple, List, Optional
import heapq

# Direcciones cardinales
DIRS = {
    '>': (1, 0),   # Right
    '<': (-1, 0),  # Left
    '^': (0, 1),   # Up
    'v': (0, -1)   # Down
}

# Direcciones opuestas (para evitar U-turns)
OPPOSITE = {
    '>': '<',
    '<': '>',
    '^': 'v',
    'v': '^'
}


def heuristic(a: Tuple[int, int], b: Tuple[int, int]) -> float:
    """Manhattan distance heuristic."""
    return abs(a[0] - b[0]) + abs(a[1] - b[1])


def is_valid_position(x: int, y: int, width: int, height: int) -> bool:
    """Check if position is within grid bounds."""
    return 0 <= x < width and 0 <= y < height


def can_enter_cell(from_dir: str, to_symbol: str) -> bool:
    """
    Determina si puedes entrar a una celda basado en:
    - from_dir: dirección desde la que vienes (símbolo de tu celda actual)
    - to_symbol: símbolo de la celda a la que quieres entrar
    
    Regla: Puedes entrar si NO es contraflujo directo
    """
    if to_symbol is None:
        return False
    
    # Puedes entrar a cualquier celda EXCEPTO si vas directamente contra el flujo
    # Ejemplo: si vienes de '>' (derecha) NO puedes entrar a '<' (izquierda) en esa dirección
    # Pero SÍ puedes entrar a 'v' o '^' (son giros)
    
    from_dx, from_dy = DIRS[from_dir]
    to_dx, to_dy = DIRS[to_symbol]
    
    # Si las direcciones son exactamente opuestas, es contraflujo
    if (from_dx, from_dy) == (-to_dx, -to_dy):
        return False
    
    return True


def get_neighbors(position: Tuple[int, int], 
                  road_dir_grid: List[List[Optional[str]]], 
                  current_dir: str,
                  came_from_dir: Optional[str],
                  goal: Tuple[int, int]) -> List[Tuple[Tuple[int, int], str]]:
    """
    Obtiene vecinos válidos desde la posición actual.
    
    Reglas de movimiento:
    1. Primero intenta seguir la dirección de tu celda actual (directo)
    2. Si hay celdas adyacentes con otras direcciones, puedes girar hacia ellas (intersección)
    3. NO puedes hacer U-turn (regresar por donde viniste)
    4. NO puedes ir contraflujo
    """
    x, y = position
    height = len(road_dir_grid[0])
    width = len(road_dir_grid)
    
    neighbors = []
    
    # Si ya llegamos a la meta, no hay vecinos
    if position == goal:
        return neighbors
    
    # Dirección actual (hacia dónde apunta la flecha de esta celda)
    if current_dir is None:
        return neighbors
    
    # PRIORIDAD 1: Seguir tu dirección actual (recto)
    dx, dy = DIRS[current_dir]
    nx, ny = x + dx, y + dy
    
    if is_valid_position(nx, ny, width, height):
        if (nx, ny) == goal:
            neighbors.append(((nx, ny), None))  # Meta alcanzada
        else:
            next_symbol = road_dir_grid[nx][ny]
            if next_symbol is not None:
                # Evitar U-turn
                if came_from_dir is None or next_symbol != came_from_dir:
                    if can_enter_cell(current_dir, next_symbol):
                        neighbors.append(((nx, ny), next_symbol))
    
    # PRIORIDAD 2: Explorar giros (intersecciones)
    # Intentar moverte en TODAS las direcciones adyacentes (excepto U-turn y recto ya explorado)
    for direction, (dx, dy) in DIRS.items():
        # Saltar la dirección que ya exploramos (recto)
        if direction == current_dir:
            continue
        
        # Evitar U-turn: no regresar por donde vinimos
        if came_from_dir is not None and direction == OPPOSITE[came_from_dir]:
            continue
        
        nx, ny = x + dx, y + dy
        
        if is_valid_position(nx, ny, width, height):
            if (nx, ny) == goal:
                neighbors.append(((nx, ny), None))
            else:
                next_symbol = road_dir_grid[nx][ny]
                if next_symbol is not None:
                    if can_enter_cell(direction, next_symbol):
                        neighbors.append(((nx, ny), next_symbol))
    
    return neighbors


def reconstruct_path(came_from: dict, start: Tuple[int, int], goal: Tuple[int, int]) -> List[Tuple[int, int]]:
    """Reconstruye el camino desde start hasta goal."""
    path = []
    current = goal
    
    while current is not None:
        path.append(current)
        current = came_from.get(current)
    
    path.reverse()
    return path


def find_path_with_directions(road_dir_grid: List[List[Optional[str]]], 
                               start: Tuple[int, int], 
                               goal: Tuple[int, int]) -> List[Tuple[int, int]]:
    """
    Encuentra un camino desde start hasta goal usando A*.
    
    Args:
        road_dir_grid: Grid donde cada celda contiene '>', '<', '^', 'v', o None
        start: Coordenadas (x, y) de inicio
        goal: Coordenadas (x, y) de destino
    
    Returns:
        Lista de coordenadas (x, y) que forman el camino, o [] si no hay camino
    """
    width = len(road_dir_grid)
    height = len(road_dir_grid[0])
    
    # Verificar que start y goal sean válidos
    if not is_valid_position(start[0], start[1], width, height):
        return []
    if not is_valid_position(goal[0], goal[1], width, height):
        return []
    
    start_symbol = road_dir_grid[start[0]][start[1]]
    if start_symbol is None:
        return []
    
    # Estructuras de datos para A*
    open_set = []
    heapq.heappush(open_set, (0, start))
    
    came_from = {start: None}
    g_score = {start: 0}
    f_score = {start: heuristic(start, goal)}
    
    # Guardamos también la dirección de cada nodo
    node_direction = {start: start_symbol}
    node_came_from_dir = {start: None}
    
    while open_set:
        _, current = heapq.heappop(open_set)
        
        # ¿Llegamos a la meta?
        if current == goal:
            return reconstruct_path(came_from, start, goal)
        
        current_dir = node_direction.get(current)
        came_from_dir = node_came_from_dir.get(current)
        
        # Explorar vecinos
        for neighbor, next_dir in get_neighbors(current, road_dir_grid, current_dir, came_from_dir, goal):
            tentative_g = g_score[current] + 1
            
            if neighbor not in g_score or tentative_g < g_score[neighbor]:
                came_from[neighbor] = current
                g_score[neighbor] = tentative_g
                f_score[neighbor] = tentative_g + heuristic(neighbor, goal)
                node_direction[neighbor] = next_dir
                node_came_from_dir[neighbor] = current_dir
                
                heapq.heappush(open_set, (f_score[neighbor], neighbor))
    
    # No se encontró camino
    return []
