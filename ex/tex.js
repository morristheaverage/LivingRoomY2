/* eslint-disable no-console */
const VSHADER_SOURCE =
  'attribute vec4 a_Position;\n' +
  'attribute vec4 a_Color;\n' +
  // 'attribute vec4 a_Normal;\n' +
  'attribute vec2 a_TexCoords;\n' +
  'uniform mat4 u_MvpMatrix;\n' +
  'uniform mat4 u_ModelMatrix;\n' +    // Model matrix
  // 'uniform mat4 u_NormalMatrix;\n' +   // Transformation matrix of the normal
  'varying vec3 v_Position;\n' +
  'varying vec4 v_Color;\n' +
  'varying vec3 v_Normal;\n' +
  'varying vec2 v_TexCoords;\n' +
  'void main() {\n' +
  '  gl_Position = u_MvpMatrix * a_Position;\n' +
  // Calculate the vertex position in world coordinates
  '  v_Position = vec3(u_ModelMatrix * a_Position);\n' +
  '  v_Color = a_Color;\n' +
  // '  v_Normal = normalize(vec3(u_NormalMatrix * a_Normal));\n' +
  '  v_TexCoords = a_TexCoords;\n' +
  '}\n';

const FSHADER_SOURCE =
  '#ifdef GL_ES\n' +
  'precision mediump float;\n' +
  '#endif\n' +
  'uniform sampler2D u_Sampler;\n' +
  'varying vec2 v_TexCoords;\n' +
  'varying vec4 v_Color;\n' +
  // 'varying vec3 v_Normal;\n' +
  'uniform bool u_UseTextures;\n' +
  'void main() {\n' +
  '  if (u_UseTextures) {\n' +
  '    vec4 color = texture2D(u_Sampler, v_TexCoords);\n' +
  '    if (!(color.r > 0.95 && color.g > 0.95 && color.b > 0.95 )){\n' +
  '      color.a = 0.5;\n' +
  '    }\n' +
  '    gl_FragColor = color;\n' +
  '  } else {\n' +
  '    gl_FragColor = v_Color;\n' +
  '  }\n' +
  '}\n';

// eslint-disable-next-line no-unused-vars
function main() {
	// Retrive <canvas> element
	let canvas = document.getElementById('webgl');

	// Get rendering context for WebGL
	// eslint-disable-next-line no-undef
	let gl = getWebGLContext(canvas);
	if (!gl) {
		console.log('Failed to get rendering context.');
		return;
	}

	// Initialise shaders
	if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
		console.log('Failed to initialise shaders.');
		return;
	}

	let u_UseTextures = gl.getUniformLocation(gl.program, 'u_UseTextures');
	if (!u_UseTextures) {
		console.log('Failed to get the storage location for texture map enable flag');
		return;
	}

	let n = initSquareVertexBuffers(gl);
	if (n < 0) {
		console.log('Failed to set vertex information');
		return;
	}

	// Set the clear color and enable the depth test
	gl.clearColor(1.0, 0.0, 0.0, 1.0);
	gl.enable(gl.DEPTH_TEST);

	// Get the storage locations of uniform variables
	var u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
	var u_MvpMatrix = gl.getUniformLocation(gl.program, 'u_MvpMatrix');

	var modelMatrix = new Matrix4();  // Model matrix
	var mvpMatrix = new Matrix4();    // Model view projection matrix

	// Calculate the model matrix
	modelMatrix.setRotate(90, 0, 1, 0); // Rotate around the y-axis
	// Calculate the view projection matrix
	mvpMatrix.setPerspective(30, canvas.width/canvas.height, 1, 100);
	mvpMatrix.setPerspective(30, canvas.width/canvas.height, 1, 100);
	mvpMatrix.lookAt(6, 6, 14, 0, 0, 0, 0, 1, 0);

	// Pass the model view projection matrix to u_mvpMatrix
	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);

	// Pass the model view projection matrix to u_mvpMatrix
	gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);

	// Create a texture object
	let texture0 = gl.createTexture();
	if (!texture0) {
		console.log('Failed to create the texture object');
		return false;
	}
	

	// Get the storage location of u_Sampler
	let u_Sampler = gl.getUniformLocation(gl.program, 'u_Sampler');
	if (!u_Sampler) {
		console.log('Failed to create the storage location of u_Sampler');
		return false;
	}

	// Create the image object
	texture0.image = new Image();
	if (!texture0.image) {
		console.log('Failed to create the image object');
		return false;
	}
	texture0.image.onload = function(){ loadTexAndDraw(gl, n, texture0, u_Sampler, u_UseTextures); };
	texture0.image.src = '../img/fish.png';
}

