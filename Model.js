'use strict';

const PEAR_A = 2;
const PEAR_B = 2;

const NORMAL_EPS = 1e-6;


// p: an array of xyz vertex coords
function Vertex(p, normal)
{
    this.p = p;
    this.normal = normal;
    this.triangles = [];
}

function Triangle(v0, v1, v2)
{
    this.v0 = v0;
    this.v1 = v1;
    this.v2 = v2;
}


function pearRadius(z) {
    return z * Math.sqrt(z * (PEAR_A - z)) / PEAR_B;
}

function pearRadiusDerivative(z) {
    return z * (3 * PEAR_A - 4 * z) / (2 * PEAR_B * Math.sqrt(z * (PEAR_A - z)));
}

function pearPoint(z, beta) {
    const r = pearRadius(z);
    return [
        r * Math.sin(beta),
        r * Math.cos(beta),
        z - PEAR_A / 2
    ];
}

function pearDerivativeZ(z, beta) {
    const dr = pearRadiusDerivative(z);
    return [
        dr * Math.sin(beta),
        dr * Math.cos(beta),
        1
    ];
}

function pearDerivativeBeta(z, beta) {
    const r = pearRadius(z);
    return [
        r * Math.cos(beta),
        -r * Math.sin(beta),
        0
    ];
}

function cross(a, b) {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ];
}

function normalize(v) {
    const len = Math.hypot(v[0], v[1], v[2]);
    return len > 0 ? [v[0] / len, v[1] / len, v[2] / len] : [0, 0, 1];
}

function AnalyticNormal(z, beta) {
    const zn = Math.min(Math.max(z, NORMAL_EPS), PEAR_A - NORMAL_EPS);

    const n = cross(pearDerivativeZ(zn, beta), pearDerivativeBeta(zn, beta));
    return normalize(n);
}


// Model Constructor function
function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.iNormalBuffer = gl.createBuffer();
    this.iIndexBuffer  = gl.createBuffer();
    this.count = 0;

    this.BufferData = function(vertices, normals, indices) {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

        this.count = indices.length;
    }

    this.Draw = function() {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.vertexAttribPointer(shProgram.iAttribNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribNormal);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
    }
}


function CreateSurfaceData(data, uSteps, vSteps)
{
    let vertices = [];
    let triangles = [];

    for (let i = 0; i <= uSteps; i++) {
        const z = PEAR_A * i / uSteps;

        for (let j = 0; j <= vSteps; j++) {
            const beta = 2 * Math.PI * j / vSteps;
            vertices.push( new Vertex(pearPoint(z, beta), AnalyticNormal(z, beta)) );
        }
    }

    function addTriangle(v0, v1, v2) {
        let trianInd = triangles.length;
        triangles.push( new Triangle(v0, v1, v2) );
        vertices[v0].triangles.push(trianInd);
        vertices[v1].triangles.push(trianInd);
        vertices[v2].triangles.push(trianInd);
    }

    const rowLen = vSteps + 1;

    // v00    v01
    //   o - o
    //   | \ |
    //   o - o
    // v10    v11
    for (let i = 0; i < uSteps; i++) {
        for (let j = 0; j < vSteps; j++) {
            const v00 = i * rowLen + j;
            const v01 = v00 + 1;
            const v10 = v00 + rowLen;
            const v11 = v10 + 1;

            if (i !== 0)          addTriangle(v00, v10, v01);
            if (i !== uSteps - 1) addTriangle(v01, v10, v11);
        }
    }

    data.verticesF32 = new Float32Array(vertices.length*3);
    data.normalsF32  = new Float32Array(vertices.length*3);
    for (let i=0, len=vertices.length; i<len; i++)
    {
        data.verticesF32[i*3 + 0] = vertices[i].p[0];
        data.verticesF32[i*3 + 1] = vertices[i].p[1];
        data.verticesF32[i*3 + 2] = vertices[i].p[2];

        data.normalsF32[i*3 + 0] = vertices[i].normal[0];
        data.normalsF32[i*3 + 1] = vertices[i].normal[1];
        data.normalsF32[i*3 + 2] = vertices[i].normal[2];
    }

    data.indicesU16 = new Uint16Array(triangles.length*3);
    for (let i=0, len=triangles.length; i<len; i++)
    {
        data.indicesU16[i*3 + 0] = triangles[i].v0;
        data.indicesU16[i*3 + 1] = triangles[i].v1;
        data.indicesU16[i*3 + 2] = triangles[i].v2;
    }
}
