#version 300 es
precision highp float;

const int NUM_LIGHTS = 3;

in vec3 v_normal;
in vec3 v_surfaceToLight[NUM_LIGHTS];
in vec3 v_surfaceToView;
in vec2 v_texCoord;

uniform sampler2D u_texture;
uniform float u_shininess;

uniform vec4 u_ambientLight;
uniform vec4 u_diffuseLight[NUM_LIGHTS];
uniform vec4 u_specularLight[NUM_LIGHTS];
uniform float u_constant;
uniform float u_linear;
uniform float u_quadratic;

out vec4 outColor;

void main() {
    vec4 baseColor = texture(u_texture, v_texCoord);
    vec3 normal = normalize(v_normal);
    vec3 viewDir = normalize(v_surfaceToView);

    vec4 ambient = baseColor * u_ambientLight;
    vec4 diffuse = vec4(0.0);
    vec4 specular = vec4(0.0);

    for(int i = 0; i < NUM_LIGHTS; ++i) {
        vec3 lightDir = normalize(v_surfaceToLight[i]);
        float distance = length(v_surfaceToLight[i]);
        float attenuation = 1.0 / (u_constant + u_linear * distance + u_quadratic * distance * distance);

        // Diffuse component
        float diff = max(dot(normal, lightDir), 0.0);
        diffuse += diff * baseColor * u_diffuseLight[i] * attenuation;

        // Specular component
        vec3 reflectDir = reflect(-lightDir, normal);
        float spec = pow(max(dot(viewDir, reflectDir), 0.0), u_shininess);
        specular += spec * u_specularLight[i] * attenuation;
    }

    outColor = ambient + diffuse + specular;
}
