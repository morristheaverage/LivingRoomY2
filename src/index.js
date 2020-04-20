/* eslint-disable no-console */
// Vertex shader program
var VSHADER_SOURCE =
  'attribute vec4 a_Position;\n' +
  'attribute vec4 a_Color;\n' +
  'attribute vec4 a_Normal;\n' +        // Normal
  'attribute vec2 a_TexCoords;\n' +
  'uniform mat4 u_ModelMatrix;\n' +
  'uniform mat4 u_NormalMatrix;\n' +
  'uniform mat4 u_ViewMatrix;\n' +
  'uniform mat4 u_ProjMatrix;\n' +
  'uniform vec3 u_LightColor;\n' +     // Light color
  'uniform vec3 u_LightDirection;\n' + // Light direction (in the world coordinate, normalized)
  'varying vec4 v_Color;\n' +
  'varying vec2 v_TexCoords;\n' +
  'void main() {\n' +
  '  gl_Position = u_ProjMatrix * u_ViewMatrix * u_ModelMatrix * a_Position;\n' +
  '  vec3 normal = normalize((u_NormalMatrix * a_Normal).xyz);\n' +
  '  float ambient = 0.4;\n' +
  '  float nDotL = max(dot(normal, u_LightDirection), ambient);\n' +
  // Calculate the color due to diffuse reflection
  '  vec3 diffuse = u_LightColor * a_Color.rgb * nDotL;\n' +
  '  v_Color = vec4(diffuse, a_Color.a);\n' +
  '  v_TexCoords = a_TexCoords;\n' +
  '}\n';

// Fragment shader program
var FSHADER_SOURCE =
  'precision mediump float;\n' +
  'varying vec4 v_Color;\n' +
  'uniform bool u_UseTextures;\n' +
  'uniform sampler2D u_Sampler;\n' +
  'varying vec2 v_TexCoords;\n' +
  'void main() {\n' +
  '		if (u_UseTextures){\n' +
  '			vec4 TexColor = texture2D(u_Sampler, v_TexCoords);\n' +
  '			gl_FragColor = vec4(TexColor.rgb, 1.0);\n' +
  '		}else{\n' +
  '			gl_FragColor = v_Color;\n' +
  '		}\n' +
  '		if (gl_FragColor.a < 0.5) discard;\n' +
  '}\n';

// eslint-disable-next-line no-undef
var modelMatrix = new Matrix4(); // The model matrix
// eslint-disable-next-line no-undef
var viewMatrix = new Matrix4();  // The view matrix
// eslint-disable-next-line no-undef
var projMatrix = new Matrix4();  // The projection matrix
// eslint-disable-next-line no-undef
var g_normalMatrix = new Matrix4();  // Coordinate transformation matrix for normals

var ANGLE_STEP = 3.0;  // The increments of rotation angle (degrees)
var g_xAngle = 0.0;    // The rotation x angle (degrees)
var g_yAngle = 0.0;    // The rotation y angle (degrees)
var g_zAngle = 0.0;    // The rotation z angle (degrees)

var tankTilt = 0.0;
const maxTilt = 45.0;

var anim = 0.0;
var animStep = 0.05;

var lastLoop = new Date();
var thisLoop, fps;
var fpsElement = document.getElementById('fps');
var fpsNode = document.createTextNode('');
fpsElement.append(fpsNode);

var seatMatrices = [];

// A global object to contain buffer info
var shapes = {
	'wall': {color: {r: 1.0, g: 1.0, b: 1.0, alpha: 1.0}, type: 'square', tes: true},
	'fish': {color: {r: 0.0, g: 0.0, b: 0.0, alpha: 0.0}, type: 'square', tes: false},
	'furniture': {color: {r: 1.0, g: 0.0, b: 0.0, alpha: 1.0}, type: 'cube'},
	'glass': {color: {r: 0.2, g: 1.0, b: 0.2, alpha: 0.1}, type: 'cube'}
};

var floorLoaded = false;
var wallLoaded = false;
var fishLoaded = false;

// Room dimensions
let h = 5;
let d = 10;
let w = 12;

