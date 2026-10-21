'use strict';

function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.curves = [];

    this.BufferData = function(data) {
        const vertices = [];
        this.curves = [];

        for (const curve of [...data.uCurves, ...data.vCurves]) {
            this.curves.push({
                start: vertices.length / 3,
                count: curve.length / 3
            });

            vertices.push(...curve);
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(vertices),
            gl.STATIC_DRAW
        );
    };

    this.Draw = function() {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(
            shProgram.iAttribVertex,
            3,
            gl.FLOAT,
            false,
            0,
            0
        );
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        for (const curve of this.curves) {
            gl.drawArrays(gl.LINE_STRIP, curve.start, curve.count);
        }
    };
}


function CreateSurfaceData() {
    const a = 2;
    const b = 2;
    const uSteps = 36;
    const vSteps = 24;

    const uCurves = [];
    const vCurves = [];

    function point(z, beta) {
        const r = z * Math.sqrt(z * (a - z)) / b;

        return [
            r * Math.sin(beta),
            r * Math.cos(beta),
            z - a / 2
        ];
    }

    for (let i = 0; i < vSteps; i++) {
        const beta = 2 * Math.PI * i / vSteps;
        const curve = [];

        for (let j = 0; j <= uSteps; j++) {
            const z = a * j / uSteps;
            curve.push(...point(z, beta));
        }

        uCurves.push(curve);
    }

    for (let j = 1; j < uSteps; j++) {
        const z = a * j / uSteps;
        const curve = [];

        for (let i = 0; i <= vSteps; i++) {
            const beta = 2 * Math.PI * i / vSteps;
            curve.push(...point(z, beta));
        }

        vCurves.push(curve);
    }

    return { uCurves, vCurves };
}
