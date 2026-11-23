'use strict';

const PEAR_A = 2;
const PEAR_B = 2;

const NORMAL_EPS = 1e-6;

const TEX_REPEAT_U = 2;
const TEX_REPEAT_V = 1;


// p: an array of xyz vertex coords
function Vertex(p, t, normal)
{
    this.p = p;
    this.t = t;
    this.normal = normal;
    this.tangent = [0, 0, 0];
    this.bitangent = [0, 0, 0];
    this.triangles = [];
}

function Triangle(v0, v1, v2)
{
    this.v0 = v0;
    this.v1 = v1;
    this.v2 = v2;
    this.tangent = [];
    this.bitangent = [];
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

function add(a, b) {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(a, s) {
    return [a[0] * s, a[1] * s, a[2] * s];
}

function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
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

function CalcTriangleTangent(vertices, tri)
{
    const a = vertices[tri.v0], b = vertices[tri.v1], c = vertices[tri.v2];

    const e1 = sub(b.p, a.p);
    const e2 = sub(c.p, a.p);

    const du1 = b.t[0] - a.t[0], dv1 = b.t[1] - a.t[1];
    const du2 = c.t[0] - a.t[0], dv2 = c.t[1] - a.t[1];

    const det = du1 * dv2 - du2 * dv1;
    if (Math.abs(det) < 1e-12) {
        tri.tangent = [0, 0, 0];
        tri.bitangent = [0, 0, 0];
        return;
    }

    tri.tangent   = scale(sub(scale(e1, dv2), scale(e2, dv1)), 1 / det);
    tri.bitangent = scale(sub(scale(e2, du1), scale(e1, du2)), 1 / det);
}

function GramSchmidt(normal, tangent)
{
    let t = sub(tangent, scale(normal, dot(tangent, normal)));

    if (Math.hypot(t[0], t[1], t[2]) < 1e-9) {
        t = cross(Math.abs(normal[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], normal);
    }
    return normalize(t);
}


// Model Constructor function
function Model(name) {
    this.name = name;
    this.iVertexBuffer    = gl.createBuffer();
    this.iNormalBuffer    = gl.createBuffer();
    this.iTangentBuffer   = gl.createBuffer();
    this.iTexCoordsBuffer = gl.createBuffer();
    this.iIndexBuffer     = gl.createBuffer();
    this.count = 0;

    this.idTextureDiffuse  = -1;
    this.idTextureSpecular = -1;
    this.idTextureNormal   = -1;

    this.BufferData = function(data) {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, data.verticesF32, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, data.normalsF32, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTangentBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, data.tangentsF32, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTexCoordsBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, data.texcoordsF32, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indicesU16, gl.STATIC_DRAW);

        this.count = data.indicesU16.length;
    }

    this.Draw = function() {

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.idTextureDiffuse);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.idTextureSpecular);

        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, this.idTextureNormal);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.vertexAttribPointer(shProgram.iAttribNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribNormal);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTangentBuffer);
        gl.vertexAttribPointer(shProgram.iAttribTangent, 4, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribTangent);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTexCoordsBuffer);
        gl.vertexAttribPointer(shProgram.iAttribTexCoords, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribTexCoords);

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
            const uv = [TEX_REPEAT_U * j / vSteps, TEX_REPEAT_V * i / uSteps];

            vertices.push( new Vertex(pearPoint(z, beta), uv, AnalyticNormal(z, beta)) );
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

    for (const tri of triangles) {
        CalcTriangleTangent(vertices, tri);
    }

    for (const v of vertices) {
        for (const ind of v.triangles) {
            v.tangent   = add(v.tangent,   triangles[ind].tangent);
            v.bitangent = add(v.bitangent, triangles[ind].bitangent);
        }

        v.tangent = GramSchmidt(v.normal, v.tangent);
        v.handedness = dot(cross(v.normal, v.tangent), v.bitangent) < 0 ? -1 : 1;
    }

    data.verticesF32  = new Float32Array(vertices.length*3);
    data.normalsF32   = new Float32Array(vertices.length*3);
    data.tangentsF32  = new Float32Array(vertices.length*4);
    data.texcoordsF32 = new Float32Array(vertices.length*2);
    for (let i=0, len=vertices.length; i<len; i++)
    {
        data.verticesF32[i*3 + 0] = vertices[i].p[0];
        data.verticesF32[i*3 + 1] = vertices[i].p[1];
        data.verticesF32[i*3 + 2] = vertices[i].p[2];

        data.normalsF32[i*3 + 0] = vertices[i].normal[0];
        data.normalsF32[i*3 + 1] = vertices[i].normal[1];
        data.normalsF32[i*3 + 2] = vertices[i].normal[2];

        data.tangentsF32[i*4 + 0] = vertices[i].tangent[0];
        data.tangentsF32[i*4 + 1] = vertices[i].tangent[1];
        data.tangentsF32[i*4 + 2] = vertices[i].tangent[2];
        data.tangentsF32[i*4 + 3] = vertices[i].handedness;

        data.texcoordsF32[i*2 + 0] = vertices[i].t[0];
        data.texcoordsF32[i*2 + 1] = vertices[i].t[1];
    }

    data.indicesU16 = new Uint16Array(triangles.length*3);
    for (let i=0, len=triangles.length; i<len; i++)
    {
        data.indicesU16[i*3 + 0] = triangles[i].v0;
        data.indicesU16[i*3 + 1] = triangles[i].v1;
        data.indicesU16[i*3 + 2] = triangles[i].v2;
    }
}