// eslint-disable-next-line no-unused-vars
function main() {
	// Retrieve <canvas> element
	var canvas = document.getElementById('webgl');

	// Get the rendering context for WebGL
	// eslint-disable-next-line no-undef
	var gl = getWebGLContext(canvas);
	if (!gl) {
		console.log('Failed to get the rendering context for WebGL');
		return;
	}

	// Initialize shaders
	// eslint-disable-next-line no-undef
	if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
		console.log('Failed to intialize shaders.');
		return;
	}

	// Set clear color and enable hidden surface removal
	gl.clearColor(0.0, 0.0, 0.0, 1.0);
	gl.enable(gl.DEPTH_TEST);

	// Enable transparency
	gl.enable(gl.BLEND);
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

	// Clear color and depth buffer
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// Get the storage locations of uniform attributes
	var u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
	var u_ViewMatrix = gl.getUniformLocation(gl.program, 'u_ViewMatrix');
	var u_NormalMatrix = gl.getUniformLocation(gl.program, 'u_NormalMatrix');
	var u_ProjMatrix = gl.getUniformLocation(gl.program, 'u_ProjMatrix');
	var u_LightColor = gl.getUniformLocation(gl.program, 'u_LightColor');
	var u_LightDirection = gl.getUniformLocation(gl.program, 'u_LightDirection');


	if (!u_ModelMatrix || !u_ViewMatrix || !u_NormalMatrix ||
      !u_ProjMatrix || !u_LightColor || !u_LightDirection ) { 
		console.log(!u_ModelMatrix);
		console.log(!u_ViewMatrix);
		console.log(!u_NormalMatrix);
		console.log(!u_ProjMatrix);
		console.log(!u_LightColor);
		console.log(!u_LightDirection);
		console.log('Failed to Get the storage locations of u_ModelMatrix, u_ViewMatrix, and/or u_ProjMatrix');
		return;
	}

	// Set the light color (white)
	gl.uniform3f(u_LightColor, 1.0, 1.0, 1.0);
	

	// Calculate the view matrix and the projection matrix
	viewMatrix.setLookAt(0, 0, 15, 0, 0, -100, 0, 1, 0);
	projMatrix.setPerspective(30, canvas.width/canvas.height, 1, 100);
	// Pass the model, view, and projection matrix to the uniform variable respectively
	gl.uniformMatrix4fv(u_ViewMatrix, false, viewMatrix.elements);
	gl.uniformMatrix4fv(u_ProjMatrix, false, projMatrix.elements);

	// Load seat data
	initSeatMatrices();

	// Preload all relevant shapes into the buffers
	// 1-sqaures for walls
	// 2-red cubes for furniture
	// 3-blue water cube
	// 4-clear glass cube
	for (var i = -maxTilt; i <= maxTilt; i += ANGLE_STEP){
		shapes['water' + String(i)] = {
			color: {r: 0.0, g: 0.5, b: 1.0, alpha: 0.5},
			type: 'tiltedcube',
			tilt: i
		};
	}

	var shape;

	var vertices = [];
	var colors = [];
	var normals = [];
	var texCoords = [];
	var indices = [];

	var valueoffset = 0;
	var indexoffset = 0;
	for(var [key, value] of Object.entries(shapes)){
		switch(value.type) {
		case 'square':
			shape = initSquareVertexBuffers(valueoffset, value.color, value.tes);
			break;
		case 'cube':
			shape = initCubeVertexBuffers(valueoffset, value.color, 0);
			break;
		case 'tiltedcube':
			shape = initCubeVertexBuffers(valueoffset, value.color, value.tilt);
			break;
		default:
			console.log(shapes[i].type);
			return;
		}
		vertices = vertices.concat(shape.vertices);
		colors = colors.concat(shape.colors);
		normals = normals.concat(shape.normals);
		texCoords = texCoords.concat(shape.texCoords);

		shapes[key]['offset'] = indexoffset;
		shapes[key]['n'] = shape.indices.length;
		indexoffset += shapes[key].n;
		indices = indices.concat(shape.indices);
		valueoffset = 1 + Math.max(...indices);
	}

	var vdebug = [];
	for (var i = 0; i < vertices.length/3; i++){
		vdebug.push([vertices[3*i], vertices[3*i+1], vertices[3*i+2], colors[4*i], colors[4*i+1], colors[4*i+2], texCoords[2*i], texCoords[2*i+1]]);
	}
	
	// Write the vertex property to buffers (coordinates, colors and normals)
	if (!initArrayBuffer(gl, 'a_Position', new Float32Array(vertices), 3, gl.FLOAT)) return -1;
	if (!initArrayBuffer(gl, 'a_Color', new Float32Array(colors), 4, gl.FLOAT)) return -1;
	if (!initArrayBuffer(gl, 'a_Normal', new Float32Array(normals), 3, gl.FLOAT)) return -1;
	if (!initArrayBuffer(gl, 'a_TexCoords', new Float32Array(texCoords), 2, gl.FLOAT)) return -1;

	// Write the indices to the buffer object
	var indexBuffer = gl.createBuffer();
	if (!indexBuffer) {
		console.log('Failed to create the buffer object');
		return false;
	}

	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);


	// Set up texture stuff
	var u_UseTextures = gl.getUniformLocation(gl.program, 'u_UseTextures');
	var u_Sampler = gl.getUniformLocation(gl.program, 'u_Sampler');

	// Load textures
	const floorPic = new Image();
	var floorTex = gl.createTexture();
	floorPic.onload = () => {
		// document.body.appendChild(floorPic);
		loadTexture(gl, floorTex, u_Sampler, floorPic, 0);
		floorLoaded = true;
		draw(gl, u_ModelMatrix, u_NormalMatrix, u_LightDirection, u_UseTextures, u_Sampler);
		console.log('load', floorLoaded);
	};
	console.log('loaded', floorLoaded);
	floorPic.crossOrigin = 'Anonymous';
	floorPic.src = '../img/wood.png';

	const wallPic = new Image();
	let wallTex = gl.createTexture();
	wallPic.onload = () => {
		loadTexture(gl, wallTex, u_Sampler, wallPic, 1);
		wallLoaded = true;
		draw(gl, u_ModelMatrix, u_NormalMatrix, u_LightDirection, u_UseTextures, u_Sampler);
	};
	wallPic.src = '../img/blue.jpg';

	// Wall courtesy of https://favpng.com/

	const fishPic = new Image();
	let fishTex = gl.createTexture();
	fishPic.onload = () => {
		loadTexture(gl, fishTex, u_Sampler, fishPic, 2);
		fishLoaded = true;
		draw(gl, u_ModelMatrix, u_NormalMatrix, u_LightDirection, u_UseTextures, u_Sampler);
	};
	fishPic.src = '../img/fish.png';

	
	document.onkeydown = function(ev){
		keydown(ev, gl, u_ModelMatrix, u_NormalMatrix, u_LightDirection, u_UseTextures, u_Sampler);
	};

	draw(gl, u_ModelMatrix, u_NormalMatrix, u_LightDirection, u_UseTextures, u_Sampler);
}

