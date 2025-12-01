#version 300 es
precision highp float;

in vec4 v_color;
in vec2 v_texcoord;

uniform sampler2D u_texture;
uniform bool u_useTexture;        // use texture instead of color
uniform bool u_useVertexColor;    // use vertex color
uniform vec4 u_color;             // fallback uniform color

out vec4 outColor;

void main() {
    if (u_useTexture) {
        outColor = texture(u_texture, v_texcoord);
    } else if (u_useVertexColor) {
        outColor = v_color;
    } else {
        outColor = u_color;
    }
}
