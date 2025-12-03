#version 300 es
precision highp float;

const int NUM_LIGHTS = 25;

in vec3 v_normal;
in vec3 v_surfaceToLight[NUM_LIGHTS];
in vec3 v_surfaceToView;
in vec2 v_texCoord;

uniform sampler2D u_texture;
uniform vec4 u_color;          // << NEW — base color when no texture
uniform float u_shininess;

// Global light
uniform vec4 u_ambientLight;
uniform vec4 u_globalDiffuseLight;
uniform vec4 u_globalSpecularLight;

// Per-light point lights
uniform vec4 u_diffuseLight[NUM_LIGHTS];
uniform vec4 u_specularLight[NUM_LIGHTS];

// Attenuation
uniform float u_constant;
uniform float u_linear;
uniform float u_quadratic;

out vec4 outColor;

void main() {
    vec4 base = u_color;

    // If a texture exists, use it (but only if texColor is valid)
    vec4 texColor = texture(u_texture, v_texCoord);
    if (texColor.a > 0.01) {
        base = texColor;
    }

    vec3 N = normalize(v_normal);
    vec3 V = normalize(v_surfaceToView);

    // Ambient
    vec4 ambient = base * u_ambientLight;

    vec4 diffuse = vec4(0.0);
    vec4 specular = vec4(0.0);

    // ========== GLOBAL LIGHT (index 0) ==========
    vec3 L0 = normalize(v_surfaceToLight[0]);
    float diff0 = max(dot(N, L0), 0.0);

    vec3 R0 = reflect(-L0, N);
    float spec0 = pow(max(dot(V, R0), 0.0), u_shininess);

    diffuse += base * u_globalDiffuseLight * diff0;
    specular += base * u_globalSpecularLight * spec0;

    // ========== POINT LIGHTS (1 - NUM_LIGHTS) ==========
    for (int i = 1; i < NUM_LIGHTS; i++) {
        vec3 L = normalize(v_surfaceToLight[i]);
        float distance = length(v_surfaceToLight[i]);

        float attenuation = 1.0 / (u_constant +
                                   u_linear * distance +
                                   u_quadratic * (distance * distance));

        float diff = max(dot(N, L), 0.0);

        vec3 R = reflect(-L, N);
        float specV = pow(max(dot(V, R), 0.0), u_shininess);

        diffuse += base * u_diffuseLight[i] * diff * attenuation;
        specular += base * u_specularLight[i] * specV * attenuation;
    }

    outColor = ambient + diffuse + specular;
}