function keydown(ev, gl, u_ModelMatrix, u_NormalMatrix, u_LightDirection, u_UseTextures, u_Sampler) {
	switch (ev.keyCode) {
	case 40: // Up arrow key -> the positive rotation of arm1 around the y-axis
		g_xAngle = (g_xAngle + ANGLE_STEP) % 360;
		break;
	case 38: // Down arrow key -> the negative rotation of arm1 around the y-axis
		g_xAngle = (g_xAngle - ANGLE_STEP) % 360;
		break;
	case 39: // Right arrow key -> the positive rotation of arm1 around the y-axis
		g_yAngle = (g_yAngle + ANGLE_STEP) % 360;
		break;
	case 37: // Left arrow key -> the negative rotation of arm1 around the y-axis
		g_yAngle = (g_yAngle - ANGLE_STEP) % 360;
		break;
	case 69: // e key -> around z axis
		g_zAngle = (g_zAngle - ANGLE_STEP) % 360;
		break;
	case 81: // q key -> around z axis
		g_zAngle = (g_zAngle + ANGLE_STEP) % 360;
		break;
	case 68: // d key -> around z axis
		tankTilt = Math.max((tankTilt - ANGLE_STEP), -maxTilt);
		break;
	case 65: // a key -> around z axis
		tankTilt = Math.min(tankTilt + ANGLE_STEP, maxTilt);
		break;
	case 32: // space key -> increment animation counter
		anim = (anim + animStep) % 1;
		break;
	default: return; // Skip drawing at no effective action
	}

	// Draw the scene
	draw(gl, u_ModelMatrix, u_NormalMatrix, u_LightDirection, u_UseTextures, u_Sampler);
}


