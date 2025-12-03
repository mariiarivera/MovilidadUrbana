#version 300 es
in vec4 a_position;
in vec3 a_normal;
in vec2 a_texCoord;

const int NUM_LIGHTS = 27;

uniform vec3 u_lightWorldPosition[NUM_LIGHTS];
uniform vec3 u_viewWorldPosition;

uniform mat4 u_world;
uniform mat4 u_worldInverseTransform;
uniform mat4 u_worldViewProjection;

out vec3 v_normal;
out vec3 v_surfaceToLight[NUM_LIGHTS];
out vec3 v_surfaceToView;
out vec2 v_texCoord;
out vec3 v_worldPos;

void main() {
    v_texCoord = a_texCoord;

    // Transform position
    gl_Position = u_worldViewProjection * a_position;

    // World-space normal
    v_normal = mat3(u_worldInverseTransform) * a_normal;

    // World position of the surface
    v_worldPos = (u_world * a_position).xyz;

    // Directions to all lights
    for (int i = 0; i < NUM_LIGHTS; i++) {
        v_surfaceToLight[i] = u_lightWorldPosition[i] - v_worldPos;
    }

    // Direction to camera
    v_surfaceToView = u_viewWorldPosition - v_worldPos;
}
