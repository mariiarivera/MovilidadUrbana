#version 300 es
precision highp float;

in vec4 v_color;
in vec2 v_texcoord;

uniform sampler2D u_texture;
uniform bool u_useTexture;
uniform bool u_useVertexColor;  // NEW
uniform vec4 u_color;

out vec4 outColor;

void main() {
    if (u_useTexture) {
        outColor = texture(u_texture, v_texcoord);
    } else if (u_useVertexColor) {
        outColor = v_color;      // use vertex color from OBJ
    } else {
        outColor = u_color;      // use uniform color
    }
}