function initCubeVertexBuffers(offset, colour, topTilt) {
	// Create a cube
	//    v6----- v5
	//   /|      /|
	//  v1------v0|
	//  | |     | |
	//  | |v7---|-|v4
	//  |/      |/
	//  v2------v3

	// The top is tilted by z degrees around the z axis
	// left side is 0.5t higher
	// right side is 0.5t lower
	var rad = Math.PI * topTilt / 180;
	var t = Math.tan(rad);
	var s = Math.sin(rad);
	var c = Math.cos(rad);

	var vertices = [   // Coordinates
		0.5, 0.5 - 0.5*t, 0.5,  -0.5, 0.5 + 0.5*t, 0.5,  -0.5,-0.5, 0.5,   0.5,-0.5, 0.5, // v0-v1-v2-v3 front
		0.5, 0.5 - 0.5*t, 0.5,   0.5,-0.5, 0.5,   0.5,-0.5,-0.5,   0.5, 0.5 - 0.5*t,-0.5, // v0-v3-v4-v5 right
		0.5, 0.5 - 0.5*t, 0.5,   0.5, 0.5 - 0.5*t,-0.5,  -0.5, 0.5 + 0.5*t,-0.5,  -0.5, 0.5 + 0.5*t, 0.5, // v0-v5-v6-v1 up
		-0.5, 0.5 + 0.5*t, 0.5,  -0.5, 0.5 + 0.5*t,-0.5,  -0.5,-0.5,-0.5,  -0.5,-0.5, 0.5, // v1-v6-v7-v2 left
		-0.5,-0.5,-0.5,   0.5,-0.5,-0.5,   0.5,-0.5, 0.5,  -0.5,-0.5, 0.5, // v7-v4-v3-v2 down
		0.5,-0.5,-0.5,  -0.5,-0.5,-0.5,  -0.5, 0.5 + 0.5*t,-0.5,   0.5, 0.5 - 0.5*t,-0.5  // v4-v7-v6-v5 back
	];

	var r, g, b;
	r = colour.r;
	g = colour.g;
	b = colour.b;
	var alpha = colour.alpha;
	var colors = [    // Colors
		r, g, b, alpha,   r, g, b, alpha,   r, g, b, alpha,   r, g, b, alpha,     // v0-v1-v2-v3 front
		r, g, b, alpha,   r, g, b, alpha,   r, g, b, alpha,   r, g, b, alpha,     // v0-v3-v4-v5 right
		r, g, b, alpha,   r, g, b, alpha,   r, g, b, alpha,   r, g, b, alpha,     // v0-v5-v6-v1 up
		r, g, b, alpha,   r, g, b, alpha,   r, g, b, alpha,   r, g, b, alpha,     // v1-v6-v7-v2 left
		r, g, b, alpha,   r, g, b, alpha,   r, g, b, alpha,   r, g, b, alpha,     // v7-v4-v3-v2 down
		r, g, b, alpha,   r, g, b, alpha,   r, g, b, alpha,   r, g, b, alpha      // v4-v7-v6-v5 back
	];


	var normals = [    // Normal
		0.0, 0.0, 1.0,   0.0, 0.0, 1.0,   0.0, 0.0, 1.0,   0.0, 0.0, 1.0,  // v0-v1-v2-v3 front
		1.0, 0.0, 0.0,   1.0, 0.0, 0.0,   1.0, 0.0, 0.0,   1.0, 0.0, 0.0,  // v0-v3-v4-v5 right
		s,     c, 0.0,   s,     c, 0.0,   s,     c, 0.0,   s,     c, 0.0,  // v0-v5-v6-v1 up
		-1.0, 0.0, 0.0,  -1.0, 0.0, 0.0,  -1.0, 0.0, 0.0,  -1.0, 0.0, 0.0,  // v1-v6-v7-v2 left
		0.0,-1.0, 0.0,   0.0,-1.0, 0.0,   0.0,-1.0, 0.0,   0.0,-1.0, 0.0,  // v7-v4-v3-v2 down
		0.0, 0.0,-1.0,   0.0, 0.0,-1.0,   0.0, 0.0,-1.0,   0.0, 0.0,-1.0   // v4-v7-v6-v5 back
	];

	var texCoords = [
		1.0, 1.0,    0.0, 1.0,    1.0, 1.0,    1.0, 0.0,
		1.0, 1.0,    0.0, 1.0,    1.0, 1.0,    1.0, 0.0,
		1.0, 1.0,    0.0, 1.0,    1.0, 1.0,    1.0, 0.0,
		1.0, 1.0,    0.0, 1.0,    1.0, 1.0,    1.0, 0.0,
		1.0, 1.0,    0.0, 1.0,    1.0, 1.0,    1.0, 0.0,
		1.0, 1.0,    0.0, 1.0,    1.0, 1.0,    1.0, 0.0
	];


	// Indices of the vertices
	var indices = [
		offset + 0, offset + 1, offset + 2,   offset + 0, offset + 2, offset + 3,    // front
		offset + 4, offset + 5, offset + 6,   offset + 4, offset + 6, offset + 7,    // right
		offset + 8, offset + 9,offset + 10,   offset + 8,offset + 10,offset + 11,    // up
		offset + 12,offset + 13,offset + 14,  offset + 12,offset + 14,offset + 15,    // left
		offset + 16,offset + 17,offset + 18,  offset + 16,offset + 18,offset + 19,    // down
		offset + 20,offset + 21,offset + 22,  offset + 20,offset + 22,offset + 23     // back
	];

	return {
		vertices: vertices,
		colors: colors,
		normals: normals,
		texCoords: texCoords,
		indices: indices
	};
}

