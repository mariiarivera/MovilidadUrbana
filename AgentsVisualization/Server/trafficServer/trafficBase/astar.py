from typing import List, Tuple, Dict
import heapq

def create_node(position, g=float('inf'), h=0.0, parent=None):
    return {
        'position': position,
        'g': g,
        'h': h,
        'f': g + h,
        'parent': parent
    }

def heuristic(a, b):
    return abs(a[0]-b[0]) + abs(a[1]-b[1])   # Manhattan

def get_valid_neighbors(position, road_dir_grid, goal):
    x, y = position
    rows = len(road_dir_grid)
    cols = len(road_dir_grid[0])

    dirs = {
        '>': (1, 0),
        '<': (-1, 0),
        '^': (0, 1),
        'v': (0, -1)
    }

    direction = road_dir_grid[x][y]

    if direction is None:
        return []

    dx, dy = dirs[direction]
    nx, ny = x + dx, y + dy

    if 0 <= nx < rows and 0 <= ny < cols:

        # ✔ Permitir entrar a la meta aunque no sea carretera
        if (nx, ny) == goal:
            return [(nx, ny)]

        # ✔ Solo permitir movernos a otras calles dirigidas
        if road_dir_grid[nx][ny] is not None:
            return [(nx, ny)]

    return []

def reconstruct(goal_node):
    path = []
    current = goal_node
    while current is not None:
        path.append(current['position'])
        current = current['parent']
    return path[::-1]

def find_path_with_directions(road_dir_grid, start, goal):

    # ✔ START debe ser carretera, GOAL ya no
    if road_dir_grid[start[0]][start[1]] is None:
        return []

    open_list = []
    start_node = create_node(start, g=0, h=heuristic(start, goal))
    heapq.heappush(open_list, (start_node['f'], start))
    open_dict = {start: start_node}
    closed = set()

    while open_list:
        _, current_pos = heapq.heappop(open_list)
        current_node = open_dict[current_pos]

        if current_pos == goal:
            return reconstruct(current_node)

        closed.add(current_pos)

        for nb in get_valid_neighbors(current_pos, road_dir_grid, goal):

            if nb in closed:
                continue

            tentative_g = current_node['g'] + 1

            if nb not in open_dict:
                node = create_node(nb, tentative_g, heuristic(nb, goal), current_node)
                open_dict[nb] = node
                heapq.heappush(open_list, (node['f'], nb))
            elif tentative_g < open_dict[nb]['g']:
                node = open_dict[nb]
                node['g'] = tentative_g
                node['f'] = node['g'] + node['h']
                node['parent'] = current_node

    return []
