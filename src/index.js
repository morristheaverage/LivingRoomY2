/* eslint-disable no-console */
// Vertex shader program
var VSHADER_SOURCE =
  'attribute vec4 a_Position;\n' +
  'attribute vec4 a_Color;\n' +
  'attribute vec4 a_Normal;\n' +        // Normal
  'uniform mat4 u_ModelMatrix;\n' +
  'uniform mat4 u_NormalMatrix;\n' +
  'uniform mat4 u_ViewMatrix;\n' +
  'uniform mat4 u_ProjMatrix;\n' +
  'uniform vec3 u_LightColor;\n' +     // Light color
  'uniform vec3 u_LightDirection;\n' + // Light direction (in the world coordinate, normalized)
  'varying vec4 v_Color;\n' +
  'uniform bool u_isLighting;\n' +
  'void main() {\n' +
  '  gl_Position = u_ProjMatrix * u_ViewMatrix * u_ModelMatrix * a_Position;\n' +
  '  if(u_isLighting)\n' + 
  '  {\n' +
  '     vec3 normal = normalize((u_NormalMatrix * a_Normal).xyz);\n' +
  '		float ambient = 0.3;\n' +
  '     float nDotL = max(dot(normal, u_LightDirection), ambient);\n' +
  // Calculate the color due to diffuse reflection
  '     vec3 diffuse = u_LightColor * a_Color.rgb * nDotL;\n' +
  '     v_Color = vec4(diffuse, a_Color.a);\n' +  '  }\n' +
  '  else\n' +
  '  {\n' +
  '     v_Color = a_Color;\n' +
  '  }\n' + 
  '}\n';

// Fragment shader program
var FSHADER_SOURCE =
//   '#ifdef GL_ES\n' +(should always be true according to documentation)
  'precision mediump float;\n' +
//   '#endif\n' +
  'varying vec4 v_Color;\n' +
  'void main() {\n' +
  '  gl_FragColor = v_Color;\n' +
  '}\n';

var modelMatrix = new Matrix4(); // The model matrix
var viewMatrix = new Matrix4();  // The view matrix
var projMatrix = new Matrix4();  // The projection matrix
var g_normalMatrix = new Matrix4();  // Coordinate transformation matrix for normals

var ANGLE_STEP = 3.0;  // The increments of rotation angle (degrees)
var g_xAngle = 0.0;    // The rotation x angle (degrees)
var g_yAngle = 0.0;    // The rotation y angle (degrees)

var lastLoop = new Date();
var thisLoop, fps;
var fpsElement = document.getElementById('fps');
var fpsNode = document.createTextNode('');
fpsElement.append(fpsNode);

var seatMatrices = [];

function main() {
	// Retrieve <canvas> element
	var canvas = document.getElementById('webgl');

	// Get the rendering context for WebGL
	var gl = getWebGLContext(canvas);
	if (!gl) {
		console.log('Failed to get the rendering context for WebGL');
		return;
	}

	// Initialize shaders
	if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
		console.log('Failed to intialize shaders.');
		return;
	}

	// Set clear color and enable hidden surface removal
	gl.clearColor(0.0, 0.0, 0.0, 1.0);
	gl.enable(gl.DEPTH_TEST);

	// Enable face culling to 'look through walls'
	gl.enable(gl.CULL_FACE);
	gl.cullFace(gl.BACK);

	// Clear color and depth buffer
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// Get the storage locations of uniform attributes
	var u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
	var u_ViewMatrix = gl.getUniformLocation(gl.program, 'u_ViewMatrix');
	var u_NormalMatrix = gl.getUniformLocation(gl.program, 'u_NormalMatrix');
	var u_ProjMatrix = gl.getUniformLocation(gl.program, 'u_ProjMatrix');
	var u_LightColor = gl.getUniformLocation(gl.program, 'u_LightColor');
	var u_LightDirection = gl.getUniformLocation(gl.program, 'u_LightDirection');

	// Trigger using lighting or not
	var u_isLighting = gl.getUniformLocation(gl.program, 'u_isLighting'); 

	if (!u_ModelMatrix || !u_ViewMatrix || !u_NormalMatrix ||
      !u_ProjMatrix || !u_LightColor || !u_LightDirection ||
      !u_isLighting ) { 
		console.log('Failed to Get the storage locations of u_ModelMatrix, u_ViewMatrix, and/or u_ProjMatrix');
		return;
	}

	// Set the light color (white)
	gl.uniform3f(u_LightColor, 1.0, 1.0, 1.0);
	gl.uniform1i(u_isLighting, true); // Will apply lighting
	

	// Calculate the view matrix and the projection matrix
	viewMatrix.setLookAt(0, 0, 15, 0, 0, -100, 0, 1, 0);
	projMatrix.setPerspective(30, canvas.width/canvas.height, 1, 100);
	// Pass the model, view, and projection matrix to the uniform variable respectively
	gl.uniformMatrix4fv(u_ViewMatrix, false, viewMatrix.elements);
	gl.uniformMatrix4fv(u_ProjMatrix, false, projMatrix.elements);

	// Load seat data
	initSeatMatrices();


	document.onkeydown = function(ev){
		keydown(ev, gl, u_ModelMatrix, u_NormalMatrix, u_isLighting, u_LightDirection);
	};

	draw(gl, u_ModelMatrix, u_NormalMatrix, u_isLighting, u_LightDirection);
}