function initSquareVertexBuffers(offset, colour, tes) {
	// Create a unit square
	//   v1------v0
	//   /       /
	// v2------v3
	var vertices = [
		0.5, 0.0, -0.5,    // v0
		-0.5, 0.0, -0.5,   // v1
		-0.5, 0.0, 0.5,    // v2
		0.5, 0.0, 0.5      // v3
	];

	var r, g, b, alpha;
	r = colour.r;
	g = colour.g;
	b = colour.b;
	alpha = colour.alpha;

	var colors = [
		1, 1, 1, 1,    1, 1, 0, 1,    1, 0, 1, 1,    0, 1, 1, 1
	];

	var normals = [
		0.0, 1.0, 0.0,    0.0, 1.0, 0.0,    0.0, 1.0, 0.0,    0.0, 1.0, 0.0
	];

	let texCoords;
	if (tes){
		texCoords = [
			10.0,0.0,    0.0, 0.0,    0.0,10.0,   10.0,10.0 // v0-v1-v2-v3
		];
	} else{
		texCoords = [
			1.0, 0.0,    0.0, 0.0,    0.0, 1.0,    1.0, 1.0 // v0-v1-v2-v3
		];
	}

	var indices = [
		offset + 0, offset + 1, offset + 2,    offset + 0, offset + 2, offset + 3
	];

	return {
		vertices: vertices,
		colors: colors,
		normals: normals,
		texCoords: texCoords,
		indices: indices
	};
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
	// Assign the buffer object to the attribute variable
	var a_attribute = gl.getAttribLocation(gl.program, attribute);
	if (a_attribute < 0) {
		console.log('Failed to get the storage location of ' + attribute);
		return false;
	}
	gl.vertexAttribPointer(a_attribute, num, type, false, 0, 0);
	// Enable the assignment of the buffer object to the attribute variable
	gl.enableVertexAttribArray(a_attribute);

	gl.bindBuffer(gl.ARRAY_BUFFER, null);

	return true;
}


var g_matrixStack = []; // Array for storing a matrix
function pushMatrix(m) { // Store the specified matrix to the array
	// eslint-disable-next-line no-undef
	var m2 = new Matrix4(m);
	g_matrixStack.push(m2);
}

function popMatrix() { // Retrieve the matrix from the array
	return g_matrixStack.pop();
}

