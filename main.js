'use strict';

let gl;                         // The webgl context.
let surface;                    // A surface model
let shProgram;                  // A shader program
let lightProgram;
let lightBuffer;
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.

const LIGHT_ORBIT_RADIUS = 2.0;
const LIGHT_ORBIT_HEIGHT = 0.6;
const LIGHT_ANGULAR_SPEED = 0.8;

function deg2rad(angle) {
    return angle * Math.PI / 180;
}


// Constructor
function ShaderProgram(name, program) {

    this.name = name;
    this.prog = program;

    // Location of the attribute variable in the shader program.
    this.iAttribVertex = -1;
    this.iAttribNormal = -1;
    // Location of the uniform matrix representing the combined transformation.
    this.iModelViewProjectionMatrix = -1;
    this.iModelViewMatrix = -1;
    this.iNormalMatrix = -1;
    this.iLightPosition = -1;

    this.Use = function() {
        gl.useProgram(this.prog);
    }
}


function getLightPosition(time) {
    const angle = LIGHT_ANGULAR_SPEED * time;
    return [
        LIGHT_ORBIT_RADIUS * Math.cos(angle),
        LIGHT_ORBIT_RADIUS * Math.sin(angle),
        LIGHT_ORBIT_HEIGHT
    ];
}


function draw() {
    const canvas = gl.canvas;
    const width = Math.round(canvas.clientWidth * window.devicePixelRatio);
    const height = Math.round(canvas.clientHeight * window.devicePixelRatio);

    if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
    }

    gl.viewport(0, 0, canvas.width, canvas.height);

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    /* Set the values of the projection transformation */
    let aspect = canvas.width / canvas.height;
    let projection = m4.perspective(Math.PI / 10, aspect, 4, 16);

    /* Get the view matrix from the SimpleRotator object.*/
    let modelView = spaceball.getViewMatrix();

    let rotateToPointZero = m4.axisRotation([1, 0, 0], Math.PI / 2);
    let translateToPointZero = m4.translation(0,0,-10);

    let matAccum0 = m4.multiply(rotateToPointZero, modelView );
    let matAccum1 = m4.multiply(translateToPointZero, matAccum0 );

    /* Multiply the projection matrix times the modelview matrix to give the
       combined transformation matrix, and send that to the shader program. */
    let modelViewProjection = m4.multiply(projection, matAccum1 );

    let normalMatrix = m4.transpose(m4.inverse(matAccum1));

    let lightModel = getLightPosition(performance.now() / 1000);
    let lightEye   = m4.transformPoint(matAccum1, lightModel);

    shProgram.Use();
    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection );
    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, matAccum1 );
    gl.uniformMatrix4fv(shProgram.iNormalMatrix, false, normalMatrix );
    gl.uniform3fv(shProgram.iLightPosition, lightEye );

    surface.Draw();

    lightProgram.Use();
    gl.uniformMatrix4fv(lightProgram.iModelViewProjectionMatrix, false, modelViewProjection );

    gl.disableVertexAttribArray(shProgram.iAttribNormal);
    gl.bindBuffer(gl.ARRAY_BUFFER, lightBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lightModel), gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(lightProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(lightProgram.iAttribVertex);
    gl.drawArrays(gl.POINTS, 0, 1);
}


function animate() {
    draw();
    window.requestAnimationFrame(animate);
}


function updateSurface() {
    const uSteps = parseInt(document.getElementById("uSlider").value);
    const vSteps = parseInt(document.getElementById("vSlider").value);

    document.getElementById("uValue").textContent = uSteps;
    document.getElementById("vValue").textContent = vSteps;

    let data = {};
    CreateSurfaceData(data, uSteps, vSteps);
    surface.BufferData(data.verticesF32, data.normalsF32, data.indicesU16);
}


/* Initialize the WebGL context. Called from init() */
function initGL() {
    let prog = createProgram( gl, vertexShaderSource, fragmentShaderSource );

    shProgram = new ShaderProgram('Gouraud', prog);
    shProgram.Use();

    shProgram.iAttribVertex              = gl.getAttribLocation(prog, "vertex");
    shProgram.iAttribNormal              = gl.getAttribLocation(prog, "normal");
    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    shProgram.iModelViewMatrix           = gl.getUniformLocation(prog, "ModelViewMatrix");
    shProgram.iNormalMatrix              = gl.getUniformLocation(prog, "NormalMatrix");
    shProgram.iLightPosition             = gl.getUniformLocation(prog, "lightPosition");

    let lightProg = createProgram( gl, lightVertexShaderSource, lightFragmentShaderSource );

    lightProgram = new ShaderProgram('Light', lightProg);
    lightProgram.iAttribVertex              = gl.getAttribLocation(lightProg, "vertex");
    lightProgram.iModelViewProjectionMatrix = gl.getUniformLocation(lightProg, "ModelViewProjectionMatrix");

    lightBuffer = gl.createBuffer();

    surface = new Model('Surface');
    updateSurface();

    gl.enable(gl.DEPTH_TEST);
}


/* Creates a program for use in the WebGL context gl, and returns the
 * identifier for that program.  If an error occurs while compiling or
 * linking the program, an exception of type Error is thrown.  The error
 * string contains the compilation or linking error.  If no error occurs,
 * the program identifier is the return value of the function.
 * The second and third parameters are strings that contain the
 * source code for the vertex shader and for the fragment shader.
 */
function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader( gl.VERTEX_SHADER );
    gl.shaderSource(vsh,vShader);
    gl.compileShader(vsh);
    if ( ! gl.getShaderParameter(vsh, gl.COMPILE_STATUS) ) {
        throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
     }
    let fsh = gl.createShader( gl.FRAGMENT_SHADER );
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if ( ! gl.getShaderParameter(fsh, gl.COMPILE_STATUS) ) {
       throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog,vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if ( ! gl.getProgramParameter( prog, gl.LINK_STATUS) ) {
       throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
}


/**
 * initialization function that will be called when the page has loaded
 */
function init() {
    let canvas;
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl");
        if ( ! gl ) {
            throw "Browser does not support WebGL";
        }
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }
    try {
        initGL();  // initialize the WebGL graphics context
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
        return;
    }

    document.getElementById("uSlider").addEventListener("input", updateSurface);
    document.getElementById("vSlider").addEventListener("input", updateSurface);

    spaceball = new TrackballRotator(canvas, null, 0);

    animate();
}