function keydown(ev, gl, u_ModelMatrix, u_NormalMatrix, u_isLighting, u_LightDirection) {
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
	default: return; // Skip drawing at no effective action
	}

	// Draw the scene
	draw(gl, u_ModelMatrix, u_NormalMatrix, u_isLighting, u_LightDirection);
}


function initCubeVertexBuffers(gl, offset, colour) {
	// Create a cube
	//    v6----- v5
	//   /|      /|
	//  v1------v0|
	//  | |     | |
	//  | |v7---|-|v4
	//  |/      |/
	//  v2------v3
	var vertices = new Float32Array([   // Coordinates
		0.5, 0.5, 0.5,  -0.5, 0.5, 0.5,  -0.5,-0.5, 0.5,   0.5,-0.5, 0.5, // v0-v1-v2-v3 front
		0.5, 0.5, 0.5,   0.5,-0.5, 0.5,   0.5,-0.5,-0.5,   0.5, 0.5,-0.5, // v0-v3-v4-v5 right
		0.5, 0.5, 0.5,   0.5, 0.5,-0.5,  -0.5, 0.5,-0.5,  -0.5, 0.5, 0.5, // v0-v5-v6-v1 up
		-0.5, 0.5, 0.5,  -0.5, 0.5,-0.5,  -0.5,-0.5,-0.5,  -0.5,-0.5, 0.5, // v1-v6-v7-v2 left
		-0.5,-0.5,-0.5,   0.5,-0.5,-0.5,   0.5,-0.5, 0.5,  -0.5,-0.5, 0.5, // v7-v4-v3-v2 down
		0.5,-0.5,-0.5,  -0.5,-0.5,-0.5,  -0.5, 0.5,-0.5,   0.5, 0.5,-0.5  // v4-v7-v6-v5 back
	]);

	var r, g, b;
	r = colour.r;
	g = colour.g;
	b = colour.b;
	var colors = new Float32Array([    // Colors
		r, g, b,   r, g, b,   r, g, b,   r, g, b,     // v0-v1-v2-v3 front
		r, g, b,   r, g, b,   r, g, b,   r, g, b,     // v0-v3-v4-v5 right
		r, g, b,   r, g, b,   r, g, b,   r, g, b,     // v0-v5-v6-v1 up
		r, g, b,   r, g, b,   r, g, b,   r, g, b,     // v1-v6-v7-v2 left
		r, g, b,   r, g, b,   r, g, b,   r, g, b,     // v7-v4-v3-v2 down
		r, g, b,   r, g, b,   r, g, b,   r, g, b      // v4-v7-v6-v5 back
	]);


	var normals = new Float32Array([    // Normal
		0.0, 0.0, 1.0,   0.0, 0.0, 1.0,   0.0, 0.0, 1.0,   0.0, 0.0, 1.0,  // v0-v1-v2-v3 front
		1.0, 0.0, 0.0,   1.0, 0.0, 0.0,   1.0, 0.0, 0.0,   1.0, 0.0, 0.0,  // v0-v3-v4-v5 right
		0.0, 1.0, 0.0,   0.0, 1.0, 0.0,   0.0, 1.0, 0.0,   0.0, 1.0, 0.0,  // v0-v5-v6-v1 up
		-1.0, 0.0, 0.0,  -1.0, 0.0, 0.0,  -1.0, 0.0, 0.0,  -1.0, 0.0, 0.0,  // v1-v6-v7-v2 left
		0.0,-1.0, 0.0,   0.0,-1.0, 0.0,   0.0,-1.0, 0.0,   0.0,-1.0, 0.0,  // v7-v4-v3-v2 down
		0.0, 0.0,-1.0,   0.0, 0.0,-1.0,   0.0, 0.0,-1.0,   0.0, 0.0,-1.0   // v4-v7-v6-v5 back
	]);


	// Indices of the vertices
	var indices = new Uint8Array([
		offset + 0, offset + 1, offset + 2,   offset + 0, offset + 2, offset + 3,    // front
		offset + 4, offset + 5, offset + 6,   offset + 4, offset + 6, offset + 7,    // right
		offset + 8, offset + 9,offset + 10,   offset + 8,offset + 10,offset + 11,    // up
		offset + 12,offset + 13,offset + 14,  offset + 12,offset + 14,offset + 15,    // left
		offset + 16,offset + 17,offset + 18,  offset + 16,offset + 18,offset + 19,    // down
		offset + 20,offset + 21,offset + 22,  offset + 20,offset + 22,offset + 23     // back
	]);


	// Write the vertex property to buffers (coordinates, colors and normals)
	if (!initArrayBuffer(gl, 'a_Position', vertices, 3, gl.FLOAT)) return -1;
	if (!initArrayBuffer(gl, 'a_Color', colors, 3, gl.FLOAT)) return -1;
	if (!initArrayBuffer(gl, 'a_Normal', normals, 3, gl.FLOAT)) return -1;

	// Write the indices to the buffer object
	var indexBuffer = gl.createBuffer();
	if (!indexBuffer) {
		console.log('Failed to create the buffer object');
		return false;
	}

	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

	return {
		vertices: vertices,
		colors: colors,
		normals: normals,
		indices: indices
	};
}