function draw(gl, u_ModelMatrix, u_NormalMatrix, u_LightDirection, u_UseTextures, u_Sampler) {
	// gl.uniform1i(u_Sampler, 0); // if we did we would use gl.TEXTURE0
	
	thisLoop = new Date();
	fps = 1000 / (thisLoop - lastLoop);
	lastLoop = thisLoop;
	fpsNode.nodeValue = fps.toFixed(0);

	// Clear color and depth buffer
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// Enable face culling to 'look through walls'
	gl.enable(gl.CULL_FACE);
	gl.cullFace(gl.BACK);

	// Set the light direction (in the world coordinate)
	setLightDirection(gl, u_LightDirection);

	/*
	###################################    Draw the walls and floor of the room    ###################################
	*/

	// Set position of floor
	modelMatrix.setTranslate(0, 0, 0);
	modelMatrix.rotate(g_xAngle, 1, 0, 0);
	modelMatrix.rotate(g_yAngle, 0, 1, 0);
	modelMatrix.rotate(g_zAngle, 0, 0, 1);

	pushMatrix(modelMatrix);
	modelMatrix.translate(0, -h/2, 0);
	modelMatrix.scale(w, 1.0, d);
	// Wooden floor-----------------------------------------------------------
	gl.uniform1i(u_Sampler, 0);
	if(floorLoaded) {
		gl.uniform1i(u_UseTextures, true);
	} else {
		gl.uniform1i(u_UseTextures, false);
	}
	drawshape(gl, u_ModelMatrix, u_NormalMatrix, 'wall');
	// -----------------------------------------------------------------------
	modelMatrix = popMatrix();

	// The rest doesn't use a texture
	if(wallLoaded) {
		gl.uniform1i(u_UseTextures, true);
	}else{
		gl.uniform1i(u_UseTextures, false);
	}
	gl.uniform1i(u_Sampler, 1);

	// Make back wall
	pushMatrix(modelMatrix);
	modelMatrix.rotate(90, 1, 0, 0);
	modelMatrix.translate(0, -d/2, 0);
	modelMatrix.scale(w, 1, h);
	drawshape(gl, u_ModelMatrix, u_NormalMatrix, 'wall');
	modelMatrix = popMatrix();

	// Make front wall
	pushMatrix(modelMatrix);
	modelMatrix.rotate(-90, 1, 0, 0);
	modelMatrix.translate(0, -d/2, 0);
	modelMatrix.scale(w, 1, h);
	drawshape(gl, u_ModelMatrix, u_NormalMatrix, 'wall');
	modelMatrix = popMatrix();

	// Make left wall
	pushMatrix(modelMatrix);
	modelMatrix.rotate(-90, 0, 0, 1);
	modelMatrix.translate(0, -w/2, 0);
	modelMatrix.scale(h, 1, d);
	drawshape(gl, u_ModelMatrix, u_NormalMatrix, 'wall');
	modelMatrix = popMatrix();

	// Make right wall
	pushMatrix(modelMatrix);
	modelMatrix.rotate(90, 0, 0, 1);
	modelMatrix.translate(0, -w/2, 0);
	modelMatrix.scale(h, 1, d);
	drawshape(gl, u_ModelMatrix, u_NormalMatrix, 'wall');
	modelMatrix = popMatrix();

	/*
	###################################    Draw the chair and sofa of the room    ###################################
	*/

	gl.uniform1i(u_UseTextures, false);

	var dimensions = {
		x: 0.3,
		y: 0.3,
		z: 0.3
	};
	
	// Rotate, and then translate
	var heightParabola = 6 * (anim * (1 - anim)) - 1;

	var positions = [
		[-0.8, -1, -0.6, 80],
		[-0.8, -1, 0.1, 100],
		[-0.3, -1, 0.6, 165],
		[0.2, -1, 0.7, 190]
	];

	for (var i in positions){
		var j = (parseInt(i) + 1) % positions.length;
		var [posx, posy, posz, rot] = positions[i];
		var [newposx, newposy, newposz, newrot] = positions[j];
		var newY = j == 0 ? heightParabola : ((1-anim)*posy + anim*newposy);
		pushMatrix(modelMatrix);
		modelMatrix.translate(((1-anim)*posx + anim*newposx) * w/2, newY * h/2, ((1-anim)*posz + anim*newposz) * d/2);
		modelMatrix.rotate((1-anim)*rot + anim*newrot, 0, 1, 0);
		drawSeat(gl, u_ModelMatrix, u_NormalMatrix, dimensions);
		modelMatrix = popMatrix();
	}

	// Table
	dimensions = {x: 2, y: 1, z: 1};
	pushMatrix(modelMatrix);
	modelMatrix.translate(0, -h/2, 0);
	var tableHeight = drawTable(gl, u_ModelMatrix, u_NormalMatrix, dimensions);
	modelMatrix = popMatrix();

	var tankHeight = 1;
	dimensions.y = tankHeight;
	pushMatrix(modelMatrix);
	modelMatrix.translate(0, tableHeight - h/2, 0);
	drawFishTank(gl, u_ModelMatrix, u_NormalMatrix, dimensions, tankTilt, u_Sampler, u_UseTextures);
	modelMatrix = popMatrix();
}


