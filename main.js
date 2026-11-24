'use strict';

let gl;                         // The webgl context.
let surface;                    // A surface model
let shProgram;                  // A shader program
let lightProgram;
let lightBuffer;
let pointBuffer;
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.

const LIGHT_ORBIT_RADIUS = 2.0;
const LIGHT_ORBIT_HEIGHT = 0.6;
const LIGHT_ANGULAR_SPEED = 0.8;

const POINT_STEP = 0.005;

let texPointU = 0.0;
let texPointV = 0.5;
let texAngle  = 0;

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
    this.iAttribTangent = -1;
    this.iAttribTexCoords = -1;
    // Location of the uniform matrix representing the combined transformation.
    this.iModelViewProjectionMatrix = -1;
    this.iModelViewMatrix = -1;
    this.iNormalMatrix = -1;
    this.iLightPosition = -1;
    this.iTMU0 = -1;
    this.iTMU1 = -1;
    this.iTMU2 = -1;
    this.iTexPoint = -1;
    this.iTexAngle = -1;
    this.iTexPeriodU = -1;
    this.iColor = -1;

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


function getPointPosition() {
    const z = PEAR_A * (1 - texPointV);
    const beta = 2 * Math.PI * texPointU;
    const p = pearPoint(z, beta);
    const n = AnalyticNormal(z, beta);
    return add(p, scale(n, 0.03));
}


function drawMarker(buffer, position, color) {
    gl.uniform4fv(lightProgram.iColor, color);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(position), gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(lightProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(lightProgram.iAttribVertex);
    gl.drawArrays(gl.POINTS, 0, 1);
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

    gl.uniform1i(shProgram.iTMU0, 0);
    gl.uniform1i(shProgram.iTMU1, 1);
    gl.uniform1i(shProgram.iTMU2, 2);

    gl.uniform2fv(shProgram.iTexPoint, [TEX_REPEAT_U * texPointU, TEX_REPEAT_V * texPointV]);
    gl.uniform1f(shProgram.iTexAngle, deg2rad(texAngle));
    gl.uniform1f(shProgram.iTexPeriodU, TEX_REPEAT_U);

    surface.Draw();

    lightProgram.Use();
    gl.uniformMatrix4fv(lightProgram.iModelViewProjectionMatrix, false, modelViewProjection );

    gl.disableVertexAttribArray(shProgram.iAttribNormal);
    gl.disableVertexAttribArray(shProgram.iAttribTangent);
    gl.disableVertexAttribArray(shProgram.iAttribTexCoords);

    drawMarker(lightBuffer, lightModel, [1, 1, 1, 1]);
    drawMarker(pointBuffer, getPointPosition(), [1, 0.1, 0.1, 1]);
}


function animate() {
    draw();
    window.requestAnimationFrame(animate);
}


function updatePointInfo() {
    document.getElementById("pointValue").textContent =
        "u = " + texPointU.toFixed(3) + ", v = " + texPointV.toFixed(3);
}


function updateAngle() {
    texAngle = parseInt(document.getElementById("angleSlider").value);
    document.getElementById("angleValue").textContent = texAngle + "°";
}


function onKeyDown(e) {
    switch (e.code) {
        case "KeyA": texPointU -= POINT_STEP; break;
        case "KeyD": texPointU += POINT_STEP; break;
        case "KeyW": texPointV += POINT_STEP; break;
        case "KeyS": texPointV -= POINT_STEP; break;
        default: return;
    }

    texPointU = texPointU - Math.floor(texPointU);
    texPointV = Math.min(Math.max(texPointV, 0), 1);

    updatePointInfo();
    e.preventDefault();
}


function updateSurface() {
    const uSteps = parseInt(document.getElementById("uSlider").value);
    const vSteps = parseInt(document.getElementById("vSlider").value);

    document.getElementById("uValue").textContent = uSteps;
    document.getElementById("vValue").textContent = vSteps;

    let data = {};
    CreateSurfaceData(data, uSteps, vSteps);
    surface.BufferData(data);
}


/* Initialize the WebGL context. Called from init() */
function initGL() {
    let prog = createProgram( gl, vertexShaderSource, fragmentShaderSource );

    shProgram = new ShaderProgram('Textured', prog);
    shProgram.Use();

    shProgram.iAttribVertex              = gl.getAttribLocation(prog, "vertex");
    shProgram.iAttribNormal              = gl.getAttribLocation(prog, "normal");
    shProgram.iAttribTangent             = gl.getAttribLocation(prog, "tangent");
    shProgram.iAttribTexCoords           = gl.getAttribLocation(prog, "tex");
    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    shProgram.iModelViewMatrix           = gl.getUniformLocation(prog, "ModelViewMatrix");
    shProgram.iNormalMatrix              = gl.getUniformLocation(prog, "NormalMatrix");
    shProgram.iLightPosition             = gl.getUniformLocation(prog, "lightPosition");
    shProgram.iTMU0                      = gl.getUniformLocation(prog, "iTMU0");
    shProgram.iTMU1                      = gl.getUniformLocation(prog, "iTMU1");
    shProgram.iTMU2                      = gl.getUniformLocation(prog, "iTMU2");
    shProgram.iTexPoint                  = gl.getUniformLocation(prog, "texPoint");
    shProgram.iTexAngle                  = gl.getUniformLocation(prog, "texAngle");
    shProgram.iTexPeriodU                = gl.getUniformLocation(prog, "texPeriodU");

    let lightProg = createProgram( gl, lightVertexShaderSource, lightFragmentShaderSource );

    lightProgram = new ShaderProgram('Light', lightProg);
    lightProgram.iAttribVertex              = gl.getAttribLocation(lightProg, "vertex");
    lightProgram.iModelViewProjectionMatrix = gl.getUniformLocation(lightProg, "ModelViewProjectionMatrix");
    lightProgram.iColor                     = gl.getUniformLocation(lightProg, "color");

    lightBuffer = gl.createBuffer();
    pointBuffer = gl.createBuffer();

    surface = new Model('Surface');
    updateSurface();

    surface.idTextureDiffuse  = LoadTexture("./textures/diffuse.jpg");
    surface.idTextureSpecular = LoadTexture("./textures/specular.jpg");
    surface.idTextureNormal   = LoadTexture("./textures/normal.jpg");

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
    document.getElementById("angleSlider").addEventListener("input", updateAngle);
    window.addEventListener("keydown", onKeyDown);

    updateAngle();
    updatePointInfo();

    spaceball = new TrackballRotator(canvas, null, 0);

    animate();
}