function initSquareVertexBuffers(gl) {
	// Create a unit square
	//   v1------v0
	//   /       /
	// v2------v3
	var vertices = new Float32Array([
		0.5, 0.0, -0.5,    // v0
		-0.5, 0.0, -0.5,   // v1
		-0.5, 0.0, 0.5,    // v2
		0.5, 0.0, 0.5      // v3
	]);

	var colors = new Float32Array([
		1, 1, 1,    1, 1, 0,    1, 0, 1,    0, 1, 1
	]);

	var normals = new Float32Array([
		0.0, 1.0, 0.0,    0.0, 1.0, 0.0,    0.0, 1.0, 0.0,    0.0, 1.0, 0.0
	]);

	var indices = new Uint8Array([
		0, 1, 2,    0, 2, 3
	]);

	// Write the vertex property to buffers (coordinates, colors and normals)
	if(!initArrayBuffer(gl, 'a_Position', vertices, 3, gl.FLOAT)) return -1;
	if (!initArrayBuffer(gl, 'a_Color', colors, 3, gl.FLOAT)) return -1;
	if (!initArrayBuffer(gl, 'a_Normal', normals, 3, gl.FLOAT)) return -1;

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

function initAxesVertexBuffers(gl) {

	var verticesColors = new Float32Array([
		// Vertex coordinates and color (for axes)
		-20.0,  0.0,   0.0,  1.0,  1.0,  1.0,  // (x,y,z), (r,g,b) 
		20.0,  0.0,   0.0,  1.0,  1.0,  1.0,
		0.0,  20.0,   0.0,  1.0,  1.0,  1.0, 
		0.0, -20.0,   0.0,  1.0,  1.0,  1.0,
		0.0,   0.0, -20.0,  1.0,  1.0,  1.0, 
		0.0,   0.0,  20.0,  1.0,  1.0,  1.0 
	]);
	var n = 6;

	// Create a buffer object
	var vertexColorBuffer = gl.createBuffer();  
	if (!vertexColorBuffer) {
		console.log('Failed to create the buffer object');
		return false;
	}

	// Bind the buffer object to target
	gl.bindBuffer(gl.ARRAY_BUFFER, vertexColorBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, verticesColors, gl.STATIC_DRAW);

	var FSIZE = verticesColors.BYTES_PER_ELEMENT;
	//Get the storage location of a_Position, assign and enable buffer
	var a_Position = gl.getAttribLocation(gl.program, 'a_Position');
	if (a_Position < 0) {
		console.log('Failed to get the storage location of a_Position');
		return -1;
	}
	gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, FSIZE * 6, 0);
	gl.enableVertexAttribArray(a_Position);  // Enable the assignment of the buffer object

	// Get the storage location of a_Position, assign buffer and enable
	var a_Color = gl.getAttribLocation(gl.program, 'a_Color');
	if(a_Color < 0) {
		console.log('Failed to get the storage location of a_Color');
		return -1;
	}
	gl.vertexAttribPointer(a_Color, 3, gl.FLOAT, false, FSIZE * 6, FSIZE * 3);
	gl.enableVertexAttribArray(a_Color);  // Enable the assignment of the buffer object

	// Unbind the buffer object
	gl.bindBuffer(gl.ARRAY_BUFFER, null);

	return n;
}