function drawshape(gl, u_ModelMatrix, u_NormalMatrix, name) {
	pushMatrix(modelMatrix);

	// Pass the model matrix to the uniform variable
	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);

	// Calculate the normal transformation matrix and pass it to u_NormalMatrix
	g_normalMatrix.setInverseOf(modelMatrix);
	g_normalMatrix.transpose();
	gl.uniformMatrix4fv(u_NormalMatrix, false, g_normalMatrix.elements);

	// Draw the shape
	var n = shapes[name].n;
	var offset = shapes[name].offset;

	// console.log(name + ' ' + n + ' ' + offset);
	gl.drawElements(gl.TRIANGLES, n, gl.UNSIGNED_SHORT, offset*2);

	modelMatrix = popMatrix();
}

function initSeatMatrices() {
	var seatMatrix = new Matrix4();
	seatMatrix.setTranslate(0, 0, 0);

	// Model the 4 chair legs
	var legHeight = 0;
	/*
	pushMatrix(modelMatrix);
	modelMatrix.translate(1.5, 0.5, 1.5);  // Translation
	drawshape(gl, u_ModelMatrix, u_NormalMatrix, nCube);
	modelMatrix.translate(0, 0, -3);
	drawshape(gl, u_ModelMatrix, u_NormalMatrix, nCube);
	modelMatrix.translate(-3, 0, 0);
	drawshape(gl, u_ModelMatrix, u_NormalMatrix, nCube);
	modelMatrix.translate(0, 0, 3);
	drawshape(gl, u_ModelMatrix, u_NormalMatrix, nCube);
	modelMatrix = popMatrix();
	*/

	// Draw the chair seat
	var seatThickness = 0.75;
	pushMatrix(seatMatrix);
	seatMatrix.translate(0, legHeight + seatThickness/2, 0);
	seatMatrix.scale(4, seatThickness, 5);
	seatMatrices.push(seatMatrix);
	seatMatrix = popMatrix();

	// Draw the arms 1.5 * 4 * 4
	var armHeight = 4;
	pushMatrix(seatMatrix);
	seatMatrix.translate(2.5, legHeight + armHeight/2, 0);
	seatMatrix.scale(1, armHeight, 5);
	seatMatrices.push(seatMatrix);
	seatMatrix = popMatrix();
	pushMatrix(seatMatrix);
	seatMatrix.translate(-2.5, legHeight + armHeight/2, 0);
	seatMatrix.scale(1, armHeight, 5);
	seatMatrices.push(seatMatrix);
	seatMatrix = popMatrix();

	// Draw the back
	var backHeight = 4;
	pushMatrix(seatMatrix);
	seatMatrix.translate(0, legHeight + backHeight/2, -2.25);
	seatMatrix.scale(4, 4, 0.5);
	seatMatrices.push(seatMatrix);
	seatMatrix = popMatrix();

	// Draw seat cushion
	var seatCushHeight = 1;
	pushMatrix(seatMatrix);
	seatMatrix.translate(0, legHeight + seatThickness + seatCushHeight/2, 0.1);
	seatMatrix.scale(4, seatCushHeight, 5.2);
	seatMatrices.push(seatMatrix);
	seatMatrix = popMatrix();

	// Draw back cushion
	var backCushHeight = 4;
	pushMatrix(seatMatrix);
	seatMatrix.translate(0, legHeight + seatThickness + backCushHeight/2, -1.75);
	seatMatrix.scale(4, backCushHeight, 0.5);
	seatMatrices.push(seatMatrix);
	seatMatrix = popMatrix();

	// console.log(seatMatrices);
}

function drawSeat(gl, u_ModelMatrix, u_NormalMatrix, dimensions) {
	

	modelMatrix.scale(dimensions.x, dimensions.y, dimensions.z);

	for (var componentMatrix of seatMatrices) {
		pushMatrix(modelMatrix);
		modelMatrix.concat(componentMatrix);
		// console.log(modelMatrix);
		drawshape(gl, u_ModelMatrix, u_NormalMatrix, 'furniture');
		modelMatrix = popMatrix();
	}
}

function drawTable(gl, u_ModelMatrix, u_NormalMatrix, dimensions) {

	modelMatrix.scale(dimensions.x, dimensions.y, dimensions.z);

	var baseHeight = 1;
	pushMatrix(modelMatrix);
	modelMatrix.translate(0, baseHeight/2, 0);
	// drawshape(gl, u_ModelMatrix, u_NormalMatrix, 'furniture');
	modelMatrix = popMatrix();

	var tableThickness = 0.5;
	pushMatrix(modelMatrix);
	modelMatrix.translate(0, baseHeight + tableThickness/2, 0);
	modelMatrix.scale(2, tableThickness, 2);
	// drawshape(gl, u_ModelMatrix, u_NormalMatrix, 'furniture');
	modelMatrix = popMatrix();

	return dimensions.y * (baseHeight + tableThickness);
}

