#version 300 es
precision highp float;

const int NUM_LIGHTS = 27;

in vec3 v_normal;
in vec3 v_surfaceToLight[NUM_LIGHTS];
in vec3 v_surfaceToView;
in vec2 v_texCoord;

uniform sampler2D u_texture;
uniform vec4 u_color;
uniform float u_shininess;

uniform vec4 u_ambientLight;
uniform vec4 u_diffuseLight[NUM_LIGHTS];
uniform vec4 u_specularLight[NUM_LIGHTS];

uniform float u_constant;
uniform float u_linear;
uniform float u_quadratic;

out vec4 outColor;

void main() {
    vec4 base = u_color;

    // Use texture if available
    vec4 texColor = texture(u_texture, v_texCoord);
    if(texColor.a > 0.01) {
        base = texColor;
    }

    vec3 N = normalize(v_normal);
    vec3 V = normalize(v_surfaceToView);

    // Start with ambient
    vec4 ambient = base * u_ambientLight;
    vec4 diffuse = vec4(0.0);
    vec4 specular = vec4(0.0);

    // Iterate over all lights
    for(int i = 0; i < NUM_LIGHTS; i++) {
        vec3 L = normalize(v_surfaceToLight[i]);
        float distance = length(v_surfaceToLight[i]);
        float attenuation = 1.0 / (u_constant + u_linear*distance + u_quadratic*distance*distance);

        float diff = max(dot(N, L), 0.0);
        vec3 R = reflect(-L, N);
        float spec = pow(max(dot(V, R), 0.0), u_shininess);

        diffuse += base * u_diffuseLight[i] * diff * attenuation;
        specular += u_specularLight[i] * spec * attenuation; // usually specular not multiplied by base color
    }

    outColor = clamp(ambient + diffuse + specular, 0.0, 1.0);
}
