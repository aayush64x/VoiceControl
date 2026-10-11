"use strict";(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[8808],{8808:(e,t,i)=>{i.d(t,{a:()=>d,b:()=>u,c:()=>v,d:()=>x,e:()=>y,f:()=>S,g:()=>b,h:()=>_,i:()=>P,j:()=>R,k:()=>L,l:()=>V});var a=i(7717),s=i(6085),r=i(4940),o=i(3730),n=i(6114),l=i(9855),h=new l.dd;h.setAttribute("position",new l.Zc(new Float32Array([-1,-1,0,3,-1,0,-1,3,0]),3));var p=class extends l.de{constructor(e){super({...e,depthTest:!1,depthWrite:!1,glslVersion:l.nc,vertexShader:"\n				precision highp float;\n				in vec3 position;\n				void main() {\n					gl_Position = vec4(position, 1);\n				}\n			"})}customProgramCacheKey(){return""}};function d(){return{shapeInput:()=>"\n			const float posRowCoord = 0.1;  \n			const float quatRowCoord = 0.3;  \n			const float param1RowCoord = 0.5;\n			const float param2RowCoord = 0.7;\n			const float colorRowCoord = 0.9; \n			uniform sampler2D shapesDataTexture;\n			vec4 shapePos(float iin) { \n				vec4 r = texture(shapesDataTexture, vec2(iin, posRowCoord));\n				return r;\n			}\n			vec4 shapeQuat(float iin) {\n				vec4 r = texture(shapesDataTexture, vec2(iin, quatRowCoord));\n				return r;\n			}\n			vec4 shapeParams1(float iin) {\n				vec4 r = texture(shapesDataTexture, vec2(iin, param1RowCoord));\n				return r;\n			}\n			vec4 shapeParams2(float iin) {\n				vec4 r = texture(shapesDataTexture, vec2(iin, param2RowCoord));\n				return r;\n			}\n			vec4 shapeColor(float iin) {\n				vec4 r = texture(shapesDataTexture, vec2(iin, colorRowCoord));\n				return r;\n			}\n		",getxyzi:"\n			// this code must complement lookup\n			float xi = mod(gl_FragCoord.x - 0.5, VOXEL_RESOLUTION);\n			float yi = mod(gl_FragCoord.y - 0.5, VOXEL_RESOLUTION);\n			float zi = floor((gl_FragCoord.x - 0.5) * INV_VOXEL_RESOLUTION) + floor((gl_FragCoord.y - 0.5) * INV_VOXEL_RESOLUTION) * Z_LAYERS_PER_ROW;\n		",lookup:"\n			uniform sampler2D potentialPassTexture;\n			uniform sampler2D voxelPassTexture; \n			\n			\n			\n			vec4 look(float xi, float yi, float zi, sampler2D rt) {\n				vec2 uv = vec2(\n					mod(zi, Z_LAYERS_PER_ROW) + (xi + 0.5) / VOXEL_RESOLUTION,\n					floor(zi / Z_LAYERS_PER_ROW) + (yi + 0.5) / VOXEL_RESOLUTION\n				); \n				uv /= Z_LAYERS_PER_ROW;\n				return texture(rt, uv);\n			}\n		",getpart:"\n			float getpart(inout float a, float b) {\n				float t = floor(a/b);\n				float r = a - t*b;\n				a = t;\n				return r;\n			}\n		",triTable:new Float32Array([-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,3,8,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,9,1,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,3,8,1,1,8,9,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,10,2,1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,3,8,0,10,2,1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,10,2,9,9,2,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,3,8,2,8,10,2,8,9,10,-1,-1,-1,-1,-1,-1,-1,2,11,3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,2,11,0,0,11,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,9,1,11,3,2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,2,11,1,11,9,1,11,8,9,-1,-1,-1,-1,-1,-1,-1,1,10,3,3,10,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,1,10,0,10,8,0,10,11,8,-1,-1,-1,-1,-1,-1,-1,0,9,3,9,11,3,9,10,11,-1,-1,-1,-1,-1,-1,-1,10,8,9,11,8,10,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,7,4,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,3,4,4,3,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,9,1,0,7,4,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,9,1,4,1,7,4,1,3,7,-1,-1,-1,-1,-1,-1,-1,10,2,1,7,4,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,7,4,3,4,0,3,10,2,1,-1,-1,-1,-1,-1,-1,-1,10,2,9,2,0,9,7,4,8,-1,-1,-1,-1,-1,-1,-1,9,10,2,7,9,2,3,7,2,4,9,7,-1,-1,-1,-1,7,4,8,2,11,3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,7,4,11,4,2,11,4,0,2,-1,-1,-1,-1,-1,-1,-1,1,0,9,7,4,8,11,3,2,-1,-1,-1,-1,-1,-1,-1,11,7,4,11,4,9,2,11,9,1,2,9,-1,-1,-1,-1,1,10,3,10,11,3,4,8,7,-1,-1,-1,-1,-1,-1,-1,10,11,1,11,4,1,4,0,1,4,11,7,-1,-1,-1,-1,8,7,4,11,0,9,10,11,9,3,0,11,-1,-1,-1,-1,11,7,4,9,11,4,10,11,9,-1,-1,-1,-1,-1,-1,-1,4,5,9,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,4,5,9,3,8,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,4,5,0,0,5,1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,4,5,8,5,3,8,5,1,3,-1,-1,-1,-1,-1,-1,-1,10,2,1,4,5,9,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,0,3,10,2,1,5,9,4,-1,-1,-1,-1,-1,-1,-1,10,2,5,2,4,5,2,0,4,-1,-1,-1,-1,-1,-1,-1,5,10,2,5,2,3,4,5,3,8,4,3,-1,-1,-1,-1,4,5,9,11,3,2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,2,11,0,11,8,0,5,9,4,-1,-1,-1,-1,-1,-1,-1,4,5,0,5,1,0,11,3,2,-1,-1,-1,-1,-1,-1,-1,5,1,2,8,5,2,11,8,2,5,8,4,-1,-1,-1,-1,11,3,10,3,1,10,4,5,9,-1,-1,-1,-1,-1,-1,-1,5,9,4,1,8,0,1,10,8,10,11,8,-1,-1,-1,-1,0,4,5,11,0,5,10,11,5,3,0,11,-1,-1,-1,-1,8,4,5,10,8,5,11,8,10,-1,-1,-1,-1,-1,-1,-1,8,7,9,9,7,5,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,3,9,3,5,9,3,7,5,-1,-1,-1,-1,-1,-1,-1,8,7,0,7,1,0,7,5,1,-1,-1,-1,-1,-1,-1,-1,3,5,1,7,5,3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,7,9,7,5,9,2,1,10,-1,-1,-1,-1,-1,-1,-1,2,1,10,0,5,9,0,3,5,3,7,5,-1,-1,-1,-1,2,0,8,5,2,8,7,5,8,2,5,10,-1,-1,-1,-1,5,10,2,3,5,2,7,5,3,-1,-1,-1,-1,-1,-1,-1,5,9,7,9,8,7,2,11,3,-1,-1,-1,-1,-1,-1,-1,7,5,9,2,7,9,0,2,9,11,7,2,-1,-1,-1,-1,11,3,2,8,1,0,8,7,1,7,5,1,-1,-1,-1,-1,1,2,11,7,1,11,5,1,7,-1,-1,-1,-1,-1,-1,-1,8,5,9,7,5,8,3,1,10,11,3,10,-1,-1,-1,-1,0,7,5,9,0,5,0,11,7,10,0,1,0,10,11,-1,0,10,11,3,0,11,0,5,10,7,0,8,0,7,5,-1,5,10,11,5,11,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,5,6,10,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,3,8,0,6,10,5,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,1,0,9,6,10,5,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,3,8,1,8,9,1,6,10,5,-1,-1,-1,-1,-1,-1,-1,5,6,1,1,6,2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,5,6,1,6,2,1,8,0,3,-1,-1,-1,-1,-1,-1,-1,5,6,9,6,0,9,6,2,0,-1,-1,-1,-1,-1,-1,-1,8,9,5,2,8,5,6,2,5,8,2,3,-1,-1,-1,-1,11,3,2,5,6,10,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,0,11,0,2,11,5,6,10,-1,-1,-1,-1,-1,-1,-1,9,1,0,11,3,2,6,10,5,-1,-1,-1,-1,-1,-1,-1,6,10,5,2,9,1,2,11,9,11,8,9,-1,-1,-1,-1,11,3,6,3,5,6,3,1,5,-1,-1,-1,-1,-1,-1,-1,11,8,0,5,11,0,1,5,0,6,11,5,-1,-1,-1,-1,6,11,3,6,3,0,5,6,0,9,5,0,-1,-1,-1,-1,9,5,6,11,9,6,8,9,11,-1,-1,-1,-1,-1,-1,-1,6,10,5,8,7,4,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,3,4,3,7,4,10,5,6,-1,-1,-1,-1,-1,-1,-1,0,9,1,6,10,5,7,4,8,-1,-1,-1,-1,-1,-1,-1,5,6,10,7,9,1,3,7,1,4,9,7,-1,-1,-1,-1,2,1,6,1,5,6,8,7,4,-1,-1,-1,-1,-1,-1,-1,5,2,1,6,2,5,4,0,3,7,4,3,-1,-1,-1,-1,7,4,8,5,0,9,5,6,0,6,2,0,-1,-1,-1,-1,9,3,7,4,9,7,9,2,3,6,9,5,9,6,2,-1,2,11,3,4,8,7,5,6,10,-1,-1,-1,-1,-1,-1,-1,6,10,5,2,7,4,0,2,4,11,7,2,-1,-1,-1,-1,9,1,0,8,7,4,11,3,2,6,10,5,-1,-1,-1,-1,1,2,9,2,11,9,11,4,9,4,11,7,6,10,5,-1,7,4,8,5,11,3,1,5,3,6,11,5,-1,-1,-1,-1,11,1,5,6,11,5,11,0,1,4,11,7,11,4,0,-1,9,5,0,5,6,0,6,3,0,3,6,11,7,4,8,-1,9,5,6,11,9,6,9,7,4,9,11,7,-1,-1,-1,-1,9,4,10,10,4,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,6,10,4,10,9,4,3,8,0,-1,-1,-1,-1,-1,-1,-1,1,0,10,0,6,10,0,4,6,-1,-1,-1,-1,-1,-1,-1,1,3,8,6,1,8,4,6,8,10,1,6,-1,-1,-1,-1,9,4,1,4,2,1,4,6,2,-1,-1,-1,-1,-1,-1,-1,8,0,3,9,2,1,9,4,2,4,6,2,-1,-1,-1,-1,4,2,0,6,2,4,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,2,3,8,4,2,8,6,2,4,-1,-1,-1,-1,-1,-1,-1,9,4,10,4,6,10,3,2,11,-1,-1,-1,-1,-1,-1,-1,2,8,0,11,8,2,10,9,4,6,10,4,-1,-1,-1,-1,2,11,3,6,1,0,4,6,0,10,1,6,-1,-1,-1,-1,1,4,6,10,1,6,1,8,4,11,1,2,1,11,8,-1,4,6,9,6,3,9,3,1,9,3,6,11,-1,-1,-1,-1,1,11,8,0,1,8,1,6,11,4,1,9,1,4,6,-1,6,11,3,0,6,3,4,6,0,-1,-1,-1,-1,-1,-1,-1,8,4,6,8,6,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,6,10,7,10,8,7,10,9,8,-1,-1,-1,-1,-1,-1,-1,3,7,0,7,10,0,10,9,0,10,7,6,-1,-1,-1,-1,7,6,10,7,10,1,8,7,1,0,8,1,-1,-1,-1,-1,7,6,10,1,7,10,3,7,1,-1,-1,-1,-1,-1,-1,-1,6,2,1,8,6,1,9,8,1,7,6,8,-1,-1,-1,-1,9,6,2,1,9,2,9,7,6,3,9,0,9,3,7,-1,0,8,7,6,0,7,2,0,6,-1,-1,-1,-1,-1,-1,-1,2,3,7,2,7,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,11,3,2,8,6,10,9,8,10,7,6,8,-1,-1,-1,-1,7,0,2,11,7,2,7,9,0,10,7,6,7,10,9,-1,0,8,1,8,7,1,7,10,1,10,7,6,11,3,2,-1,1,2,11,7,1,11,1,6,10,1,7,6,-1,-1,-1,-1,6,9,8,7,6,8,6,1,9,3,6,11,6,3,1,-1,1,9,0,7,6,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,8,7,6,0,7,0,11,3,0,6,11,-1,-1,-1,-1,6,11,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,11,6,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,0,3,6,7,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,9,1,0,6,7,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,9,1,8,1,3,8,6,7,11,-1,-1,-1,-1,-1,-1,-1,2,1,10,7,11,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,10,2,1,8,0,3,7,11,6,-1,-1,-1,-1,-1,-1,-1,0,9,2,9,10,2,7,11,6,-1,-1,-1,-1,-1,-1,-1,7,11,6,3,10,2,3,8,10,8,9,10,-1,-1,-1,-1,3,2,7,7,2,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,0,7,0,6,7,0,2,6,-1,-1,-1,-1,-1,-1,-1,6,7,2,7,3,2,9,1,0,-1,-1,-1,-1,-1,-1,-1,2,6,1,6,8,1,8,9,1,6,7,8,-1,-1,-1,-1,6,7,10,7,1,10,7,3,1,-1,-1,-1,-1,-1,-1,-1,6,7,10,10,7,1,7,8,1,8,0,1,-1,-1,-1,-1,7,3,0,10,7,0,9,10,0,7,10,6,-1,-1,-1,-1,10,6,7,8,10,7,9,10,8,-1,-1,-1,-1,-1,-1,-1,4,8,6,6,8,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,11,6,3,6,0,3,6,4,0,-1,-1,-1,-1,-1,-1,-1,11,6,8,6,4,8,1,0,9,-1,-1,-1,-1,-1,-1,-1,6,4,9,3,6,9,1,3,9,6,3,11,-1,-1,-1,-1,4,8,6,8,11,6,1,10,2,-1,-1,-1,-1,-1,-1,-1,10,2,1,11,0,3,11,6,0,6,4,0,-1,-1,-1,-1,8,11,4,11,6,4,9,2,0,9,10,2,-1,-1,-1,-1,3,9,10,2,3,10,3,4,9,6,3,11,3,6,4,-1,3,2,8,2,4,8,2,6,4,-1,-1,-1,-1,-1,-1,-1,2,4,0,2,6,4,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,9,1,4,3,2,6,4,2,8,3,4,-1,-1,-1,-1,4,9,1,2,4,1,6,4,2,-1,-1,-1,-1,-1,-1,-1,3,1,8,1,6,8,6,4,8,1,10,6,-1,-1,-1,-1,0,1,10,6,0,10,4,0,6,-1,-1,-1,-1,-1,-1,-1,3,6,4,8,3,4,3,10,6,9,3,0,3,9,10,-1,4,9,10,4,10,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,5,9,4,11,6,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,3,8,0,5,9,4,6,7,11,-1,-1,-1,-1,-1,-1,-1,1,0,5,0,4,5,11,6,7,-1,-1,-1,-1,-1,-1,-1,6,7,11,4,3,8,4,5,3,5,1,3,-1,-1,-1,-1,4,5,9,2,1,10,11,6,7,-1,-1,-1,-1,-1,-1,-1,7,11,6,10,2,1,3,8,0,5,9,4,-1,-1,-1,-1,11,6,7,10,4,5,10,2,4,2,0,4,-1,-1,-1,-1,8,4,3,4,5,3,5,2,3,2,5,10,6,7,11,-1,3,2,7,2,6,7,9,4,5,-1,-1,-1,-1,-1,-1,-1,4,5,9,6,8,0,2,6,0,7,8,6,-1,-1,-1,-1,2,6,3,6,7,3,0,5,1,0,4,5,-1,-1,-1,-1,8,2,6,7,8,6,8,1,2,5,8,4,8,5,1,-1,4,5,9,6,1,10,6,7,1,7,3,1,-1,-1,-1,-1,10,6,1,6,7,1,7,0,1,0,7,8,4,5,9,-1,10,0,4,5,10,4,10,3,0,7,10,6,10,7,3,-1,10,6,7,8,10,7,10,4,5,10,8,4,-1,-1,-1,-1,5,9,6,9,11,6,9,8,11,-1,-1,-1,-1,-1,-1,-1,11,6,3,3,6,0,6,5,0,5,9,0,-1,-1,-1,-1,8,11,0,11,5,0,5,1,0,11,6,5,-1,-1,-1,-1,3,11,6,5,3,6,1,3,5,-1,-1,-1,-1,-1,-1,-1,10,2,1,11,5,9,8,11,9,6,5,11,-1,-1,-1,-1,3,11,0,11,6,0,6,9,0,9,6,5,10,2,1,-1,5,8,11,6,5,11,5,0,8,2,5,10,5,2,0,-1,3,11,6,5,3,6,3,10,2,3,5,10,-1,-1,-1,-1,9,8,5,8,2,5,2,6,5,2,8,3,-1,-1,-1,-1,6,5,9,0,6,9,2,6,0,-1,-1,-1,-1,-1,-1,-1,8,5,1,0,8,1,8,6,5,2,8,3,8,2,6,-1,6,5,1,6,1,2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,6,3,1,10,6,1,6,8,3,9,6,5,6,9,8,-1,0,1,10,6,0,10,0,5,9,0,6,5,-1,-1,-1,-1,8,3,0,10,6,5,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,6,5,10,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,10,5,11,11,5,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,10,5,11,5,7,11,0,3,8,-1,-1,-1,-1,-1,-1,-1,7,11,5,11,10,5,0,9,1,-1,-1,-1,-1,-1,-1,-1,5,7,10,7,11,10,1,8,9,1,3,8,-1,-1,-1,-1,2,1,11,1,7,11,1,5,7,-1,-1,-1,-1,-1,-1,-1,3,8,0,7,2,1,5,7,1,11,2,7,-1,-1,-1,-1,5,7,9,7,2,9,2,0,9,7,11,2,-1,-1,-1,-1,2,5,7,11,2,7,2,9,5,8,2,3,2,8,9,-1,10,5,2,5,3,2,5,7,3,-1,-1,-1,-1,-1,-1,-1,0,2,8,2,5,8,5,7,8,5,2,10,-1,-1,-1,-1,1,0,9,3,10,5,7,3,5,2,10,3,-1,-1,-1,-1,2,8,9,1,2,9,2,7,8,5,2,10,2,5,7,-1,5,3,1,5,7,3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,7,8,0,1,7,0,5,7,1,-1,-1,-1,-1,-1,-1,-1,3,0,9,5,3,9,7,3,5,-1,-1,-1,-1,-1,-1,-1,7,8,9,7,9,5,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,4,8,5,8,10,5,8,11,10,-1,-1,-1,-1,-1,-1,-1,4,0,5,0,11,5,11,10,5,0,3,11,-1,-1,-1,-1,9,1,0,10,4,8,11,10,8,5,4,10,-1,-1,-1,-1,4,11,10,5,4,10,4,3,11,1,4,9,4,1,3,-1,1,5,2,5,8,2,8,11,2,8,5,4,-1,-1,-1,-1,11,4,0,3,11,0,11,5,4,1,11,2,11,1,5,-1,5,2,0,9,5,0,5,11,2,8,5,4,5,8,11,-1,5,4,9,3,11,2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,10,5,2,2,5,3,5,4,3,4,8,3,-1,-1,-1,-1,2,10,5,4,2,5,0,2,4,-1,-1,-1,-1,-1,-1,-1,2,10,3,10,5,3,5,8,3,8,5,4,9,1,0,-1,2,10,5,4,2,5,2,9,1,2,4,9,-1,-1,-1,-1,5,4,8,3,5,8,1,5,3,-1,-1,-1,-1,-1,-1,-1,5,4,0,5,0,1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,5,4,8,3,5,8,5,0,9,5,3,0,-1,-1,-1,-1,5,4,9,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,7,11,4,11,9,4,11,10,9,-1,-1,-1,-1,-1,-1,-1,3,8,0,7,9,4,7,11,9,11,10,9,-1,-1,-1,-1,11,10,1,4,11,1,0,4,1,11,4,7,-1,-1,-1,-1,4,1,3,8,4,3,4,10,1,11,4,7,4,11,10,-1,7,11,4,4,11,9,11,2,9,2,1,9,-1,-1,-1,-1,4,7,9,7,11,9,11,1,9,1,11,2,3,8,0,-1,4,7,11,2,4,11,0,4,2,-1,-1,-1,-1,-1,-1,-1,4,7,11,2,4,11,4,3,8,4,2,3,-1,-1,-1,-1,10,9,2,9,7,2,7,3,2,9,4,7,-1,-1,-1,-1,7,10,9,4,7,9,7,2,10,0,7,8,7,0,2,-1,10,7,3,2,10,3,10,4,7,0,10,1,10,0,4,-1,2,10,1,4,7,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,1,9,4,7,1,4,3,1,7,-1,-1,-1,-1,-1,-1,-1,1,9,4,7,1,4,1,8,0,1,7,8,-1,-1,-1,-1,3,0,4,3,4,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,7,8,4,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,10,9,8,11,10,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,9,0,3,11,9,3,10,9,11,-1,-1,-1,-1,-1,-1,-1,10,1,0,8,10,0,11,10,8,-1,-1,-1,-1,-1,-1,-1,10,1,3,10,3,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,11,2,1,9,11,1,8,11,9,-1,-1,-1,-1,-1,-1,-1,9,0,3,11,9,3,9,2,1,9,11,2,-1,-1,-1,-1,11,2,0,11,0,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,11,2,3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,3,2,10,8,2,9,8,10,-1,-1,-1,-1,-1,-1,-1,2,10,9,2,9,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,3,2,10,8,2,8,1,0,8,10,1,-1,-1,-1,-1,2,10,1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,3,1,8,1,9,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,1,9,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,3,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1]),numTrisTable:new Float32Array([0,1,1,2,1,2,2,3,1,2,2,3,2,3,3,2,1,2,2,3,2,3,3,4,2,3,3,4,3,4,4,3,1,2,2,3,2,3,3,4,2,3,3,4,3,4,4,3,2,3,3,2,3,4,4,3,3,4,4,3,4,5,5,2,1,2,2,3,2,3,3,4,2,3,3,4,3,4,4,3,2,3,3,4,3,4,4,5,3,4,4,5,4,5,5,4,2,3,3,4,3,4,2,3,3,4,4,5,4,5,3,2,3,4,4,3,4,5,3,2,4,5,5,4,5,2,4,1,1,2,2,3,2,3,3,4,2,3,3,4,3,4,4,3,2,3,3,4,3,4,4,5,3,2,4,3,4,3,5,2,2,3,3,4,3,4,4,5,3,4,4,5,4,5,5,4,3,4,4,3,4,5,5,4,4,3,5,2,5,4,2,1,2,3,3,4,3,4,4,5,3,4,4,5,2,3,3,2,3,4,4,5,4,5,5,2,4,3,5,4,3,2,4,1,3,4,4,5,4,5,3,4,4,5,5,2,3,4,2,1,2,3,3,2,3,4,2,1,3,2,4,1,2,1,1,0])}}var c=new l.we,f=null;function u(e){f=e}function v(){return f}var m=null;function x(e){m=e}function y(){return m}var g=null;function S(e){g=e}function b(){return g}var T=d(),_=24,P=96,z=!1,w=!0;try{let e=new URLSearchParams(window.location.search);z="0"===e.get("dbgsbstatic"),w="0"!==e.get("sb512")}catch{}function R(e){let t=e.getAttribute("position");return void 0===t?-1:1048576*(t.version??t.data?.version??0)+(t.count??0)%1048576}var O=class extends r.ja{constructor(e,t,i){super(e,t,i),this.data=t,this.isShapeBlendEntity=!0,this.needsRebuild=!0,this.customDepthMaterialNeedsUpdate=!1,this._prevShapeData=null,this._prevSpan=-1,this._reach=new Float32Array(96),this._prevReach=new Float32Array(96),this._fieldDirtyFull=!0,this._fieldDirtyMin=new l.Fc,this._fieldDirtyMax=new l.Fc,this._maxBlendK=0,this._meshSdfBaked=new Map,this._meshSdfWanted=new Map,this._passesRenderer=null,this._npart=-1,this.spatialn=1,this.drawRangeNeedsForceUpdate=!0,this._resolutionLevel=-1,this._authoredResolutionLevel=-1,this.ultraFieldResolution=0,this.resolution=64,this.spatialDivisions=25,this.zLayersPerRow=8,this.basePyramidSize=512,this.pyramidTexture1Width=341,this.pyramidTexture1Height=256,this.pyramidTexture2Width=170,this.pyramidTexture2Height=128,this.numLevels=9,this.pyramidLevelSizes=[1,2,4,8,16,32,64,128,256,512],this.bboxSize=0,this.bboxOffset=0,this.shapesDataTexture={value:void 0},this.spatialscene=new l.Vc,this.potentialPassScene=new l.Vc,this.voxelPassScene=new l.Vc,this._spatialPassRenderTargets=[],this._potentialPassRenderTargets=[],this._voxelPassRenderTargets=[],this._pyramidRenderTargets=[],this.geometry=new l.dd,this.geometry.drawRange.count=0,this.spatialPassUniforms={span:{value:-1},shapesDataTexture:this.shapesDataTexture,npart:{value:this.npart},spatialn:{value:this.spatialn}},this.spatialMesh=new l.ld(h,this.spatialPassMaterial()),this.spatialMesh.frustumCulled=!1,this.spatialscene.add(this.spatialMesh);let a=new l.nd(T.triTable,16,256,l.Ma,l.Aa);a.needsUpdate=!0;let s=new l.nd(T.numTrisTable,256,1,l.Ma,l.Aa);s.needsUpdate=!0,this.voxelPassUniforms={potentialPassTexture:{value:void 0},numTrisTable:{value:s}},this.voxelMesh=new l.ld(h,this.voxelPassMaterial()),this.voxelMesh.frustumCulled=!1,this.voxelPassScene.add(this.voxelMesh),this.potentialPassUniforms={shapesDataTexture:this.shapesDataTexture,spatialPassTexture:{value:void 0},npart:{value:this.npart},spatialn:{value:this.spatialn}},this.potentialMesh=new l.ld(h,this.potentialPassMaterial()),this.potentialMesh.frustumCulled=!1,this.potentialPassScene.add(this.potentialMesh),this.marchPassUniforms={triTable:{value:a},potentialPassTexture:{value:void 0},voxelPassTexture:{value:void 0},pyramidTexture1:{value:void 0},pyramidTexture1Size:{value:void 0},pyramidTexture2:{value:void 0},pyramidTexture2Size:{value:void 0}},this.frustumCulled=!1,this.onBeforeShadowPass=e=>{let t=I.call(this);if(0===this.npart)return void(this.geometry.drawRange.count=0);let i=this.material.root;if(i.shadersPatchedForShapeBlend){if(this.customDepthMaterialNeedsUpdate){this.customDepthMaterialNeedsUpdate=!1,this.customDepthMaterial=new l.ce({vertexShader:i.vertexShader,fragmentShader:"\n						#include <packing>\n						void main()\n						{\n							gl_FragColor = packDepthToRGBA(gl_FragCoord.z);\n						}\n					",uniforms:i.uniforms,defines:this.material.defines}),this.isMeshDepthMaterial=!0,this.customDistanceMaterial=new l.ce({vertexShader:i.vertexShader,fragmentShader:"\n					#include <common>\n					#include <packing>\n					uniform vec3 referencePosition;\n					uniform float nearDistance;\n					uniform float farDistance;\n					\n					varying vec3 vWPosition;\n					void main()\n					{\n						float dist = length(vWPosition - referencePosition);\n						dist = (dist - nearDistance) / (farDistance - nearDistance);\n						dist = saturate(dist);\n						\n						gl_FragColor = packDepthToRGBA( dist );\n					}",uniforms:{nearDistance:{value:0},farDistance:{value:0},referencePosition:{value:new l.Fc},opacity:{value:0},...i.uniforms},defines:this.material.defines});let e=this.customDistanceMaterial;e.referencePosition=new l.Fc,e.nearDistance=0,e.farDistance=0,e.opacity=1,e.isMeshDistanceMaterial=!0}}else this.patchVertexShaderForShapeBlend(i),i.shadersPatchedForShapeBlend=!0,this.customDepthMaterialNeedsUpdate=!0;this.spatialPassUniforms.npart.value=this.npart,this.spatialPassUniforms.spatialn.value=this.spatialn,this.potentialPassUniforms.npart.value=this.npart,this.potentialPassUniforms.spatialn.value=this.spatialn;let a=this.needsRebuild;if(this.needsRebuild){this.needsRebuild=!1,this.spatialMesh.material.defines.RES=this.resolutionLevel,this.spatialMesh.material.needsUpdate=!0,this.potentialMesh.material.defines.RES=this.resolutionLevel,this.potentialPassUniforms.spatialPassTexture.value=this.spatialPassRenderTarget.texture,this.potentialMesh.material.needsUpdate=!0,this.voxelMesh.material.defines.RES=this.resolutionLevel,this.voxelMesh.material.needsUpdate=!0,this.voxelPassUniforms.potentialPassTexture.value=this.potentialPassRenderTarget.texture,this.marchPassUniforms.potentialPassTexture.value=this.potentialPassRenderTarget.texture,this.marchPassUniforms.voxelPassTexture.value=this.voxelPassRenderTarget.textures[0],this.material.defines.RES=this.resolutionLevel,this.material.defines.LEVELS=this.pyramidLevelSizes.length,this.material.defines.LOOP=this.pyramidLevelSizes.length%2==0?this.pyramidLevelSizes.length-3:this.pyramidLevelSizes.length-2,this.material.defines.HALF=+(this.pyramidLevelSizes.length%2==0),this.material.needsUpdate=!0;let e=+(this.pyramidLevelSizes.length%2!=0),t=+(this.pyramidLevelSizes.length%2==0);this.marchPassUniforms.pyramidTexture2.value=this.pyramidRenderTarget[e].texture,this.marchPassUniforms.pyramidTexture2Size.value=new l.Dc(this.pyramidRenderTarget[e].width,this.pyramidRenderTarget[e].height),this.marchPassUniforms.pyramidTexture1.value=this.pyramidRenderTarget[t].texture,this.marchPassUniforms.pyramidTexture1Size.value=new l.Dc(this.pyramidRenderTarget[t].width,this.pyramidRenderTarget[t].height),Object.assign(this.material.uniforms,this.marchPassUniforms)}if(!t&&!a&&!this.drawRangeNeedsForceUpdate&&this._passesRenderer===e)return;this._passesRenderer=e;let s=e.shadowMap.enabled;e.shadowMap.enabled=!1;let r=e.getRenderTarget();e.setRenderTarget(this.spatialPassRenderTarget),e.render(this.spatialscene,c),e.setRenderTarget(this.potentialPassRenderTarget),e.render(this.potentialPassScene,c),e.setRenderTarget(this.voxelPassRenderTarget),e.render(this.voxelPassScene,c),O.streamCompaction.renderPyramid(this.resolutionLevel,this.pyramidLevelSizes,e,this.voxelPassRenderTarget,this.pyramidRenderTarget).then(e=>{this.material.wireframe&&(3*e>this.geometry.attributes.position.count||this.drawRangeNeedsForceUpdate)&&(this.geometry.dispose(),this.geometry=new l.dd,this.geometry.userData.parameters={width:this.bboxSize,height:this.bboxSize,depth:this.bboxSize,centerOffset:[this.bboxOffset,this.bboxOffset,this.bboxOffset]},this.geometry.attributes.position=new l.Zc(new Float32Array(3*e*2),3)),(3*e>this.geometry.drawRange.count||this.drawRangeNeedsForceUpdate)&&(this.geometry.drawRange.count=3*Math.floor(1.2*e),this.markSceneShadowsDirty()),this.drawRangeNeedsForceUpdate=!1}),e.shadowMap.enabled=s,e.setRenderTarget(r)}}markSceneShadowsDirty(){let e=this.parent;if(null!==e){for(;e.parent;)e=e.parent;e.markShadowsDirty?.()}}set npart(e){e!==this._npart&&(this.drawRangeNeedsForceUpdate=!0,this._npart=e,this.spatialn=Math.ceil(e/96))}get npart(){return this._npart}set resolutionLevel(e){let t=Math.min(w?9:8,Math.max(5,e));if(t===this._authoredResolutionLevel)return;this._authoredResolutionLevel=t,this.ultraFieldResolution=Math.pow(2,t);let i=Math.min(8,t);switch(this._resolutionLevel=i,this.resolution=Math.pow(2,i),this.resolutionLevel){case 5:this.pyramidLevelSizes=[1,2,4,6,12,24,48,96,192],this.bboxSize=496,this.bboxOffset=-8;break;case 6:this.pyramidLevelSizes=[1,2,4,8,16,32,64,128,256,512],this.bboxSize=504,this.bboxOffset=-4;break;case 7:this.pyramidLevelSizes=[1,2,4,6,12,24,48,96,192,384,768,1536],this.bboxSize=508,this.bboxOffset=-2;break;case 8:this.pyramidLevelSizes=[1,2,4,8,16,32,64,128,256,512,1024,2048,4096],this.bboxSize=510,this.bboxOffset=-1}this.pyramidTexture1Width=0,this.pyramidTexture2Width=0,this.pyramidTexture1Height=this.pyramidLevelSizes[this.pyramidLevelSizes.length-2],this.pyramidTexture2Height=this.pyramidLevelSizes[this.pyramidLevelSizes.length-3];for(let e=this.pyramidLevelSizes.length-2;e>=0;e--)(this.pyramidLevelSizes.length-2)%2==e%2?this.pyramidTexture1Width+=this.pyramidLevelSizes[e]:this.pyramidTexture2Width+=this.pyramidLevelSizes[e];this.basePyramidSize=this.pyramidLevelSizes[this.pyramidLevelSizes.length-1],this.zLayersPerRow=this.basePyramidSize/this.resolution,this.numLevels=this.pyramidLevelSizes.length-1,this.geometry.userData.parameters={width:this.bboxSize,height:this.bboxSize,depth:this.bboxSize,centerOffset:[this.bboxOffset,this.bboxOffset,this.bboxOffset]},this.needsRebuild=!0,this.customDepthMaterialNeedsUpdate=!0}get resolutionLevel(){return this._resolutionLevel}get spatialPassRenderTarget(){let e=this._spatialPassRenderTargets[this.resolutionLevel];return e||(e=new l.Lc(this.spatialDivisions*this.spatialn,this.spatialDivisions**2,{format:l.Ja,type:l.Aa,stencilBuffer:!1,depthBuffer:!1,generateMipmaps:!1,minFilter:l.na,magFilter:l.na}),this._spatialPassRenderTargets[this.resolutionLevel]=e),e}get potentialPassRenderTarget(){let e=this._potentialPassRenderTargets[this.resolutionLevel];return e||(e=new l.Lc(this.basePyramidSize,this.basePyramidSize,{format:l.Ja,type:l.Aa,stencilBuffer:!1,depthBuffer:!1,generateMipmaps:!1,minFilter:l.na,magFilter:l.na}),this._potentialPassRenderTargets[this.resolutionLevel]=e),e}get voxelPassRenderTarget(){let e=this._voxelPassRenderTargets[this.resolutionLevel];return e||((e=new l.Lc(this.basePyramidSize,this.basePyramidSize,{count:2,stencilBuffer:!1,depthBuffer:!1,generateMipmaps:!1,minFilter:l.na,magFilter:l.na})).textures[0].format=l.Ja,e.textures[0].type=l.Aa,e.textures[1].format=l.Ma,e.textures[1].type=l.Aa,this._voxelPassRenderTargets[this.resolutionLevel]=e),e}get pyramidRenderTarget(){let e=this._pyramidRenderTargets[this.resolutionLevel];return e||(e=[new l.Lc(this.pyramidTexture1Width,this.pyramidTexture1Height,{format:l.Ja,type:l.Aa,stencilBuffer:!1,depthBuffer:!1,magFilter:l.na,minFilter:l.na}),new l.Lc(this.pyramidTexture2Width,this.pyramidTexture2Height,{format:l.Ja,type:l.Aa,stencilBuffer:!1,depthBuffer:!1,magFilter:l.na,minFilter:l.na})],this._pyramidRenderTargets[this.resolutionLevel]=e),e}updateGeometryInteractions(){}updateState(e,t){let i=this.material;super.updateState(e,t),i!==this.material&&(this.needsRebuild=!0),e.geometry&&(this.resolutionLevel=e.geometry.resolutionLevel,this.geometry.userData.parameters={width:this.bboxSize,height:this.bboxSize,depth:this.bboxSize,centerOffset:[this.bboxOffset,this.bboxOffset,this.bboxOffset]}),e.wireframe&&!this.geometry.getAttribute("position")?this.geometry.setAttribute("position",new l.Zc(new Float32Array(3*this.geometry.drawRange.count),3)):!e.wireframe&&this.geometry.getAttribute("position")&&this.geometry.deleteAttribute("position")}spatialPassMaterial(){return new p({name:"Spatial Pass",fragmentShader:`
			precision highp float;
			out vec4 pc_FragColor;
			const float spatialDivisions = ${this.spatialDivisions}.;
			uniform float span;
			uniform float npart;
			uniform float spatialn;
			${T.shapeInput()}

			vec3 low, high;     

			
			
			
			float spatialKey(float lowi) {
				float t = 0.;
				for (float ii = 23.; ii >= 0.; ii--) {
					float i = ii + lowi;
					float iin = (i + 0.5) / 96.;
					vec4 shape = shapePos(iin);
					vec3 d = shape.xyz;
					float op = shape.w;
	
					t *= 2.;
					t += (
						low.x < d.x && d.x < high.x &&
						low.y < d.y && d.y < high.y &&
						low.z < d.z && d.z < high.z &&
						i < npart || op == -2. 
					) ? 1. : 0.;
				}
				return t;
			}

			${T.getpart}

			void main() {               
				
				vec3 div;                               
				
				float yz = float(gl_FragCoord.y - 0.5);     
				div.y = getpart(yz, spatialDivisions);
				div.z = yz; 

				float lx = float(gl_FragCoord.x - 0.5);     
				float lowi = getpart(lx, spatialn) * 96.;
				div.x = lx;

				low = div / spatialDivisions * 2. - 1. - span;
				high = (div+1.) / spatialDivisions * 2. - 1. + span;

				
				pc_FragColor.x = spatialKey(lowi);
				pc_FragColor.y = spatialKey(lowi+24.);
				pc_FragColor.z = spatialKey(lowi+48.);
				pc_FragColor.w = spatialKey(lowi+72.);
			}
		`,uniforms:this.spatialPassUniforms})}potentialPassMaterial(){return new p({name:"PotentialPass",fragmentShader:`
			precision highp float;
			out vec4 pc_FragColor;

			${T.shapeInput()}
			uniform sampler2D spatialPassTexture;

			const float res = float(RES);
			const float VOXEL_RESOLUTION = pow(2., res);
			const float Z_LAYERS_PER_ROW = ceil(pow(2., res / 2.));
			const float VOXEL_RESOLUTION_SUB1 = VOXEL_RESOLUTION - 1.;
			const float INV_VOXEL_RESOLUTION = 1.0 / VOXEL_RESOLUTION;

			uniform float npart;
			uniform float spatialn;
			const float spatialDivisions = ${this.spatialDivisions}.;
			const float spatialDivisions2 = spatialDivisions * spatialDivisions;
			const float spatialDivisionsSub1 = spatialDivisions - 1.;

			${T.getpart}

			vec3 packRGBAToVec3(vec4 color) {
				uint r = uint(color.r * 255.);
				uint g = uint(color.g * 255.);
				uint combined = (r << 8) | g; 
				return vec3(float(combined) * 0.00001525902, color.b, color.a); 
			}

			void applyQuaternionToVector(in vec4 q, inout vec3 v) {
				v += 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
			}

			



			
			float smoothOperation(float op, float sdf, float d, float k) {
			  
			  
				

				float signSubtract = clamp(op, -1., 1.);
				float signIntersection = 2. * (op - signSubtract) + 1.;
				float h = clamp(
					0.5 + signSubtract * 0.5 * (sdf - signSubtract * signIntersection * d) / k,
					0.0,
					1.0
				);
				return mix(sdf, signSubtract * signIntersection * d, h) - 
							 signSubtract * k * h * (1.0 - h);
			}

			float sdSphere( vec3 p, float s )
			{
				return length(p)-s;
			}

			float sdEllipsoid( vec3 p, vec3 r )
			{
				float k0 = length(p/r);
				float k1 = length(p/(r*r));
				return k0*(k0-1.0)/k1;
			}

			float sdBox( vec3 p, vec3 b )
			{
				vec3 q = abs(p) - b;
				return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
			}

			float sdTorus( vec3 p, vec2 t )
			{
				vec2 q = vec2(length(p.xy)-t.x,p.z);
				return length(q)-t.y;
			}

			float sdCappedTorus( vec3 p, vec2 sc, float ra, float rb)
			{
				p.x = abs(p.x);
				float k = (sc.y*p.x>sc.x*p.y) ? dot(p.xy,sc) : length(p.xy);
				return sqrt( dot(p,p) + ra*ra - 2.0*ra*k ) - rb;
			}

			float dot2( in vec2 v ) { return dot(v,v); }
			float sdCappedCone( vec3 p, float h, float r1, float r2 )
			{
				vec2 q = vec2( length(p.xz), p.y );
				vec2 k1 = vec2(r2,h);
				vec2 k2 = vec2(r2-r1,2.0*h);
				vec2 ca = vec2(q.x-min(q.x,(q.y<0.0)?r1:r2), abs(q.y)-h);
				vec2 cb = q - k1 + k2*clamp( dot(k1-q,k2)/dot2(k2), 0.0, 1.0 );
				float s = (cb.x<0.0 && ca.y<0.0) ? -1.0 : 1.0;
				return s*sqrt( min(dot2(ca),dot2(cb)) );
			}

			float sdCappedCylinder( vec3 p, float h, float r )
			{
				vec2 d = abs(vec2(length(p.xz),p.y)) - vec2(r,h);
				return min(max(d.x,d.y),0.0) + length(max(d,0.0));
			}

			float maxBlend = 0.0;
			
			
			
			
			void fillSpatialInner(
				float ii,
				float activeKey,
				vec3 corner,
				inout float sdf,
				inout float colorDivisor,
				inout vec4 trackColor
			) {
				for (float i = 0.; i < 24.; i++) {
					if (activeKey < 1.) break; 
					activeKey *= 0.5;
					if (fract(activeKey) < 0.5) continue;

					float iin = (i + ii + 0.5) * ${1/96};
					vec4 shape = shapePos(iin);
					vec4 quat = shapeQuat(iin);
					vec4 params1 = shapeParams1(iin);
					vec4 params2 = shapeParams2(iin);

					vec3 p = corner - shape.xyz;
					applyQuaternionToVector(quat, p);
					p /= params2.z; // scale
					float d; // d in -1..1 coordinates
					switch (int(params1.x)) {
						case 0: d = sdSphere(p, params1.y); break;
						case 1: d = sdEllipsoid(p, params1.yzw); break;
						case 2: d = sdBox(p, params1.yzw); break;
						case 3: d = sdCappedCylinder(p, params1.y, params1.z); break;
						case 4: d = sdCappedCone(p, params1.y, params1.z, params1.w); break;
						case 5: d = sdTorus(p, params1.yz); break;
						case 6: d = sdCappedTorus(p, params1.yz, params1.w, params2.w); break;
						// Mesh children (type 7) live in a WebGPU-only baked SDF
						// atlas — the GLSL evaluator skips the shape entirely
						// (also closes the latent uninitialized-d default).
						default: continue;
					}
					d -= params2.y; // rounded edge
					d *= params2.z; // scale

					float k = params2.x;
					float op = shape.w;

					sdf = smoothOperation(shape.w, sdf, d, k);

					float isNegativeOne = step(-1.5, op) * step(op, -0.5); // 1 when op == -1, 0 otherwise
					float colorCull = smoothstep(maxBlend, 0., -d);
					float cullFactor = mix(1.0, colorCull, isNegativeOne);
					trackColor *= cullFactor;
					colorDivisor *= cullFactor;

					maxBlend = max(maxBlend, k);

					k += 2. * INV_VOXEL_RESOLUTION; // avoid division by zero, and other color artifacts with very small k
					float nearness = smoothstep(k, 0., d);

					vec4 color = shapeColor(iin);
					nearness *= float(color.a >= 0.);

					colorDivisor += nearness;
					trackColor += color * nearness;
				}
			}

			vec3 div;
			// compute potential from all spheres; collect +ve and =ve values separately
			// work in blocks of A*4 (=96) spheres, using the bit flags in 4 float channel 'activeKey' values
			// TODO check if extra vec3 output useful, not really used at present
			float fillSpatial(vec3 corner, inout vec4 trackColor) {
				float sdf = 1e3; // hack: initialize to large value
				float colorDivisor = 0.;
				// spatialPassTexture holds x=> lowi, x faster moving and y=> z, y faster moving
				float divyz = (div.y + div.z * spatialDivisions + 0.5) / (spatialDivisions2);
				for (float ii = 0.; ii < spatialn; ii++) {
					float i = ii * 96.;

					vec4 activeKey = texture(spatialPassTexture, vec2((div.x * spatialn + ii + 0.5)/(spatialn * spatialDivisions), divyz));
					fillSpatialInner(i, activeKey.x, corner, sdf, colorDivisor, trackColor);
					fillSpatialInner(i+24., activeKey.y, corner, sdf, colorDivisor, trackColor);
					fillSpatialInner(i+48., activeKey.z, corner, sdf, colorDivisor, trackColor);
					fillSpatialInner(i+72., activeKey.w, corner, sdf, colorDivisor, trackColor);
				}

				trackColor /= colorDivisor;
				return mix(sdf, 0.0, step(1e20 - 0.1, sdf));
			}

			void main() {
				${T.getxyzi}    

				vec3 xyzi = vec3(xi,yi,zi);
				vec3 corner = xyzi / VOXEL_RESOLUTION_SUB1 * 2. - 1.;  

				div = floor(xyzi / VOXEL_RESOLUTION_SUB1 * spatialDivisionsSub1);

				vec4 c = vec4(0.);
				float t = fillSpatial(corner, c);

				pc_FragColor = vec4(t, packRGBAToVec3(c)); 
			}
		`,uniforms:this.potentialPassUniforms})}voxelPassMaterial(){return new p({name:"VoxelPass",fragmentShader:`
			precision highp float;
			layout(location = 0) out vec4 pc_FragColor;
			layout(location = 1) out vec4 numTris;

			const float res = float(RES);
			const float VOXEL_RESOLUTION = pow(2., res);
			const float VOXEL_RESOLUTION_SUB1 = VOXEL_RESOLUTION - 1.; 
			const float Z_LAYERS_PER_ROW = ceil(pow(2., res / 2.));
			const float INV_VOXEL_RESOLUTION = 1.0 / VOXEL_RESOLUTION;
			uniform sampler2D numTrisTable; 

			float keyi(float f000, float f100, float f010, float f110, float f001, float f101, float f011, float f111) {
				return (float(f000 < 0.) * 1.) +
							 (float(f100 < 0.) * 2.) +
							 (float(f010 < 0.) * 8.) +
							 (float(f110 < 0.) * 4.) +
							 (float(f001 < 0.) * 16.) +
							 (float(f101 < 0.) * 32.) +
							 (float(f011 < 0.) * 128.) +
							 (float(f111 < 0.) * 64.);
			}

			${T.lookup}

			vec3 compNormi(float xi, float yi, float zi) {
				float dx = look(xi + 1., yi, zi, potentialPassTexture).r - look(xi - 1., yi, zi, potentialPassTexture).r;
				float dy = look(xi, yi + 1., zi, potentialPassTexture).r - look(xi, yi - 1., zi, potentialPassTexture).r;
				float dz = look(xi, yi, zi + 1., potentialPassTexture).r - look(xi, yi, zi - 1., potentialPassTexture).r;
				
				
				if (dx == 0.0 && dy == 0.0 && dz == 0.0) {
					return vec3(0.199, 0.299, 0.399);
				}
				return normalize(vec3(dx, dy, dz));
			}

			void main() {
				${T.getxyzi}    

				vec3 normal = compNormi(xi, yi, zi);  

				if (xi >= VOXEL_RESOLUTION_SUB1 || yi >= VOXEL_RESOLUTION_SUB1 || zi >= VOXEL_RESOLUTION_SUB1) {
					pc_FragColor = vec4(normal, 0.);
					numTris = vec4(0.);
					return;
				}

				float
					f000 = look(xi, yi, zi, potentialPassTexture).r,
					f100 = look(xi+1., yi, zi, potentialPassTexture).r,
					f010 = look(xi, yi+1., zi, potentialPassTexture).r,
					f110 = look(xi+1., yi+1., zi, potentialPassTexture).r,
					f001 = look(xi, yi, zi+1., potentialPassTexture).r,
					f101 = look(xi+1., yi, zi+1., potentialPassTexture).r,
					f011 = look(xi, yi+1., zi+1., potentialPassTexture).r,
					f111 = look(xi+1., yi+1., zi+1., potentialPassTexture).r;
				float key = keyi(f000, f100, f010, f110, f001, f101, f011, f111);

				pc_FragColor = vec4(normal, key);

				numTris = texture(numTrisTable, vec2((key + 0.5) / 256., 0.5));
			}
		`,uniforms:this.voxelPassUniforms})}patchVertexShaderForShapeBlend(e){e.vertexShader=`
		#ifdef SHAPEBLEND 
			precision highp sampler2D;

			uniform float isol;

			uniform sampler2D triTable;     
			uniform sampler2D pyramidTexture1;
			uniform vec2 pyramidTexture1Size;
			uniform sampler2D pyramidTexture2;
			uniform vec2 pyramidTexture2Size;

			const vec2 halfPixelOffset = vec2(0.5, 0.5);

			const vec2 rShift = vec2(0., 1.);
			const vec2 gShift = vec2(1., 1.);
			const vec2 bShift = vec2(1., 0.);

			const float res = float(RES);
			const float VOXEL_RESOLUTION = pow(2., res);
			const float Z_LAYERS_PER_ROW = ceil(pow(2., res / 2.));
			const float INV_VOXEL_RESOLUTION = 1.0 / VOXEL_RESOLUTION;

			const float scale_factor = 2.;

			#if SHAPEBLEND == 5
				const float levelShiftX[7] = float[7](4., 6., 12., 24., 48., 96., 192.);
				const float scale = 8. * scale_factor;
				const vec3 originOffset = vec3(16.);
			#elif SHAPEBLEND == 7
				const float levelShiftX[10] = float[10](4., 6., 12., 24., 48., 96., 192., 384., 768., 1536.); 
				const float scale = 2. * scale_factor;
				const vec3 originOffset = vec3(64.);
			#elif SHAPEBLEND == 8
				const float levelShiftX[11] = float[11](4., 8., 16., 32., 64., 128., 256., 512., 1024., 2048., 4096.);
				const float scale = scale_factor;
				const vec3 originOffset = vec3(128.);
			#else
				const float levelShiftX[8] = float[8](4., 8., 16., 32., 64., 128., 256., 512.);
				const float scale = 4. * scale_factor;
				const vec3 originOffset = vec3(32.);
			#endif

			${T.lookup}

			const vec3 offsets[24] = vec3[](
				vec3(0., 0., 0.), vec3(1., 0., 0.),
				vec3(1., 0., 0.), vec3(1., 1., 0.),
				vec3(0., 1., 0.), vec3(1., 1., 0.),
				vec3(0., 0., 0.), vec3(0., 1., 0.),
				vec3(0., 0., 1.), vec3(1., 0., 1.),
				vec3(1., 0., 1.), vec3(1., 1., 1.),
				vec3(0., 1., 1.), vec3(1., 1., 1.),
				vec3(0., 0., 1.), vec3(0., 1., 1.),
				vec3(0., 0., 0.), vec3(0., 0., 1.),
				vec3(1., 0., 0.), vec3(1., 0., 1.),
				vec3(1., 1., 0.), vec3(1., 1., 1.),
				vec3(0., 1., 0.), vec3(0., 1., 1.)
			);

			vec2 computeShiftedPosition1(vec2 xy, float levelOriginX) {
				vec2 xyShifted = xy;
				xyShifted.x += levelOriginX;
				return (xyShifted + halfPixelOffset) / pyramidTexture1Size;
			}

			vec2 computeShiftedPosition2(vec2 xy, float levelOriginX) {
				vec2 xyShifted = xy;
				xyShifted.x += levelOriginX;
				return (xyShifted + halfPixelOffset) / pyramidTexture2Size;
			}

			vec4 unpackVec3ToRGBA(vec3 vec) {
				uint combined = uint(vec.x * 65535.0 + 0.5); 
				float g = float(combined & uint(0xFF)) * 0.00392156862; 
				float r = float((combined >> 8) & uint(0xFF)) * 0.00392156862; 
		
				return vec4(r, g, vec.y, vec.z);
			}

			out vec4 marchColor;
			
		#endif
		`+e.vertexShader.replace("#include <project_vertex>","\n		#ifdef SHAPEBLEND\n			float triIndex = floor(float(gl_VertexID/3));\n			float vertexIndex = float(gl_VertexID);\n			\n			\n			float levelOriginX1 = pyramidTexture1Size.x - 2.;\n			float levelOriginX2 = pyramidTexture2Size.x - 1.;\n			vec2 xy = vec2(0.);\n			vec4 lookUp = texture(pyramidTexture2, computeShiftedPosition2(xy, levelOriginX2));\n			\n			\n			if (triIndex >= lookUp.r) return;\n			\n			\n			float start = 0.;\n			vec4 triIndexVec = vec4(triIndex);\n			\n			\n			for (int i = 0; i < LOOP;) {\n				\n				vec4 ends = lookUp + vec4(start);\n				vec4 starts = vec4(ends.gba, start);\n				vec4 check = vec4(greaterThanEqual(triIndexVec, starts)) * \n											vec4(lessThan(triIndexVec, ends));\n				\n				\n				xy *= 2.;\n				xy += check.r * rShift + check.g * gShift + check.b * bShift;\n				\n				\n				start = dot(check, starts);\n				levelOriginX2 -= levelShiftX[i];\n				\n				\n				lookUp = texture(pyramidTexture1, computeShiftedPosition1(xy, levelOriginX1));\n				i++;\n\n				ends = lookUp + vec4(start);\n				starts = vec4(ends.gba, start);\n				check = vec4(greaterThanEqual(triIndexVec, starts)) * \n											vec4(lessThan(triIndexVec, ends));\n				\n				\n				xy *= 2.;\n				xy += check.r * rShift + check.g * gShift + check.b * bShift;\n				\n				\n				start = dot(check, starts);\n				levelOriginX1 -= levelShiftX[i];\n				\n				\n				lookUp = texture(pyramidTexture2, computeShiftedPosition2(xy, levelOriginX2));\n\n				i++;\n			}\n\n			#if HALF == 1\n				vec4 ends = lookUp + vec4(start);\n				vec4 starts = vec4(ends.gba, start);\n				vec4 check = vec4(greaterThanEqual(triIndexVec, starts)) * vec4(lessThan(triIndexVec, ends));\n			\n				\n				xy *= 2.;\n				xy += check.r * rShift + check.g * gShift + check.b * bShift;\n			\n				\n				start = dot(check, starts);\n			#endif\n			\n			\n			vec3 gridPos;\n			gridPos.x = mod(xy.x, VOXEL_RESOLUTION);\n			gridPos.y = mod(xy.y, VOXEL_RESOLUTION);\n			gridPos.z = floor(xy.x * INV_VOXEL_RESOLUTION) + \n									floor(xy.y * INV_VOXEL_RESOLUTION) * Z_LAYERS_PER_ROW;\n			\n			\n			vertexIndex -= start * 3.;\n			float vk = vertexIndex * 0.0625 + 0.03125; \n			\n			\n			vec4 voxel = look(gridPos.x, gridPos.y, gridPos.z, voxelPassTexture);\n			float key = (voxel.w + 0.5) * 0.00390625; \n			\n			\n			float edgeNum = texture(triTable, vec2(vk, key)).x;\n			int edgeIndex = int(edgeNum) * 2;\n			\n			\n			vec3 p1 = gridPos + offsets[edgeIndex];\n			vec3 p2 = gridPos + offsets[edgeIndex + 1];\n			\n			\n			vec4 potential1 = look(p1.x, p1.y, p1.z, potentialPassTexture);\n			vec4 potential2 = look(p2.x, p2.y, p2.z, potentialPassTexture);\n			\n			\n			float mu = potential1.r / (potential1.r - potential2.r);\n\n			marchColor = mix(\n				unpackVec3ToRGBA(potential1.gba),\n				unpackVec3ToRGBA(potential2.gba),\n				mu\n			);\n\n			transformed = p1 + (p2 - p1) * mu;\n			transformed -= originOffset;\n			transformed *= scale;\n			vec4 data1 = look(p1.x, p1.y, p1.z, voxelPassTexture);\n			vec4 data2 = look(p2.x, p2.y, p2.z, voxelPassTexture);\n			objectNormal = normalize(mix(data1.xyz, data2.xyz, mu));\n			transformedNormal = normalMatrix * objectNormal;\n			#ifndef FLAT_SHADED\n				vNormal = transformedNormal;\n			#endif\n		#endif\n		\n#include <project_vertex>");let t=e.fragmentShader.match(/vec3 diffuseColor[^\n]*\n/);if(!t)return;let i=`
		#ifdef SHAPEBLEND_C
			#if SHAPEBLEND_C == 1
				${t[0].replace(/nodeU0,/g,"marchColor.rgb,").replace(/nodeU\d+(?=,g_uid\d+_calpha\))/g,"marchColor.a")}
			#else
				${t[0]}
			#endif
		#else
			${t[0]}
		#endif
		`;e.fragmentShader="in vec4 marchColor;\n"+e.fragmentShader.replace(t[0],i),Object.assign(e.uniforms,this.marchPassUniforms)}initDebugPass(e){console.log("fboToDebug.width",e.width,e.height),this.geometry=new l.Vd(e.width,e.height),this.geometry.userData={parameters:{width:4,height:4}};let t={inputTexture:{value:e.textures.length>1?e.textures[1]:e.texture},pyramidTextureSize:{value:void 0}},i=e=>{e.vertexShader="\n				precision highp float;\n\n				varying vec2 vUv;\n\n				void main() {\n						gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n						vUv = uv;\n				}\n			",e.fragmentShader="\n				layout(location = 1) out vec4 gVelocity;\n\n				precision highp float;\n				\n				uniform sampler2D inputTexture;\n				varying vec2 vUv;\n\n				uniform vec2 pyramidTextureSize;\n\n				void main() {\n						\n						gl_FragColor = texture(inputTexture, vUv);\n						gVelocity = vec4(0.0);\n				}\n			",t.pyramidTextureSize.value=new l.Dc(this.pyramidRenderTarget[0].width,this.pyramidRenderTarget[0].height),Object.assign(e.uniforms,t)};this.material.shapeBlendhack=i,this.material.root.shapeBlendhack=i}dispose(){super.dispose(),g?.release(this)}},L=O;L.streamCompaction=new class{constructor(){this.pyramidPassScene=new l.Vc,this.pyramidPassMaterial=new p({name:"PyramidPass"}),this.pyramidPassUniforms={inputTexture:{value:void 0},inputWidth:{value:0},inputHeight:{value:0},inputShiftX:{value:0},outputShiftX:{value:0}},this.pyramidTopLevelReadPixelBuffer=new Float32Array(4),this.pyramidPassMaterial.fragmentShader="\n			precision highp float;\n			precision highp sampler2D;\n			layout(location = 0) out vec4 pc_FragColor;\n			uniform sampler2D inputTexture;\n			uniform float inputWidth;\n			uniform float inputHeight;\n			uniform float inputShiftX;\n			uniform float outputShiftX;\n			const vec2 half_unit_coord = vec2(0.5);\n			const vec4 one = vec4(1.0);\n			void main() {\n				vec2 inputSize = vec2(inputWidth, inputHeight);\n				vec2 input_pixel_uv = 1. / inputSize;\n				vec2 coord = gl_FragCoord.xy - half_unit_coord;\n				coord.x -= outputShiftX;\n				coord = coord * 2. + half_unit_coord;\n				coord.x += inputShiftX;\n\n				\n				vec2 input_uv = coord / inputSize;\n				float bl = texture(inputTexture, input_uv).r;\n\n				\n				input_uv.x += input_pixel_uv.x;\n				float br = texture(inputTexture, input_uv).r;\n\n				\n				input_uv.y += input_pixel_uv.y;\n				float tr = texture(inputTexture, input_uv).r;\n\n				\n				input_uv.x -= input_pixel_uv.x;\n				float tl = texture(inputTexture, input_uv).r;\n\n				pc_FragColor.a = bl;\n				pc_FragColor.b = pc_FragColor.a + br;\n				pc_FragColor.g = pc_FragColor.b + tr;\n				pc_FragColor.r = pc_FragColor.g + tl; \n			}\n		",this.pyramidPassMaterial.uniforms=this.pyramidPassUniforms,this.pyramidPassMaterial.depthTest=!1,this.pyramidPassMaterial.depthWrite=!1;let e=new l.ld(h,this.pyramidPassMaterial);e.frustumCulled=!1,this.pyramidPassScene.add(e)}renderPyramid(e,t,i,a,s){(new l.Qe).min.setScalar(0);let r=t.length-1,o=new l.Jc;i.getViewport(o),this.pyramidPassUniforms.inputShiftX.value=0,this.pyramidPassUniforms.outputShiftX.value=0;let n=r-1;for(let r=n;r>=0;r--){let o=r%2==n%2?s[0]:s[1],l=r===n?a:r%2==n%2?s[1]:s[0];this.pyramidPassUniforms.inputTexture.value=l.textures.length>1?l.textures[1]:l.texture,this.pyramidPassUniforms.inputWidth.value="width"in l?l.width:1,this.pyramidPassUniforms.inputHeight.value="height"in l?l.height:1,i.setRenderTarget(o);let h=t[r],p=i.getPixelRatio();i.setViewport(this.pyramidPassUniforms.outputShiftX.value/p,0,h/p,h/p),2===r&&e%2!=0&&i.setViewport(this.pyramidPassUniforms.outputShiftX.value/p,0,3/p,3/p),i.render(this.pyramidPassScene,c);let d=this.pyramidPassUniforms.inputShiftX.value;this.pyramidPassUniforms.inputShiftX.value=this.pyramidPassUniforms.outputShiftX.value,this.pyramidPassUniforms.outputShiftX.value=d,r<n&&(this.pyramidPassUniforms.outputShiftX.value+=t[r+1])}i.setViewport(o);let h=+(t.length%2!=0);return i.readRenderTargetPixelsAsync(s[h],s[h].width-1,0,1,1,this.pyramidTopLevelReadPixelBuffer).then(()=>this.pyramidTopLevelReadPixelBuffer[0])}};var k=new l.Oc,D=new l.Oc,E=new l.Ec,U=new l.Fc,M=new l.Fc,C=new l.Ec;function F(e,t=0){let i=this.children.length;for(;i--;){let a=this.children[i];o.e.is(a)&&N.call(a,e,t+1)}}function N(e,t=0){if(!0!==e(this,t)){let i=this.children.length;for(;i--;){let a=this.children[i];o.e.is(a)&&N.call(a,e,t+1)}}}function I(){if(void 0===this.shapesDataTexture.value){let e=new l.nd(new Float32Array(1920),96,5,l.Ja,l.Aa);this.shapesDataTexture.value=e}let e=this.shapesDataTexture.value,t=e.image.data,i=0,h=0,p=this.data.geometry.blendRange,d=k.copy(this.matrixWorld).invert(),c=this._npart,f=0;this._meshSdfWanted.clear();let u=null;if(F.call(this,e=>{let l;if(!1===e.visible)return!0;if(e instanceof a.a||e instanceof s.a||(0,n.a)(e))return;l=e instanceof r.ea?e.object:e;let c=e.data?.cloner;if(o.h.is(e)&&c&&!c.hideBase&&"radial"!==c.type&&!0!==c.disabled||!(l instanceof r.ja))return;let v=l.geometry.userData.parameters,m=v?.shapeBlendNode??l.dataPatched?.geometry?.shapeBlendNode;if(void 0===m)return;if(D.multiplyMatrices(d,e.matrixWorld).decompose(M,E,U),"TorusGeometry"===v?.type&&360!==v.arc){let e=v.arc*Math.PI/180;e/=4,E.multiply(C.set(0,0,Math.sin(e),Math.cos(e)))}let x=m.overrideGlobalBlend?m.blendRange:p;x=x/this.bboxSize*2,t[4*f]=(M.x-this.bboxOffset)/this.bboxSize*2,t[4*f+1]=(M.y-this.bboxOffset)/this.bboxSize*2,t[4*f+2]=(M.z-this.bboxOffset)/this.bboxSize*2,t[4*f+3]=0===m.operation?1:2===m.operation?-1:-2,t[384+4*f]=-E.x,t[384+4*f+1]=-E.y,t[384+4*f+2]=-E.z,t[384+4*f+3]=E.w;let y=new Float32Array(4),g=0,S=x;if("SphereGeometry"===v?.type)v.width===v.height&&v.width===v.depth?y[0]=0:y[0]=1,y[1]=v.width/this.bboxSize,y[2]=v.height/this.bboxSize,y[3]=v.depth/this.bboxSize,S=Math.max(y[1],y[2],y[3])*U.x+x;else if("CubeGeometry"===v?.type){g=v.cornerRadius;let e=v.width,t=v.height,i=v.depth;y[0]=2,y[1]=(e-2*g)/this.bboxSize,y[2]=(t-2*g)/this.bboxSize,y[3]=(i-2*g)/this.bboxSize,S=Math.sqrt(e**2+t**2+i**2)/this.bboxSize*U.x+x}else if("CylinderGeometry"===v?.type){g=v.cornerRadius;let e=v.height,t=v.radiusBottom,i=v.radiusTop;if(i>=t){let a=(Math.PI/2-Math.atan2(i-t,e))/2;i-=g/Math.tan(a),t-=g*Math.tan(a)}else if(t>i){let a=(Math.PI/2-Math.atan2(t-i,e))/2;i-=g*Math.tan(a),t-=g/Math.tan(a)}y[1]=(v.height-2*g)/this.bboxSize,t===i?(y[0]=3,y[2]=t/this.bboxSize*2):(y[0]=4,y[2]=t/this.bboxSize*2,y[3]=i/this.bboxSize*2),S=(Math.hypot(y[1],Math.max(Math.abs(y[2]),Math.abs(y[3])))+g/this.bboxSize*2)*U.x+x}else if("TorusGeometry"===v?.type){if(y[0]=5,y[1]=(v.width-v.depth)/this.bboxSize,y[2]=v.depth/this.bboxSize,360!==v.arc){y[0]=6,y[3]=y[1],t[1152+4*f+3]=y[2];let e=2*Math.atan2(y[2]/2,y[1]),i=v.arc*Math.PI/180/2-e;y[1]=Math.sin(i),y[2]=Math.cos(i)}S=v.width*U.x/this.bboxSize+x}else{let e=l.geometry;(u??(u=new Set)).add(e.uuid);let i=this._meshSdfBaked.get(e.uuid),a=R(e);if((void 0===i||i.posVersion!==a)&&this._meshSdfWanted.set(e.uuid,e),void 0===i)return;y[0]=7,y[1]=i.slot,y[2]=i.boxHalf.x/this.bboxSize*2,y[3]=i.boxHalf.y/this.bboxSize*2,t[1152+4*f+3]=i.boxHalf.z/this.bboxSize*2,S=Math.hypot(i.boxHalf.x,i.boxHalf.y,i.boxHalf.z)/this.bboxSize*2*U.x+x}t.set(y,768+4*f),i=Math.max(i,S),h=Math.max(h,x),this._reach[f]=S,t[1152+4*f]=x,t[1152+4*f+1]=g/this.bboxSize*2,t[1152+4*f+2]=U.x;let b,T,_=Array.isArray(l.material)?l.material[0]:l.material;if(_?.getShapeBlendBaseColor){let e=_.getShapeBlendBaseColor();b=e,T=e.a}else void 0!==_?.uniforms?.nodeU0?(b=_.uniforms.nodeU0.node.value,T=_.uniforms.nodeU1?.value??1):(b={r:1,g:1,b:1},T=1);0===m.operation||m.useColor||(T=-1),t[1536+4*f]=b.r,t[1536+4*f+1]=b.g,t[1536+4*f+2]=b.b,t[1536+4*f+3]=T,T<1&&1===this.material.defines?.SHAPEBLEND_C&&this.material.setTransparent(!0),f++}),this._meshSdfBaked.size>0){let e=u??new Set;for(let t of this._meshSdfBaked.keys())e.has(t)||this._meshSdfBaked.delete(t)}this.npart=f,this._maxBlendK=h;let v=1.1*i+2/(this.spatialDivisions-1)+4/(this.resolution-1);this.spatialPassUniforms.span.value=v;let m=this._prevShapeData,x=c!==f,y=null===m||this._prevSpan!==v||x,g=y||z,S=this._fieldDirtyMin.set(1/0,1/0,1/0),b=this._fieldDirtyMax.set(-1/0,-1/0,-1/0);if(null!==m){let e=Math.max(f,c);for(let i=0;i<e;i++){let e=!1;for(let a=0;a<5;a++){let s=384*a+4*i;if(t[s]!==m[s]||t[s+1]!==m[s+1]||t[s+2]!==m[s+2]||t[s+3]!==m[s+3]){e=!0;break}}if(!e)continue;if(y=!0,g)break;let a=t[4*i],s=t[4*i+1],r=t[4*i+2],o=m[4*i],n=m[4*i+1],l=m[4*i+2],h=this._reach[i],p=this._prevReach[i];Number.isFinite(a+s+r+h)&&Number.isFinite(o+n+l+p)?(S.x=Math.min(S.x,a-h,o-p),S.y=Math.min(S.y,s-h,n-p),S.z=Math.min(S.z,r-h,l-p),b.x=Math.max(b.x,a+h,o+p),b.y=Math.max(b.y,s+h,n+p),b.z=Math.max(b.z,r+h,l+p)):g=!0}}return z&&(y=!0),this._fieldDirtyFull=g||S.x===1/0,y&&(null===m?this._prevShapeData=new Float32Array(t):m.set(t),this._prevReach.set(this._reach),this._prevSpan=v,e.needsUpdate=!0),y}function V(e){return I.call(e)}}}]);