function drawFishTank(gl, u_ModelMatrix, u_NormalMatrix, dimensions, tilt, u_Sampler, u_UseTextures) {
	pushMatrix(modelMatrix);
	var gt = 0.1;
	var depth = 0.6;
	// Apply tilt
	if (tilt > 0){
		modelMatrix.translate(-dimensions.x/2, 0, 0);
		modelMatrix.rotate(tilt, 0, 0, 1);
		modelMatrix.translate(dimensions.x/2, 0, 0);
	}else if (tilt < 0) {
		modelMatrix.translate(dimensions.x/2, 0, 0);
		modelMatrix.rotate(tilt, 0, 0, 1);
		modelMatrix.translate(-dimensions.x/2, 0, 0);
	}

	var choice = 'water' + String(tilt);
	// console.log(choice);
	modelMatrix.scale(dimensions.x, dimensions.y, dimensions.z);

	// Fish tank - water
	pushMatrix(modelMatrix);
	modelMatrix.translate(0, -(1-depth-gt/2)/2 + dimensions.y/2, 0);
	modelMatrix.scale(1-gt, depth-gt, 1-gt);
	// drawshape(gl, u_ModelMatrix, u_NormalMatrix, choice);
	modelMatrix = popMatrix();

	// Fish tank - glass	
	pushMatrix(modelMatrix);
	modelMatrix.translate(0, dimensions.y/2, 0);
	modelMatrix.scale(1, 1, 1);
	// drawshape(gl, u_ModelMatrix, u_NormalMatrix, 'glass');
	modelMatrix = popMatrix();

	modelMatrix = popMatrix();

	// Tim the fish
	if (fishLoaded) {
		gl.uniform1i(u_Sampler, 2);
		gl.uniform1i(u_UseTextures, true);
		gl.disable(gl.CULL_FACE);
		// Position Tim
		pushMatrix(modelMatrix);
		modelMatrix.translate(0, -(1-depth-gt/2)/2 + dimensions.y/2, 0);
		modelMatrix.rotate(-90, 1, 0, 0);
		drawshape(gl, u_ModelMatrix, u_NormalMatrix, 'fish');
		modelMatrix = popMatrix();
	}
}

function setLightDirection(gl, u_LightDirection) {
	// eslint-disable-next-line no-undef
	var lightDirection = new Vector3([2.0, 3.0, 4.0]);
	// eslint-disable-next-line no-undef
	var lightMatrix = new Matrix4();
	lightMatrix.setRotate(g_xAngle, 1, 0, 0);
	lightMatrix.rotate(g_yAngle, 0, 1, 0);

	var x = lightDirection.elements[0];
	var y = lightDirection.elements[1];
	var z = lightDirection.elements[2];
	var rotatedLightDir = transformPoint(new Vector3([x, y, z]), new Matrix4(lightMatrix));
	rotatedLightDir.normalize();
	gl.uniform3fv(u_LightDirection, rotatedLightDir.elements);
}

function transformPoint(point, m) {
	var elements = new Float32Array([point.elements[0], point.elements[1], point.elements[2], 1,    0, 0, 0, 0,    0, 0, 0, 0,    0, 0, 0, 0]);
	// eslint-disable-next-line no-undef
	var pointMatrix = new Matrix4({elements: elements});
	var transformation = m.concat(pointMatrix);
	// eslint-disable-next-line no-undef
	return new Vector3([
		transformation.elements[0],
		transformation.elements[1],
		transformation.elements[2],
	]);
}

//
// Initialize a texture and load an image.
// When the image finished loading copy it into the texture.
//
function loadTexture(gl, texture, u_Sampler, image, texUnit) {
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);// Flip the image's y-axis
	// Make the texture unit active
	if (texUnit === 0) {
		gl.activeTexture(gl.TEXTURE0);
	} else if(texUnit === 1){
		gl.activeTexture(gl.TEXTURE1);
	} else {
		gl.activeTexture(gl.TEXTURE2);
	}
	// Bind the texture object to the target
	gl.bindTexture(gl.TEXTURE_2D, texture);   
	// Set the image to texture
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
	// Set texture parameters
	gl.generateMipmap(gl.TEXTURE_2D);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	if (texUnit !== 2){
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);	
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
	}
}