function initSquareVertexBuffers(gl) {
	// Create a unit square
	//   v1------v0
	//   /       /
	// v2------v3
	var vertices = new Float32Array([
		0.5, -0.5, 0.0,    -0.5, -0.5, 0.0,   -0.5, 0.5, 0.0,    0.5, 0.5, 0.0      // v0-v1-v2-v3
	]);

	var colors = new Float32Array([
		0, 0, 0, 1,    1, 1, 0, 1,    1, 0, 1, 1,    0, 1, 1, 1
	]);

	var texCoords = new Float32Array([
		1.0, 0.0,    0.0, 0.0,    0.0, 1.0,    1.0, 1.0 // v0-v1-v2-v3
	]);

	var indices = new Uint8Array([
		0, 1, 2,    0, 2, 3
	]);

	if (!initArrayBuffer(gl, 'a_Position', vertices, 3, gl.FLOAT)) return -1;
	if (!initArrayBuffer(gl, 'a_Color', colors, 4, gl.FLOAT)) return -1;
	if (!initArrayBuffer(gl, 'a_TexCoords', texCoords, 2, gl.FLOAT)) return -1;

	// Unbind the buffer object
	gl.bindBuffer(gl.ARRAY_BUFFER, null);

	// Write the indices to the buffer object
	var indexBuffer = gl.createBuffer();
	if (!indexBuffer) {
		console.log('Failed to create the buffer object');
		return false;
	}

	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

	return indices.length;
}

function initVertexBuffers(gl) {
	// Create a cube
	//    v6----- v5
	//   /|      /|
	//  v1------v0|
	//  | |     | |
	//  | |v7---|-|v4
	//  |/      |/
	//  v2------v3
	// Coordinates
	var vertices = new Float32Array([
		2.0, 2.0, 2.0,  -2.0, 2.0, 2.0,  -2.0,-2.0, 2.0,   2.0,-2.0, 2.0, // v0-v1-v2-v3 front
		2.0, 2.0, 2.0,   2.0,-2.0, 2.0,   2.0,-2.0,-2.0,   2.0, 2.0,-2.0, // v0-v3-v4-v5 right
		2.0, 2.0, 2.0,   2.0, 2.0,-2.0,  -2.0, 2.0,-2.0,  -2.0, 2.0, 2.0, // v0-v5-v6-v1 up
		-2.0, 2.0, 2.0,  -2.0, 2.0,-2.0,  -2.0,-2.0,-2.0,  -2.0,-2.0, 2.0, // v1-v6-v7-v2 left
		-2.0,-2.0,-2.0,   2.0,-2.0,-2.0,   2.0,-2.0, 2.0,  -2.0,-2.0, 2.0, // v7-v4-v3-v2 down
		2.0,-2.0,-2.0,  -2.0,-2.0,-2.0,  -2.0, 2.0,-2.0,   2.0, 2.0,-2.0  // v4-v7-v6-v5 back
	]);

	// Colors
	var colors = new Float32Array([
		1, 0, 0,   1, 0, 0,   1, 0, 0,  1, 0, 0,     // v0-v1-v2-v3 front
		1, 0, 0,   1, 0, 0,   1, 0, 0,  1, 0, 0,     // v0-v3-v4-v5 right
		1, 0, 0,   1, 0, 0,   1, 0, 0,  1, 0, 0,     // v0-v5-v6-v1 up
		1, 0, 0,   1, 0, 0,   1, 0, 0,  1, 0, 0,     // v1-v6-v7-v2 left
		1, 0, 0,   1, 0, 0,   1, 0, 0,  1, 0, 0,     // v7-v4-v3-v2 down
		1, 0, 0,   1, 0, 0,   1, 0, 0,  1, 0, 0　    // v4-v7-v6-v5 back
	]);

	// // Normal
	// var normals = new Float32Array([
	// 	0.0, 0.0, 1.0,   0.0, 0.0, 1.0,   0.0, 0.0, 1.0,   0.0, 0.0, 1.0,  // v0-v1-v2-v3 front
	// 	1.0, 0.0, 0.0,   1.0, 0.0, 0.0,   1.0, 0.0, 0.0,   1.0, 0.0, 0.0,  // v0-v3-v4-v5 right
	// 	0.0, 1.0, 0.0,   0.0, 1.0, 0.0,   0.0, 1.0, 0.0,   0.0, 1.0, 0.0,  // v0-v5-v6-v1 up
	// 	-1.0, 0.0, 0.0,  -1.0, 0.0, 0.0,  -1.0, 0.0, 0.0,  -1.0, 0.0, 0.0,  // v1-v6-v7-v2 left
	// 	0.0,-1.0, 0.0,   0.0,-1.0, 0.0,   0.0,-1.0, 0.0,   0.0,-1.0, 0.0,  // v7-v4-v3-v2 down
	// 	0.0, 0.0,-1.0,   0.0, 0.0,-1.0,   0.0, 0.0,-1.0,   0.0, 0.0,-1.0   // v4-v7-v6-v5 back
	// ]);

	// Texture Coordinates
	var texCoords = new Float32Array([
		1.0, 1.0,    0.0, 1.0,   0.0, 0.0,   1.0, 0.0,  // v0-v1-v2-v3 front
		0.0, 1.0,    0.0, 0.0,   1.0, 0.0,   1.0, 1.0,  // v0-v3-v4-v5 right
		1.0, 0.0,    1.0, 1.0,   0.0, 1.0,   0.0, 0.0,  // v0-v5-v6-v1 up
		1.0, 1.0,    0.0, 1.0,   0.0, 0.0,   1.0, 0.0,  // v1-v6-v7-v2 left
		0.0, 0.0,    1.0, 0.0,   1.0, 1.0,   0.0, 1.0,  // v7-v4-v3-v2 down
		0.0, 0.0,    1.0, 0.0,   1.0, 1.0,   0.0, 1.0   // v4-v7-v6-v5 back
	]);

	// Indices of the vertices
	var indices = new Uint8Array([
		0, 1, 2,   0, 2, 3,    // front
		4, 5, 6,   4, 6, 7,    // right
		8, 9,10,   8,10,11,    // up
		12,13,14,  12,14,15,    // left
		16,17,18,  16,18,19,    // down
		20,21,22,  20,22,23     // back
	]);

	// Write the vertex property to buffers (coordinates, colors and normals)
	if (!initArrayBuffer(gl, 'a_Position', vertices, 3, gl.FLOAT)) return -1;
	if (!initArrayBuffer(gl, 'a_Color', colors, 3, gl.FLOAT)) return -1;
	// if (!initArrayBuffer(gl, 'a_Normal', normals, 3, gl.FLOAT)) return -1;
	if (!initArrayBuffer(gl, 'a_TexCoords', texCoords, 2, gl.FLOAT)) return -1;


	// Unbind the buffer object
	gl.bindBuffer(gl.ARRAY_BUFFER, null);

	// Write the indices to the buffer object
	var indexBuffer = gl.createBuffer();
	if (!indexBuffer) {
		console.log('Failed to create the buffer object');
		return false;
	}
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

	return indices.length;
}