var g_matrixStack = []; // Array for storing a matrix
function pushMatrix(m) { // Store the specified matrix to the array
	var m2 = new Matrix4(m);
	g_matrixStack.push(m2);
}

function popMatrix() { // Retrieve the matrix from the array
	return g_matrixStack.pop();
}

function draw(gl, u_ModelMatrix, u_NormalMatrix, u_isLighting, u_LightDirection) {
	
	thisLoop = new Date();
	fps = 1000 / (thisLoop - lastLoop);
	lastLoop = thisLoop;
	fpsNode.nodeValue = fps.toFixed(0);

	// Clear color and depth buffer
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	/*
	gl.uniform1i(u_isLighting, false); // Will not apply lighting

	// Set the vertex coordinates and color (for the x, y axes)

	var nAxes = initAxesVertexBuffers(gl);
	if (nAxes < 0) {
		console.log('Failed to set the vertex information');
		return;
	}

	// Calculate the view matrix and the projection matrix
	modelMatrix.setTranslate(0, 0, 0);  // No Translation
	// Pass the model matrix to the uniform variable
	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);

	// Draw x and y axes
	gl.drawArrays(gl.LINES, 0, nAxes);

	*/

	// Set the light direction (in the world coordinate)
	setLightDirection(gl, u_LightDirection);
	

	gl.uniform1i(u_isLighting, true); // Will apply lighting

	// Set the vertex coordinates and color (for the square)
	var nSquare = initSquareVertexBuffers(gl);
	if (nSquare < 0) {
		console.log('Failed to set the vertex information');
		return;
	}

	// Room dimensions
	let h = 5;
	let d = 10;
	let w = 12;

	/*
	###################################    Draw the walls and floor of the room    ###################################
	*/

	// Set position of floor
	modelMatrix.setTranslate(0, 0, 0);
	modelMatrix.rotate(g_xAngle, 1, 0, 0);
	modelMatrix.rotate(g_yAngle, 0, 1, 0);

	pushMatrix(modelMatrix);
	modelMatrix.translate(0, -h/2, 0);
	modelMatrix.scale(w, 1.0, d);
	drawshape(gl, u_ModelMatrix, u_NormalMatrix, nSquare);
	modelMatrix = popMatrix();

	// Make back wall
	pushMatrix(modelMatrix);
	modelMatrix.rotate(90, 1, 0, 0);
	modelMatrix.translate(0, -d/2, 0);
	modelMatrix.scale(w, 1, h);
	drawshape(gl, u_ModelMatrix, u_NormalMatrix, nSquare);
	modelMatrix = popMatrix();

	// Make front wall
	pushMatrix(modelMatrix);
	modelMatrix.rotate(-90, 1, 0, 0);
	modelMatrix.translate(0, -d/2, 0);
	modelMatrix.scale(w, 1, h);
	drawshape(gl, u_ModelMatrix, u_NormalMatrix, nSquare);
	modelMatrix = popMatrix();

	// Make left wall
	pushMatrix(modelMatrix);
	modelMatrix.rotate(-90, 0, 0, 1);
	modelMatrix.translate(0, -w/2, 0);
	modelMatrix.scale(h, 1, d);
	drawshape(gl, u_ModelMatrix, u_NormalMatrix, nSquare);
	modelMatrix = popMatrix();

	// Make right wall
	pushMatrix(modelMatrix);
	modelMatrix.rotate(90, 0, 0, 1);
	modelMatrix.translate(0, -w/2, 0);
	modelMatrix.scale(h, 1, d);
	drawshape(gl, u_ModelMatrix, u_NormalMatrix, nSquare);
	modelMatrix = popMatrix();

	/*
	###################################    Draw the chair and sofa of the room    ###################################
	*/

	var dimensions = {
		x: 0.3,
		y: 0.3,
		z: 0.3
	};
	// Set the vertex coordinates and color (for the cube)
	var colour = {r: 1, g: 0, b: 0};
	// Rotate, and then translate
	pushMatrix(modelMatrix);
	modelMatrix.translate(-0.8 * w/2, -h/2, 0.1 * d/2);
	modelMatrix.rotate(100, 0, 1, 0);
	drawSeat(gl, u_ModelMatrix, u_NormalMatrix, dimensions, colour);
	modelMatrix = popMatrix();

	
	pushMatrix(modelMatrix);
	modelMatrix.translate(-0.8 * w/2, -h/2, -0.6 * d/2);
	modelMatrix.rotate(80, 0, 1, 0);
	drawSeat(gl, u_ModelMatrix, u_NormalMatrix, dimensions, colour);
	modelMatrix = popMatrix();
	
	// Now draw the sofa
	dimensions.x = 1;
	colour.g = 1;
	pushMatrix(modelMatrix);
	modelMatrix.translate(0.1 * w/2, -h/2, 0.7 * d/2);
	modelMatrix.rotate(180, 0, 1, 0);
	drawSeat(gl, u_ModelMatrix, u_NormalMatrix, dimensions, colour);
	modelMatrix = popMatrix();
	

}


