#version 300 es
precision highp float;

in vec4 a_position;
in vec3 a_normal;
in vec2 a_texCoord;

const int NUM_LIGHTS = 7;

uniform mat4 u_world;
uniform mat4 u_worldInverseTransform;
uniform mat4 u_worldViewProjection;
uniform vec3 u_viewWorldPosition;
uniform vec3 u_lightWorldPosition[NUM_LIGHTS];

out vec3 v_normal;
out vec3 v_surfaceToLight[NUM_LIGHTS];
out vec3 v_surfaceToView;
out vec2 v_texCoord;

void main() {
    // Pass texture coordinates
    v_texCoord = a_texCoord;

    // Compute world position
    vec3 surfaceWorldPosition = (u_world * a_position).xyz;

    // Compute normal in world space
    v_normal = normalize(mat3(u_worldInverseTransform) * a_normal);

    // Compute direction vectors to each light
    for(int i = 0; i < NUM_LIGHTS; ++i) {
        v_surfaceToLight[i] = u_lightWorldPosition[i] - surfaceWorldPosition;
    }

    // Direction to camera
    v_surfaceToView = u_viewWorldPosition - surfaceWorldPosition;

    // Output clip-space position
    gl_Position = u_worldViewProjection * a_position;
}