function initArrayBuffer (gl, attribute, data, num, type) {
	// Create a buffer object
	var buffer = gl.createBuffer();
	if (!buffer) {
		console.log('Failed to create the buffer object');
		return false;
	}

	// Write date into the buffer object
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

	// Element size
	var FSIZE = data.BYTES_PER_ELEMENT;

	// Assign the buffer object to the attribute variable

	var a_attribute = gl.getAttribLocation(gl.program, attribute);
	if (a_attribute < 0) {
		console.log('Failed to get the storage location of ' + attribute);
		return false;
	}
	gl.vertexAttribPointer(a_attribute, num, type, false, FSIZE * num, 0);
	// Enable the assignment of the buffer object to the attribute variable
	gl.enableVertexAttribArray(a_attribute);

	// gl.bindBuffer(gl.ARRAY_BUFFER, null);

	return true;
}

function loadTexture(gl, texture, u_Sampler, texUnit) {
	console.log(texUnit);
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);// Flip the image's y-axis
	// Make the texture unit active
	gl.activeTexture(gl.TEXTURE0);
	// Bind the texture object to the target
	gl.bindTexture(gl.TEXTURE_2D, texture);   

	// Set texture parameters
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	// Set the image to texture
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, texture.image);
  
	gl.uniform1i(u_Sampler, texUnit);   // Pass the texure unit to u_Sampler
}

function loadTexAndDraw(gl, n, texture, u_Sampler, u_UseTextures) {
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1); // Flip the image's y axis

	// Enable texture unit0
	gl.activeTexture(gl.TEXTURE0);

	// Bind the texture object to the target
	gl.bindTexture(gl.TEXTURE_2D, texture);

	// Set the texture image
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// Assign u_Sampler to TEXTURE0
	gl.uniform1i(u_Sampler, 0);

	// Enable texture mapping
	gl.uniform1i(u_UseTextures, true);

	// Draw the textured cube
	gl.drawElements(gl.TRIANGLES, n, gl.UNSIGNED_BYTE, 0);
}