function drawshape(gl, u_ModelMatrix, u_NormalMatrix, n) {
	pushMatrix(modelMatrix);

	// Pass the model matrix to the uniform variable
	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);

	// Calculate the normal transformation matrix and pass it to u_NormalMatrix
	g_normalMatrix.setInverseOf(modelMatrix);
	g_normalMatrix.transpose();
	gl.uniformMatrix4fv(u_NormalMatrix, false, g_normalMatrix.elements);

	// Draw the shape+
	gl.drawElements(gl.TRIANGLES, n, gl.UNSIGNED_BYTE, 0);

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

function drawSeat(gl, u_ModelMatrix, u_NormalMatrix, dimensions, colour) {
	// Set the vertex coordinates and color (for the cube)
	var nCube = initCubeVertexBuffers(gl, 0, colour);
	if (nCube.indices.length < 0) {
		console.log('Failed to set the vertex information');
		return;
	}

	modelMatrix.scale(dimensions.x, dimensions.y, dimensions.z);

	for (var componentMatrix of seatMatrices) {
		pushMatrix(modelMatrix);
		modelMatrix.concat(componentMatrix);
		// console.log(modelMatrix);
		drawshape(gl, u_ModelMatrix, u_NormalMatrix, nCube.indices.length);
		modelMatrix = popMatrix();
	}
}

function setLightDirection(gl, u_LightDirection) {
	var lightDirection = new Vector3([2.0, 3.0, 4.0]);
	var lightMatrix = new Matrix4();
	lightMatrix.setRotate(g_xAngle, 1, 0, 0);
	lightMatrix.rotate(g_yAngle, 0, 1, 0);

	var y_angle = Math.PI * g_yAngle / 180;
	var x_angle = Math.PI * g_xAngle / 180;
	var cy = Math.cos(y_angle);
	var sy = Math.sin(y_angle);
	var cx = Math.cos(x_angle);
	var sx = Math.sin(x_angle);
	var x = lightDirection.elements[0];
	var y = lightDirection.elements[1];
	var z = lightDirection.elements[2];
	var rotatedLightDir = new Vector3([
		x*cy + z*sy,
		x*sx*sy + y*cx - z*sx*cy,
		-x*sy*cx + y*sy + z*cx*cy
	]);

	// console.log(rotatedLightDir);
	// console.log(transform({x: x, y: y, z: z}, lightMatrix));

	rotatedLightDir.normalize();     // Normalize
	gl.uniform3fv(u_LightDirection, rotatedLightDir.elements);
}

function transform(point, m) {
	var elements = new Float32Array([point.x, point.y, point.z, 1,    0, 0, 0, 0,    0, 0, 0, 0,    0, 0, 0, 0]);
	var pointMatrix = new Matrix4({elements: elements});
	var transformation = m.concat(pointMatrix);
	return {
		x: transformation.elements[0],
		y: transformation.elements[1],
		z: transformation.elements[2],
	};
}